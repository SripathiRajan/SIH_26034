# pipeline/spatial_merger.py
"""
Geometric Polygon IoU spatial merger.

Problem being solved: PaddleOCR, EasyOCR, and SuryaOCR all detect the same
text region but with slightly different bounding boxes. The existing
field_extractor.py uses exact text-string dedup (seen = set()) which fails
when two engines return slightly different transcriptions of the same physical
text ("Rs.45" vs "Rs 45"). Result: duplicate entries confuse regex matching.

Solution: cluster bounding boxes by geometric IoU overlap >= 0.45 first,
then keep the text from the box with the highest confidence score.
Finally sort all surviving boxes in natural human reading order
(top-to-bottom primary, left-to-right secondary).
"""
import numpy as np
from typing import List, Dict, Any


def _poly_to_rect(box) -> tuple:
    """Convert any polygon (list of [x,y] points) to (x1, y1, x2, y2)."""
    pts = np.array(box, dtype=np.float32)
    return float(pts[:, 0].min()), float(pts[:, 1].min()), \
           float(pts[:, 0].max()), float(pts[:, 1].max())


def _iou(box_a: tuple, box_b: tuple) -> float:
    """Axis-aligned bounding box IoU."""
    ax1, ay1, ax2, ay2 = box_a
    bx1, by1, bx2, by2 = box_b

    ix1, iy1 = max(ax1, bx1), max(ay1, by1)
    ix2, iy2 = min(ax2, bx2), min(ay2, by2)

    inter_w = max(0.0, ix2 - ix1)
    inter_h = max(0.0, iy2 - iy1)
    inter = inter_w * inter_h

    if inter == 0.0:
        return 0.0

    area_a = max(0.0, ax2 - ax1) * max(0.0, ay2 - ay1)
    area_b = max(0.0, bx2 - bx1) * max(0.0, by2 - by1)
    union = area_a + area_b - inter

    return inter / union if union > 0.0 else 0.0


def merge_and_sort(
    all_results: List[Dict[str, Any]],
    iou_threshold: float = 0.45
) -> List[Dict[str, Any]]:
    """
    1. Cluster overlapping boxes (IoU >= iou_threshold) across all OCR engines.
    2. Within each cluster, keep the candidate with the highest confidence.
    3. Sort surviving boxes in reading order: top-to-bottom (Y), then
       left-to-right (X) within the same horizontal band.

    Args:
        all_results: Combined list of OCR result dicts from all engines.
                     Each dict must have: 'text', 'confidence', 'box', 'source'
        iou_threshold: Boxes with overlap >= this value are treated as same region.

    Returns:
        Deduplicated, reading-order sorted list of result dicts.
    """
    if not all_results:
        return []

    # Convert all boxes to (x1, y1, x2, y2) for IoU computation
    rects = [_poly_to_rect(r["box"]) for r in all_results]

    used = [False] * len(all_results)
    clusters = []

    for i in range(len(all_results)):
        if used[i]:
            continue
        cluster = [i]
        used[i] = True
        for j in range(i + 1, len(all_results)):
            if not used[j] and _iou(rects[i], rects[j]) >= iou_threshold:
                cluster.append(j)
                used[j] = True
        clusters.append(cluster)

    # From each cluster, pick the highest-confidence result
    merged = []
    for cluster in clusters:
        best = max(cluster, key=lambda idx: all_results[idx].get("confidence", 0.0))
        merged.append(all_results[best])

    # Reading order sort: band height = average box height
    avg_h = np.mean([r[3] - r[1] for r in rects]) if rects else 20.0
    band_h = max(avg_h * 0.6, 10.0)

    def reading_order_key(item):
        box = _poly_to_rect(item["box"])
        band_row = int(box[1] / band_h)  # vertical band index
        return (band_row, box[0])        # then sort by left edge

    merged.sort(key=reading_order_key)
    return merged
