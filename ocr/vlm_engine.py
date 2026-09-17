from typing import List, Dict, Any
from PIL import Image
try:
    import torch
except Exception:
    torch = None
from core.models import registry
from core.config import VLM_TARGET_DIM
from core.logger import logger

def run_vlm_ocr(image_path: str) -> List[Dict[str, Any]]:
    """
    Runs Microsoft Florence-2 VLM fallback.
    Uses prompt <OCR_WITH_REGION> and DaViT vision backbone.
    """
    try:
        proc, mdl = registry.get_florence2()
        pil_img = Image.open(image_path).convert("RGB")
        w, h = pil_img.size

        # Aspect ratio square pad
        max_dim = max(w, h)
        sq_img = Image.new("RGB", (max_dim, max_dim), (255, 255, 255))
        sq_img.paste(pil_img, ((max_dim - w) // 2, (max_dim - h) // 2))
        fast_img = sq_img.resize((VLM_TARGET_DIM, VLM_TARGET_DIM), Image.Resampling.BILINEAR)

        prompt = "<OCR_WITH_REGION>"
        inputs = proc(text=prompt, images=fast_img, return_tensors="pt")
        inputs["pixel_values"] = inputs["pixel_values"].float()

        with torch.inference_mode():
            generated_ids = mdl.generate(
                input_ids=inputs["input_ids"],
                pixel_values=inputs["pixel_values"],
                max_new_tokens=192,
                num_beams=1,
                use_cache=False,
                do_sample=False
            )

        generated_text = proc.batch_decode(generated_ids, skip_special_tokens=False)[0]
        parsed = proc.post_process_generation(generated_text, task=prompt, image_size=(w, h))

        ocr_data = parsed.get("<OCR_WITH_REGION>", {})
        bboxes = ocr_data.get("quad_boxes", ocr_data.get("bboxes", []))
        labels = ocr_data.get("labels", [])

        out = []
        for box, label in zip(bboxes, labels):
            text = label.strip()
            if text:
                if len(box) == 4:
                    x1, y1, x2, y2 = box
                    poly = [[x1, y1], [x2, y1], [x2, y2], [x1, y2]]
                else:
                    poly = box
                out.append({
                    "text": text,
                    "confidence": 0.85,
                    "box": poly,
                    "source": "vlm"
                })
        return out
    except Exception as e:
        logger.error(f"[Florence2_VLM] Inference error: {e}")
        return []
