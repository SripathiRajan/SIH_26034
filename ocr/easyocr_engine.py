from typing import List, Dict, Any
from core.models import registry
from core.logger import logger

def run_easyocr(image_path: str) -> List[Dict[str, Any]]:
    """Runs EasyOCR using the shared singleton reader instance."""
    try:
        reader = registry.get_easyocr_reader()
        result = reader.readtext(image_path, detail=1)
        out = []
        for (box, text, conf) in result:
            out.append({
                "text": text.strip(),
                "confidence": float(conf),
                "box": box,
                "source": "easyocr"
            })
        return out
    except Exception as e:
        logger.error(f"[EasyOCR] Error: {e}")
        return []
