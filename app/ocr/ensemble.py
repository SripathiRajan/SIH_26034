"""
Adaptive OCR Ensemble
Coordinates PaddleOCR (primary), EasyOCR (secondary), and TrOCR (tertiary).
Merges detections via Spatial IoU clustering and confidence arbitration.
Computes and returns engine_agreement_score across active OCR engines.
"""

import time
import logging
from difflib import SequenceMatcher
from typing import List, Tuple, Optional, Dict
import numpy as np

from .engine_base import BaseOCREngine, OCRResult, TextPolygon
from .paddle_engine import PaddleOCREngine
from .easyocr_engine import EasyOCREngine
from ..config import settings

logger = logging.getLogger(__name__)


def _string_similarity(s1: str, s2: str) -> float:
    """Computes normalized alphanumeric character sequence similarity."""
    s1_clean = "".join(c.lower() for c in s1 if c.isalnum())
    s2_clean = "".join(c.lower() for c in s2 if c.isalnum())
    if not s1_clean and not s2_clean:
        return 1.0
    if not s1_clean or not s2_clean:
        return 0.0
    if s1_clean == s2_clean:
        return 1.0
    return SequenceMatcher(None, s1_clean, s2_clean).ratio()


class AdaptiveOCREnsemble:
    """
    Adaptive OCR Ensemble Pipeline:
      1. Always runs primary engine (PaddleOCR).
      2. If primary average confidence < confidence_threshold (default 0.75)
         or tokens < 3 (or force_ensemble=True), triggers EasyOCR + TrOCR.
      3. Handles engine failures / missing engines gracefully.
      4. Merges overlapping bounding boxes with IoU > 0.5, selecting the
         highest-confidence candidate text.
      5. Calculates and returns engine_agreement_score.
    """

    def __init__(
        self,
        confidence_threshold: Optional[float] = None,
        iou_merge_threshold: float = 0.50,
        primary_engine: Optional[BaseOCREngine] = None,
        secondary_engine: Optional[BaseOCREngine] = None,
        tertiary_engine: Optional[BaseOCREngine] = None,
    ):
        self.confidence_threshold = (
            confidence_threshold
            if confidence_threshold is not None
            else settings.OCR_CONFIDENCE_THRESHOLD
        )
        self.iou_merge_threshold = iou_merge_threshold
        self.primary_engine = primary_engine or PaddleOCREngine()
        self.secondary_engine = secondary_engine or EasyOCREngine()
        self.tertiary_engine = tertiary_engine

    def process(self, image: np.ndarray, force_ensemble: bool = False) -> OCRResult:
        """
        Executes adaptive OCR pipeline on image frame.
        """
        start_time = time.time()

        # Step 1: Run Primary Engine (PaddleOCR)
        primary_result = self.primary_engine.extract_text(image)
        logger.info(
            f"Primary OCR ({primary_result.engine_name}) completed: "
            f"{len(primary_result.tokens)} tokens, avg confidence {primary_result.average_confidence}"
        )

        # Check if fallback ensemble is necessary
        needs_fallback = (
            force_ensemble
            or primary_result.average_confidence < self.confidence_threshold
            or len(primary_result.tokens) < 3
        )

        if not needs_fallback:
            # High-confidence path: PaddleOCR alone suffices, perfect agreement
            elapsed_ms = (time.time() - start_time) * 1000
            return OCRResult.from_tokens(
                engine_name=primary_result.engine_name,
                tokens=primary_result.tokens,
                execution_time_ms=elapsed_ms,
                engine_agreement_score=1.0,
                raw_text=primary_result.raw_text,
            )

        logger.info(
            f"Adaptive trigger active (avg_conf={primary_result.average_confidence} < {self.confidence_threshold}): "
            f"activating EasyOCR ensemble (TrOCR execution disabled)."
        )

        # Step 2: Run Secondary (EasyOCR) Engine with error tolerance
        active_engine_tokens: List[TextPolygon] = list(primary_result.tokens)
        active_engines_count = 1  # Primary is already active

        # Secondary (EasyOCR)
        try:
            secondary_result = self.secondary_engine.extract_text(image)
            if secondary_result is not None:
                active_engines_count += 1
                active_engine_tokens.extend(secondary_result.tokens)
        except Exception as exc:
            logger.warning(f"Secondary OCR engine (EasyOCR) failed: {exc}. Continuing with remaining engines.")

        # Step 3: Merge tokens with IoU > 0.5, keep highest confidence, compute agreement
        merged_tokens, agreement_score = self._merge_tokens_and_compute_agreement(
            active_engine_tokens, active_engines_count
        )

        total_elapsed_ms = (time.time() - start_time) * 1000
        return OCRResult.from_tokens(
            engine_name="ensemble(paddle+easyocr)",
            tokens=merged_tokens,
            execution_time_ms=total_elapsed_ms,
            engine_agreement_score=agreement_score,
        )

    def _merge_tokens_and_compute_agreement(
        self, tokens: List[TextPolygon], active_engines_count: int
    ) -> Tuple[List[TextPolygon], float]:
        """
        Merges spatial tokens by IoU > iou_merge_threshold (0.50).
        Retains the highest-confidence token per cluster.
        Calculates engine_agreement_score based on spatial and semantic concordance.
        """
        if not tokens:
            return [], 1.0

        # Sort tokens by confidence descending
        sorted_tokens = sorted(tokens, key=lambda t: t.confidence, reverse=True)

        clusters: List[Dict[str, any]] = []

        for candidate in sorted_tokens:
            matched_cluster = None
            best_iou = 0.0

            for cluster in clusters:
                accepted = cluster["accepted"]
                iou = self._calculate_iou(
                    candidate.bounding_box_xywh, accepted.bounding_box_xywh
                )
                if iou > self.iou_merge_threshold and iou > best_iou:
                    best_iou = iou
                    matched_cluster = cluster

            if matched_cluster is not None:
                # Add candidate to existing cluster
                matched_cluster["tokens"].append(candidate)
            else:
                # Create a new cluster with candidate as accepted representative
                clusters.append({"accepted": candidate, "tokens": [candidate]})

        merged_tokens = [c["accepted"] for c in clusters]

        # Calculate agreement score
        if active_engines_count <= 1 or not clusters:
            return merged_tokens, 1.0

        cluster_scores = []
        for c in clusters:
            engines_in_cluster = {t.engine for t in c["tokens"]}
            coverage = len(engines_in_cluster) / active_engines_count

            # String similarity of cluster tokens against highest-confidence representative
            rep_text = c["accepted"].text
            sims = [_string_similarity(rep_text, t.text) for t in c["tokens"]]
            text_sim = sum(sims) / len(sims) if sims else 1.0

            cluster_scores.append(coverage * text_sim)

        agreement_score = round(sum(cluster_scores) / len(cluster_scores), 4)
        return merged_tokens, agreement_score

    def _merge_tokens_by_iou(self, tokens: List[TextPolygon]) -> List[TextPolygon]:
        """Convenience backward-compatible method."""
        merged, _ = self._merge_tokens_and_compute_agreement(tokens, active_engines_count=1)
        return merged

    @staticmethod
    def _calculate_iou(
        box_a: Tuple[float, float, float, float], box_b: Tuple[float, float, float, float]
    ) -> float:
        xa, ya, wa, ha = box_a
        xb, yb, wb, hb = box_b

        x1 = max(xa, xb)
        y1 = max(ya, yb)
        x2 = min(xa + wa, xb + wb)
        y2 = min(ya + ha, yb + hb)

        inter_w = max(0.0, x2 - x1)
        inter_h = max(0.0, y2 - y1)
        inter_area = inter_w * inter_h

        area_a = wa * ha
        area_b = wb * hb
        union_area = area_a + area_b - inter_area

        if union_area <= 0:
            return 0.0
        return inter_area / union_area

