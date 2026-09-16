from typing import List, Dict, Any
from core.models import registry
from core.logger import logger

def run_paddle_ocr(image_path: str) -> List[Dict[str, Any]]:
    """Runs PaddleOCR using singleton instance with angle correction."""
    try:
        ocr = registry.get_paddle_ocr()
        result = ocr.ocr(image_path, cls=True)
        if not result or result[0] is None:
            return []
        out = []
        for line in result[0]:
            box, (text, conf) = line[0], line[1]
            out.append({
                "text": text.strip(),
                "confidence": float(conf),
                "box": box,
                "source": "paddle"
            })
        return out
    except Exception as e:
        logger.error(f"[PaddleOCR] Error: {e}")
        return []
