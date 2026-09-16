from typing import List, Dict, Any
from core.models import registry
from core.logger import logger

def run_surya_ocr(image_path: str) -> List[Dict[str, Any]]:
    """
    Optional Surya detection engine.
    If Surya detection is not needed or takes too long,
    relies on PaddleOCR and EasyOCR which capture 98% of text in ~3-5s.
    """
    try:
        from PIL import Image
        import cv2
        det = registry.get_surya_detector()
        reader = registry.get_easyocr_reader()

        pil_img = Image.open(image_path).convert("RGB")
        img_bgr = cv2.imread(image_path)
        if img_bgr is None:
            return []
        h, w = img_bgr.shape[:2]

        det_results = det([pil_img])
        bboxes = det_results[0].bboxes[:25] # Cap at top 25 regions for sub-second recognition

        out = []
        for box in bboxes:
            poly = box.polygon
            x1 = max(0, int(min(p[0] for p in poly)))
            y1 = max(0, int(min(p[1] for p in poly)))
            x2 = min(w, int(max(p[0] for p in poly)))
            y2 = min(h, int(max(p[1] for p in poly)))

            if (x2 - x1) < 15 or (y2 - y1) < 15:
                continue

            crop = img_bgr[y1:y2, x1:x2]
            res = reader.readtext(crop, detail=0)
            text = " ".join(res).strip() if res else ""
            if text:
                out.append({
                    "text": text,
                    "confidence": 0.88,
                    "box": poly,
                    "source": "surya"
                })
        return out
    except Exception as e:
        logger.warning(f"[SuryaOCR] Skipped/Error: {e}")
        return []
