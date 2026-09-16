"""
Unit Tests for Adaptive OCR Ensemble (PaddleOCR + EasyOCR + TrOCR)
Tests cover:
  - BaseOCREngine interface conformance
  - IoU spatial calculation
  - Spatial token merger with IoU > 0.5 keeping highest confidence
  - High-confidence path (PaddleOCR only, agreement score 1.0)
  - Low-confidence path with high engine agreement (Paddle + Easy + TrOCR)
  - Low-confidence path with engine disagreement
  - Tolerance to a missing or failing OCR engine (TrOCR/EasyOCR throws)
  - Configurable confidence threshold behavior
"""

import numpy as np
import pytest
from typing import List

from app.ocr.engine_base import BaseOCREngine, OCREngineBase, OCRResult, TextPolygon
from app.ocr.paddle_engine import PaddleOCREngine
from app.ocr.easyocr_engine import EasyOCREngine
from app.ocr.ensemble import AdaptiveOCREnsemble


class MockOCREngine(BaseOCREngine):
    """Configurable mock engine for testing ensemble behavior."""

    def __init__(self, name: str, tokens: List[TextPolygon], should_fail: bool = False):
        super().__init__(name=name)
        self.mock_tokens = tokens
        self.should_fail = should_fail
        self.call_count = 0

    def extract_text(self, image: np.ndarray) -> OCRResult:
        self.call_count += 1
        if self.should_fail:
            raise RuntimeError(f"Engine '{self.name}' simulated hardware/model failure")
        return OCRResult.from_tokens(
            engine_name=self.name,
            tokens=self.mock_tokens,
            execution_time_ms=15.0,
        )


def test_base_ocr_engine_inheritance():
    """Verify primary engines inherit from BaseOCREngine and OCREngineBase."""
    paddle = PaddleOCREngine()
    easy = EasyOCREngine()

    assert isinstance(paddle, BaseOCREngine)
    assert isinstance(paddle, OCREngineBase)
    assert isinstance(easy, BaseOCREngine)

    assert paddle.name == "paddleocr"
    assert easy.name == "easyocr"


def test_iou_calculation():
    """Calculates Intersection-over-Union accurately."""
    box_a = (0.0, 0.0, 100.0, 50.0)
    box_b = (50.0, 0.0, 100.0, 50.0)

    iou = AdaptiveOCREnsemble._calculate_iou(box_a, box_b)
    # Intersection: 50 * 50 = 2500, Union: 5000 + 5000 - 2500 = 7500 -> 2500/7500 = 0.333
    assert 0.30 <= iou <= 0.35

    # Identical boxes: IoU == 1.0
    assert AdaptiveOCREnsemble._calculate_iou(box_a, box_a) == 1.0

    # Disjoint boxes: IoU == 0.0
    box_c = (200.0, 200.0, 50.0, 50.0)
    assert AdaptiveOCREnsemble._calculate_iou(box_a, box_c) == 0.0


def test_token_merger_suppresses_redundant_boxes_and_keeps_highest_confidence():
    """Overlapping boxes (IoU > 0.5) merge into the highest-confidence token."""
    ensemble = AdaptiveOCREnsemble(iou_merge_threshold=0.5)

    token_high_conf = TextPolygon(
        text="MRP Rs. 250 (Incl. of all taxes)",
        confidence=0.95,
        bbox=[[10.0, 20.0], [200.0, 20.0], [200.0, 50.0], [10.0, 50.0]],
        engine="paddleocr",
    )
    token_duplicate_lower_conf = TextPolygon(
        text="MRP 250",
        confidence=0.70,
        bbox=[[12.0, 21.0], [198.0, 21.0], [198.0, 49.0], [12.0, 49.0]],
        engine="easyocr",
    )
    token_independent = TextPolygon(
        text="Net Wt. 1kg",
        confidence=0.92,
        bbox=[[10.0, 70.0], [150.0, 70.0], [150.0, 100.0], [10.0, 100.0]],
        engine="trocr",
    )

    merged = ensemble._merge_tokens_by_iou([token_duplicate_lower_conf, token_high_conf, token_independent])
    assert len(merged) == 2
    # First cluster retained high confidence (0.95) over duplicate (0.70)
    assert merged[0].text == "MRP Rs. 250 (Incl. of all taxes)"
    assert merged[0].confidence == 0.95
    assert merged[1].text == "Net Wt. 1kg"


def test_high_confidence_path_skips_secondary_and_tertiary():
    """
    When primary PaddleOCR confidence >= 0.75, EasyOCR and TrOCR are NOT called.
    engine_agreement_score must be 1.0.
    """
    paddle_tokens = [
        TextPolygon(text="Brand Name", confidence=0.94, bbox=[[0, 0], [100, 0], [100, 20], [0, 20]], engine="paddleocr"),
        TextPolygon(text="MRP Rs. 100", confidence=0.91, bbox=[[0, 30], [100, 30], [100, 50], [0, 50]], engine="paddleocr"),
        TextPolygon(text="Net Qty 500g", confidence=0.88, bbox=[[0, 60], [100, 60], [100, 80], [0, 80]], engine="paddleocr"),
    ]

    mock_paddle = MockOCREngine("paddleocr", paddle_tokens)
    mock_easy = MockOCREngine("easyocr", [])
    mock_trocr = MockOCREngine("trocr", [])

    ensemble = AdaptiveOCREnsemble(
        confidence_threshold=0.75,
        primary_engine=mock_paddle,
        secondary_engine=mock_easy,
        tertiary_engine=mock_trocr,
    )

    test_img = np.zeros((200, 200, 3), dtype=np.uint8)
    result = ensemble.process(test_img)

    # Primary ran once
    assert mock_paddle.call_count == 1
    # Secondary and tertiary were NOT invoked
    assert mock_easy.call_count == 0
    assert mock_trocr.call_count == 0

    assert result.engine_name == "paddleocr"
    assert result.engine_agreement_score == 1.0
    assert len(result.tokens) == 3


def test_low_confidence_path_triggers_ensemble_with_high_agreement():
    """
    When PaddleOCR confidence < 0.75, EasyOCR + TrOCR run.
    When all 3 engines agree on detected regions and texts, engine_agreement_score is high (>= 0.85).
    """
    # Paddle detects with low confidence (0.60)
    paddle_tokens = [
        TextPolygon(text="MRP Rs. 200", confidence=0.60, bbox=[[10, 10], [100, 10], [100, 40], [10, 40]], engine="paddleocr"),
        TextPolygon(text="Net Wt: 200g", confidence=0.55, bbox=[[10, 50], [100, 50], [100, 80], [10, 80]], engine="paddleocr"),
    ]
    # EasyOCR detects same regions with higher confidence
    easy_tokens = [
        TextPolygon(text="MRP Rs. 200", confidence=0.89, bbox=[[11, 10], [99, 10], [99, 40], [11, 40]], engine="easyocr"),
        TextPolygon(text="Net Wt: 200g", confidence=0.87, bbox=[[10, 51], [100, 51], [100, 80], [10, 80]], engine="easyocr"),
    ]
    # TrOCR detects same regions
    trocr_tokens = [
        TextPolygon(text="MRP Rs. 200", confidence=0.92, bbox=[[10, 11], [100, 11], [100, 39], [10, 39]], engine="trocr"),
        TextPolygon(text="Net Wt: 200g", confidence=0.90, bbox=[[12, 50], [98, 50], [98, 80], [12, 80]], engine="trocr"),
    ]

    mock_paddle = MockOCREngine("paddleocr", paddle_tokens)
    mock_easy = MockOCREngine("easyocr", easy_tokens)
    mock_trocr = MockOCREngine("trocr", trocr_tokens)

    ensemble = AdaptiveOCREnsemble(
        confidence_threshold=0.75,
        primary_engine=mock_paddle,
        secondary_engine=mock_easy,
        tertiary_engine=mock_trocr,
    )

    test_img = np.zeros((200, 200, 3), dtype=np.uint8)
    result = ensemble.process(test_img)

    # Primary and secondary were called; TrOCR execution is removed
    assert mock_paddle.call_count == 1
    assert mock_easy.call_count == 1
    assert mock_trocr.call_count == 0  # TrOCR execution removed

    assert result.engine_name.startswith("ensemble")
    # Redundant overlapping boxes merged into 2 unique fields
    assert len(result.tokens) == 2
    # Highest confidence candidate selected between Paddle and EasyOCR (EasyOCR 0.89 and 0.87)
    assert result.tokens[0].confidence == 0.89
    assert result.tokens[1].confidence == 0.87

    # High agreement between active engines
    assert result.engine_agreement_score >= 0.80


def test_low_confidence_path_with_engine_disagreement():
    """
    When engines detect completely disjoint regions (or conflicting text),
    engine_agreement_score reflects the disagreement.
    """
    paddle_tokens = [
        TextPolygon(text="Paddle Only Area", confidence=0.50, bbox=[[0, 0], [40, 0], [40, 40], [0, 40]], engine="paddleocr"),
    ]
    easy_tokens = [
        TextPolygon(text="EasyOCR Disjoint Area", confidence=0.70, bbox=[[100, 100], [140, 100], [140, 140], [100, 140]], engine="easyocr"),
    ]
    trocr_tokens = [
        TextPolygon(text="TrOCR Another Corner", confidence=0.80, bbox=[[200, 200], [240, 200], [240, 240], [200, 240]], engine="trocr"),
    ]

    mock_paddle = MockOCREngine("paddleocr", paddle_tokens)
    mock_easy = MockOCREngine("easyocr", easy_tokens)
    mock_trocr = MockOCREngine("trocr", trocr_tokens)

    ensemble = AdaptiveOCREnsemble(
        confidence_threshold=0.75,
        primary_engine=mock_paddle,
        secondary_engine=mock_easy,
        tertiary_engine=mock_trocr,
    )

    test_img = np.zeros((300, 300, 3), dtype=np.uint8)
    result = ensemble.process(test_img)

    # TrOCR execution is disabled -> 2 disjoint regions from paddle + easyocr
    assert mock_trocr.call_count == 0
    assert len(result.tokens) == 2
    assert result.engine_agreement_score <= 0.50


def test_one_engine_failing_is_gracefully_handled():
    """
    If one engine (e.g. TrOCR) raises an exception, the ensemble does NOT fail.
    It proceeds with the remaining active engines.
    """
    paddle_tokens = [
        TextPolygon(text="MRP Rs. 50", confidence=0.55, bbox=[[10, 10], [80, 10], [80, 30], [10, 30]], engine="paddleocr"),
    ]
    easy_tokens = [
        TextPolygon(text="MRP Rs. 50", confidence=0.88, bbox=[[10, 10], [80, 10], [80, 30], [10, 30]], engine="easyocr"),
    ]

    mock_paddle = MockOCREngine("paddleocr", paddle_tokens)
    mock_easy = MockOCREngine("easyocr", easy_tokens)
    # TrOCR throws an unexpected model/runtime error
    mock_trocr = MockOCREngine("trocr", [], should_fail=True)

    ensemble = AdaptiveOCREnsemble(
        confidence_threshold=0.75,
        primary_engine=mock_paddle,
        secondary_engine=mock_easy,
        tertiary_engine=mock_trocr,
    )

    test_img = np.zeros((100, 100, 3), dtype=np.uint8)
    # Should not raise exception
    result = ensemble.process(test_img)

    assert result is not None
    assert len(result.tokens) == 1
    # EasyOCR token (0.88) was chosen over PaddleOCR (0.55)
    assert result.tokens[0].confidence == 0.88
    # 2 active engines agreed on this token
    assert result.engine_agreement_score == 1.0


def test_configurable_confidence_threshold():
    """Threshold can be dynamically configured."""
    paddle_tokens = [
        TextPolygon(text="Field 1", confidence=0.82, bbox=[[0, 0], [10, 0], [10, 10], [0, 10]], engine="paddleocr"),
        TextPolygon(text="Field 2", confidence=0.85, bbox=[[0, 20], [10, 20], [10, 30], [0, 30]], engine="paddleocr"),
        TextPolygon(text="Field 3", confidence=0.80, bbox=[[0, 40], [10, 40], [10, 50], [0, 50]], engine="paddleocr"),
    ]

    # With high threshold (0.90), avg_conf 0.82 triggers ensemble
    mock_paddle = MockOCREngine("paddleocr", paddle_tokens)
    mock_easy = MockOCREngine("easyocr", [])
    mock_trocr = MockOCREngine("trocr", [])

    ensemble_high_thresh = AdaptiveOCREnsemble(
        confidence_threshold=0.90,
        primary_engine=mock_paddle,
        secondary_engine=mock_easy,
        tertiary_engine=mock_trocr,
    )
    result = ensemble_high_thresh.process(np.zeros((50, 50, 3), dtype=np.uint8))
    assert mock_easy.call_count == 1
    assert result.engine_name.startswith("ensemble")

    # With low threshold (0.70), avg_conf 0.82 does NOT trigger ensemble
    mock_paddle.call_count = 0
    mock_easy.call_count = 0
    ensemble_low_thresh = AdaptiveOCREnsemble(
        confidence_threshold=0.70,
        primary_engine=mock_paddle,
        secondary_engine=mock_easy,
        tertiary_engine=mock_trocr,
    )
    result_low = ensemble_low_thresh.process(np.zeros((50, 50, 3), dtype=np.uint8))
    assert mock_easy.call_count == 0
    assert result_low.engine_name == "paddleocr"
    assert result_low.engine_agreement_score == 1.0
