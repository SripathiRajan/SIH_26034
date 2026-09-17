"""
PaddleOCR Engine Implementation
Primary OCR engine for Legal Metrology text extraction.
"""

import time
import logging
from typing import List
import numpy as np

from .engine_base import BaseOCREngine, OCRResult, TextPolygon

logger = logging.getLogger(__name__)


class PaddleOCREngine(BaseOCREngine):
    """
    Primary OCR Engine for Legal Metrology text extraction.
    Uses lazy initialization with graceful fallback.
    """
    def __init__(self, use_angle_cls: bool = True, lang: str = "en"):
        super().__init__(name="paddleocr")
        self.use_angle_cls = use_angle_cls
        self.lang = lang
        self._ocr_instance = None

    def _get_engine(self):
        if self._ocr_instance is None:
            try:
                from core.models import registry
                self._ocr_instance = registry.get_paddle_ocr()
            except Exception:
                try:
                    from paddleocr import PaddleOCR
                    self._ocr_instance = PaddleOCR(
                        use_angle_cls=self.use_angle_cls,
                        lang=self.lang,
                        show_log=False
                    )
                except Exception as e:
                    logger.warning(f"Failed to load PaddleOCR natively: {e}. Falling back to mock engine.")
                    self._ocr_instance = None
        return self._ocr_instance

    def is_available(self) -> bool:
        return self._get_engine() is not None

    def extract_text(self, image: np.ndarray) -> OCRResult:
        start_time = time.time()
        engine = self._get_engine()
        tokens: List[TextPolygon] = []

        if engine is not None:
            try:
                raw_results = engine.ocr(image, cls=self.use_angle_cls)
                if raw_results and raw_results[0]:
                    for line in raw_results[0]:
                        bbox, (text, conf) = line
                        tokens.append(
                            TextPolygon(
                                text=str(text).strip(),
                                confidence=float(conf),
                                bbox=[[float(pt[0]), float(pt[1])] for pt in bbox],
                                engine=self.name,
                            )
                        )
            except Exception as exc:
                logger.error(f"PaddleOCR execution error: {exc}")
        else:
            # Dev environments without paddleocr installed return empty detections
            tokens = []

        elapsed_ms = (time.time() - start_time) * 1000
        return OCRResult.from_tokens(
            engine_name=self.name,
            tokens=tokens,
            execution_time_ms=elapsed_ms
        )
