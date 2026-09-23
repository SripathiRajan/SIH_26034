"""
AI Vision Model Backup Engine
------------------------------
Provides multimodal Vision-Language Model (VLM) fallback when local OCR engines
(PaddleOCR, EasyOCR, SuryaOCR) are unavailable, encounter missing dependencies,
or fail to detect mandatory statutory fields.

Supports:
1. Groq Multimodal Vision (qwen/qwen3.8-27b) via GROQ_API_KEY (fast, 2-3s inference)
2. Google Gemini Vision (gemini-2.0-flash / gemini-1.5-flash) via GEMINI_API_KEY
3. Local Florence-2 VLM fallback (if PyTorch available)
"""

import os
import io
import time
import base64
import logging
from typing import List, Dict, Any, Optional
from PIL import Image

logger = logging.getLogger(__name__)

# Optimal dimension to keep payload ~90-130KB and API latency ~2 seconds
VISION_MAX_DIM = 720
VISION_JPEG_QUALITY = 68


def _encode_image_to_base64(image_path: str, max_dim: int = VISION_MAX_DIM) -> Optional[str]:
    """Resizes and compresses image to a lightweight JPEG base64 string."""
    try:
        with Image.open(image_path) as img:
            rgb_img = img.convert("RGB")
            rgb_img.thumbnail((max_dim, max_dim), Image.Resampling.LANCZOS)
            buf = io.BytesIO()
            rgb_img.save(buf, format="JPEG", quality=VISION_JPEG_QUALITY, optimize=True)
            return base64.b64encode(buf.getvalue()).decode("utf-8")
    except Exception as e:
        logger.warning(f"[AI_Vision] Failed to encode image {image_path}: {e}")
        return None


def _call_groq_vision(base64_image: str, missing_fields: Optional[List[str]] = None) -> List[str]:
    """Calls Groq's multimodal vision model (qwen/qwen3.8-27b) with exponential retry."""
    try:
        import httpx
    except ImportError:
        return []

    from core.config import GROQ_API_KEY, GROQ_API_BASE, AI_VISION_MODEL
    key = GROQ_API_KEY or os.environ.get("GROQ_API_KEY")
    if not key:
        return []

    missing_hint = ""
    if missing_fields:
        missing_hint = f"\nCRITICAL: Statutory fields currently missing that you must locate if visible: {', '.join(missing_fields)}."

    prompt = (
        "You are an expert packaging label scanner for Legal Metrology compliance inspection.\n"
        "Read and transcribe ALL text visible on this product packaging label verbatim, line by line.\n"
        "Extract every declaration line including:\n"
        "- Brand & Product Name\n"
        "- Net Quantity / Net Weight / Net Content (e.g., 100 g, 500 ml, 1 kg, 1 N)\n"
        "- Maximum Retail Price (MRP) and Unit Sale Price (USP)\n"
        "- Date of Manufacture / Packaging (MFD, PKD, DOM) and Use By / Expiry Date\n"
        "- Batch Number / Lot Number\n"
        "- Complete Manufacturer, Packer & Marketer Name and Address with PIN code\n"
        "- Customer Care / Consumer Grievance Contact (Phone, Email, Helpline)\n"
        "- FSSAI License Number (14 digits)\n"
        "- Country of Origin (e.g., Product of India, Made in India)\n"
        f"{missing_hint}\n"
        "Output each piece of text on a separate line. Output ONLY the extracted text lines with NO markdown backticks, NO intro or outro."
    )

    model_name = AI_VISION_MODEL or "qwen/qwen3.8-27b"
    max_retries = 3

    for attempt in range(max_retries):
        try:
            client_timeout = httpx.Timeout(connect=10.0, read=45.0, write=15.0, pool=10.0)
            resp = httpx.post(
                f"{GROQ_API_BASE.rstrip('/')}/chat/completions",
                headers={
                    "Authorization": f"Bearer {key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": model_name,
                    "messages": [
                        {
                            "role": "user",
                            "content": [
                                {"type": "text", "text": prompt},
                                {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{base64_image}"}},
                            ],
                        }
                    ],
                    "temperature": 0.1,
                    "max_tokens": 900,
                },
                timeout=client_timeout,
            )
            if resp.status_code == 200:
                content = resp.json().get("choices", [{}])[0].get("message", {}).get("content", "")
                lines = [l.strip() for l in content.split("\n") if l.strip() and not l.strip().startswith("```")]
                logger.info(f"[AI_Vision] Groq Qwen Vision successfully extracted {len(lines)} text lines")
                return lines
            elif resp.status_code in (429, 503, 502, 504):
                logger.warning(f"[AI_Vision] Groq vision returned HTTP {resp.status_code} (attempt {attempt + 1}/{max_retries}). Retrying in {(attempt + 1) * 2}s...")
                time.sleep((attempt + 1) * 2.0)
            else:
                logger.warning(f"[AI_Vision] Groq vision returned HTTP {resp.status_code}: {resp.text[:150]}")
                break
        except (httpx.ReadTimeout, httpx.ConnectTimeout, httpx.NetworkError) as e:
            logger.warning(f"[AI_Vision] Groq vision network error (attempt {attempt + 1}/{max_retries}): {e}")
            time.sleep((attempt + 1) * 2.0)
        except Exception as e:
            logger.warning(f"[AI_Vision] Groq vision call failed: {e}")
            break

    return []


def _call_gemini_vision(base64_image: str, missing_fields: Optional[List[str]] = None) -> List[str]:
    """Calls Google GenAI Gemini Vision if GEMINI_API_KEY is configured."""
    try:
        from core.config import GEMINI_API_KEY
        key = GEMINI_API_KEY or os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
        if not key:
            return []

        from google import genai
        from google.genai import types

        client = genai.Client(api_key=key)
        missing_hint = f" Specifically look for: {', '.join(missing_fields)}." if missing_fields else ""
        prompt = (
            "Transcribe all text on this product package verbatim line by line for legal metrology inspection. "
            "Include Brand, Net Quantity, MRP, Dates, Manufacturer address, Consumer Care, FSSAI, Country of origin."
            f"{missing_hint} Output only the text lines verbatim."
        )
        image_bytes = base64.b64decode(base64_image)
        part = types.Part.from_bytes(data=image_bytes, mime_type="image/jpeg")

        for model_id in ["gemini-2.0-flash", "gemini-1.5-flash"]:
            try:
                response = client.models.generate_content(
                    model=model_id,
                    contents=[part, prompt],
                )
                if response and response.text:
                    lines = [l.strip() for l in response.text.split("\n") if l.strip() and not l.strip().startswith("```")]
                    logger.info(f"[AI_Vision] Gemini Vision ({model_id}) extracted {len(lines)} text lines")
                    return lines
            except Exception as model_err:
                logger.debug(f"[AI_Vision] Gemini model {model_id} failed: {model_err}")
                continue
    except Exception as e:
        logger.warning(f"[AI_Vision] Gemini vision call failed: {e}")
    return []


def run_ai_vision_ocr(image_path: str, missing_fields: Optional[List[str]] = None) -> List[Dict[str, Any]]:
    """
    Main entry point for AI Vision Model backup.
    Transcribes packaging text using multimodal vision models and packages into
    standard OCR region dicts compatible with the spatial merger and field extractor.
    """
    from core.config import ENABLE_AI_VISION_BACKUP
    if not ENABLE_AI_VISION_BACKUP:
        logger.info("[AI_Vision] AI Vision Model backup is disabled via configuration.")
        return []

    if not os.path.exists(image_path):
        return []

    base64_img = _encode_image_to_base64(image_path)
    if not base64_img:
        return []

    lines: List[str] = []

    # 1. Primary Cloud Vision: Groq Qwen Vision (fastest, ~2s)
    lines = _call_groq_vision(base64_img, missing_fields=missing_fields)

    # 2. Secondary Cloud Vision: Gemini Vision (if Groq fails or rate limits)
    if not lines:
        lines = _call_gemini_vision(base64_img, missing_fields=missing_fields)

    # 3. Tertiary Local VLM: Florence-2 (if installed and PyTorch available)
    if not lines:
        try:
            from ocr.vlm_engine import run_vlm_ocr
            florence_regions = run_vlm_ocr(image_path)
            if florence_regions:
                return florence_regions
        except Exception as e:
            logger.warning(f"[AI_Vision] Florence-2 local fallback skipped: {e}")

    if not lines:
        logger.warning("[AI_Vision] No text lines recovered by any AI vision provider.")
        return []

    # Get image dimensions to generate spaced bounding boxes in top-to-bottom reading order
    try:
        with Image.open(image_path) as img:
            w, h = img.size
    except Exception:
        w, h = 1000, 1000

    regions: List[Dict[str, Any]] = []
    line_count = len(lines)
    slot_h = max(18, h // max(1, line_count))

    for idx, text in enumerate(lines):
        y_top = min(h - slot_h, idx * slot_h)
        y_bot = min(h, y_top + slot_h)
        poly = [[10, y_top], [w - 10, y_top], [w - 10, y_bot], [10, y_bot]]

        regions.append({
            "text": text,
            "confidence": 0.95,
            "box": poly,
            "source": "ai_vision",
        })

    logger.info(f"✓ AI Vision Model backup recovered {len(regions)} text regions")
    return regions
