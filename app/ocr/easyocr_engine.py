"""
EasyOCR Engine Implementation
Secondary fallback engine for Legal Metrology text extraction.
"""

import time
import logging
from typing import List
import numpy as np

from .engine_base import BaseOCREngine, OCRResult, TextPolygon

logger = logging.getLogger(__name__)


class EasyOCREngine(BaseOCREngine):
    """
    Secondary OCR Engine for Legal Metrology text extraction.
    Uses lazy initialization with graceful fallback.
    """
    def __init__(self, languages: List[str] = None):
        super().__init__(name="easyocr")
        self.languages = languages or ["en", "hi"]
        self._reader = None

    def _get_reader(self):
        if self._reader is None:
            try:
                from core.models import registry
                self._reader = registry.get_easyocr_reader()
            except Exception:
                try:
                    import easyocr
                    self._reader = easyocr.Reader(self.languages, gpu=False)
                except Exception as e:
                    logger.warning(f"EasyOCR could not be loaded: {e}. Using fallback stub.")
                    self._reader = None
        return self._reader

    def is_available(self) -> bool:
        return self._get_reader() is not None

    def extract_text(self, image: np.ndarray) -> OCRResult:
        start_time = time.time()
        reader = self._get_reader()
        tokens: List[TextPolygon] = []

        if reader is not None:
            try:
                results = reader.readtext(image)
                for bbox, text, conf in results:
                    tokens.append(
                        TextPolygon(
                            text=str(text).strip(),
                            confidence=float(conf),
                            bbox=[[float(pt[0]), float(pt[1])] for pt in bbox],
                            engine=self.name,
                        )
                    )
            except Exception as exc:
                logger.error(f"EasyOCR error: {exc}")
        else:
            tokens = []

        elapsed_ms = (time.time() - start_time) * 1000
        return OCRResult.from_tokens(
            engine_name=self.name,
            tokens=tokens,
            execution_time_ms=elapsed_ms
        )
