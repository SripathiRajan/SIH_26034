"""
Abstract Base Class for OCR Engines
Provides standardized result types and interface contracts.
"""

from abc import ABC, abstractmethod
from typing import List, Tuple, Optional
import numpy as np
from pydantic import BaseModel, Field


class TextPolygon(BaseModel):
    text: str
    confidence: float
    bbox: List[List[float]] = Field(
        ..., description="4-point polygon coordinates: [[x1, y1], [x2, y2], [x3, y3], [x4, y4]]"
    )
    engine: str = "unknown"

    @property
    def bounding_box_xywh(self) -> Tuple[float, float, float, float]:
        xs = [pt[0] for pt in self.bbox]
        ys = [pt[1] for pt in self.bbox]
        min_x, max_x = min(xs), max(xs)
        min_y, max_y = min(ys), max(ys)
        return min_x, min_y, max_x - min_x, max_y - min_y


class OCRResult(BaseModel):
    engine_name: str
    tokens: List[TextPolygon]
    average_confidence: float
    execution_time_ms: float
    raw_text: str = ""
    engine_agreement_score: float = 1.0

    @classmethod
    def from_tokens(
        cls,
        engine_name: str,
        tokens: List[TextPolygon],
        execution_time_ms: float,
        engine_agreement_score: float = 1.0,
        raw_text: Optional[str] = None,
    ) -> "OCRResult":
        if not tokens:
            return cls(
                engine_name=engine_name,
                tokens=[],
                average_confidence=0.0,
                execution_time_ms=execution_time_ms,
                raw_text=raw_text or "",
                engine_agreement_score=round(engine_agreement_score, 4),
            )
        avg_conf = sum(t.confidence for t in tokens) / len(tokens)
        full_text = raw_text if raw_text is not None else " ".join(t.text for t in tokens)
        return cls(
            engine_name=engine_name,
            tokens=tokens,
            average_confidence=round(avg_conf, 4),
            execution_time_ms=round(execution_time_ms, 2),
            raw_text=full_text,
            engine_agreement_score=round(engine_agreement_score, 4),
        )


class BaseOCREngine(ABC):
    """
    Abstract Base Class for OCR Engines (PaddleOCR, EasyOCR, TrOCR).
    Enforces standardized inference interface across all OCR engines.
    """
    def __init__(self, name: str):
        self.name = name

    @abstractmethod
    def extract_text(self, image: np.ndarray) -> OCRResult:
        """
        Processes an image (BGR or RGB np.ndarray) and returns standardized OCRResult
        """
        pass

    def is_available(self) -> bool:
        """
        Returns True if the engine's dependencies are loaded and ready.
        """
        return True


# Alias for backward compatibility
OCREngineBase = BaseOCREngine

