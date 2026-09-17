import os
import time
import cv2
import numpy as np
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Dict, Any, List

from core.image_utils import resize_for_ocr, enhance_image
from core.config import BASE_DIR
from core.logger import logger
from ocr.paddle_engine import run_paddle_ocr
from ocr.easyocr_engine import run_easyocr
from ocr.surya_engine import run_surya_ocr
from ocr.vlm_engine import run_vlm_ocr
from pipeline.field_rules import MANDATORY_FIELDS, VLM_CRITICAL_FIELDS
from pipeline.field_extractor import extract_fields
from pipeline.compliance_engine import generate_compliance_report

def ensemble_scan(
    image_path: str,
    save_annotation: bool = True,
    enable_vlm_fallback: bool = False,
    use_ensemble: bool = False,
) -> Dict[str, Any]:
    """
    Production OCR Pipeline (CB1 engines + CB2 cascaded gating + spatial merge):

    Stage 0: Resize cap (1600px long edge)
    Stage 0.5: Perspective deskew + glare check
    Stage 1: PaddleOCR (Tier 1 — fast path)
              → conf >= 0.60 or valid detections without explicit ensemble request → SKIP TIER 2
    Stage 2: EasyOCR + SuryaOCR in parallel (Tier 2 — deep ensemble/recovery)
    Stage 2.5: CLAHE enhance + PaddleOCR retry for residual missing fields
    Stage 3: Florence-2 VLM (Tier 3 — only if critical fields still missing AND requested)
    Stage 4: Geometric IoU spatial merge + reading order sort
    Stage 5: Field extraction + compliance report generation
    """
    from core.image_utils import deskew_perspective, check_glare
    from pipeline.spatial_merger import merge_and_sort
    from core.config import OCR_CONFIDENCE_THRESHOLD, IOU_MERGE_THRESHOLD

    logger.info(f"Starting OCR scan on: {os.path.basename(image_path)} (use_ensemble={use_ensemble})")
    t_start = time.time()

    deskew_path = None
    active_path, is_temp = resize_for_ocr(image_path)

    try:
        # Stage 0.5: Deskew (skip original, use deskewed copy if successful)
        maybe_deskewed = deskew_perspective(active_path)
        if maybe_deskewed != active_path:
            deskew_path = maybe_deskewed
            active_path = maybe_deskewed

        # Glare check (log warning only — don't hard-reject; let pipeline try)
        glare_ok, glare_ratio = check_glare(active_path)
        if not glare_ok:
            logger.warning(f"High glare detected ({glare_ratio:.2%}) — OCR accuracy may be reduced")

        all_results: List[Dict[str, Any]] = []

        # ── Stage 1: Tier 1 PaddleOCR ────────────────────────────────────
        paddle_results = run_paddle_ocr(active_path)
        logger.info(f"  ✓ PaddleOCR: {len(paddle_results)} regions")

        skip_tier2 = False
        if paddle_results:
            avg_conf = sum(r["confidence"] for r in paddle_results) / len(paddle_results)
            all_results.extend(paddle_results)

            # Quick field check after Tier 1 only
            fields_t1, _, flap_t1 = extract_fields(all_results)
            found_t1 = sum(1 for v in fields_t1.values() if v["found"])

            # Fast path check:
            # Only skip Tier 2 if all mandatory fields are already found (or flap pointer detected)
            unaccounted_t1 = [
                k for k, v in fields_t1.items()
                if not v["found"] and not (flap_t1.get("flap_detected") and k in {"mrp", "manufacture_date", "use_by", "net_quantity"})
            ]
            if len(unaccounted_t1) == 0 and avg_conf >= 0.60:
                logger.info(f"  ⚡ Fast exit triggered (conf={avg_conf:.2f}, all {found_t1} fields found) — skipping Tier 2")
                skip_tier2 = True
            else:
                logger.info(f"  Stage 1 found {found_t1}/{len(MANDATORY_FIELDS)} fields ({len(unaccounted_t1)} unaccounted). Proceeding with Tier 2 recovery.")

        if not skip_tier2:
            # ── Stage 2: Tier 2 EasyOCR + SuryaOCR (targeted recovery) ──────
            logger.info("  Stage 2: Low confidence or missing fields — running Tier 2 engines")
            with ThreadPoolExecutor(max_workers=2) as executor:
                futures = {
                    executor.submit(run_easyocr, active_path): "EasyOCR",
                    executor.submit(run_surya_ocr, active_path): "SuryaOCR",
                }
                for future in as_completed(futures):
                    name = futures[future]
                    try:
                        res = future.result()
                        logger.info(f"  ✓ {name}: {len(res)} regions")
                        all_results.extend(res)
                    except Exception as e:
                        logger.error(f"  ✗ {name} failed: {e}")

            # ── Stage 2.5: CLAHE retry for residual missing fields ────────────
            fields_s2, _, flap_s2 = extract_fields(all_results)
            unaccounted = [
                k for k, v in fields_s2.items()
                if not v["found"] and not (flap_s2.get("flap_detected") and k in {"mrp", "manufacture_date", "use_by", "net_quantity"})
            ]
            if unaccounted:
                logger.info(f"  Stage 2.5: CLAHE retry for {len(unaccounted)} missing fields")
                enhanced_path = enhance_image(active_path)
                try:
                    paddle_retry = run_paddle_ocr(enhanced_path)
                    logger.info(f"  ✓ CLAHE+Paddle retry: {len(paddle_retry)} regions")
                    all_results.extend(paddle_retry)
                finally:
                    if os.path.exists(enhanced_path) and enhanced_path != active_path:
                        try:
                            os.remove(enhanced_path)
                        except Exception:
                            pass

        # ── Stage 3: Tier 3 VLM (optional, critical fields only) ─────────
        if enable_vlm_fallback:
            fields_s3, _, flap_s3 = extract_fields(all_results)
            critical_missing = [
                k for k, v in fields_s3.items()
                if not v["found"] and k in VLM_CRITICAL_FIELDS
                and not (flap_s3.get("flap_detected") and k in {"mrp", "manufacture_date", "use_by"})
            ]
            if critical_missing:
                logger.info(f"  Stage 3: VLM fallback for critical missing: {critical_missing}")
                vlm_res = run_vlm_ocr(active_path)
                logger.info(f"  ✓ Florence-2 VLM: {len(vlm_res)} regions")
                all_results.extend(vlm_res)

        # ── Stage 4: Geometric IoU spatial merge + reading order sort ─────
        merged = merge_and_sort(all_results, IOU_MERGE_THRESHOLD)
        logger.info(f"  Spatial merge: {len(all_results)} raw → {len(merged)} deduplicated regions")

        # ── Stage 4.5: Natural Reading Order Line Sorting ────────────────
        try:
            from app.ocr.engine_base import TextPolygon
            from app.extraction.reading_order import ReadingOrderResolver
            tokens = [
                TextPolygon(
                    text=r.get("text", ""),
                    confidence=float(r.get("confidence", 0.85)),
                    bbox=r.get("box") or [[0.0, 0.0], [0.0, 0.0], [0.0, 0.0], [0.0, 0.0]],
                    engine=r.get("source", r.get("engine", "ensemble")),
                )
                for r in merged
                if r.get("text", "").strip()
            ]
            if tokens:
                sorted_tokens = ReadingOrderResolver().sort_tokens(tokens)
                ordered_merged = []
                for t in sorted_tokens:
                    match = next((r for r in merged if r.get("text") == t.text), None)
                    if match and match not in ordered_merged:
                        ordered_merged.append(match)
                for r in merged:
                    if r not in ordered_merged:
                        ordered_merged.append(r)
                merged = ordered_merged
                logger.info(f"  Reading order resolved: {len(merged)} regions structured into visual lines")
        except Exception as e:
            logger.warning(f"  Reading order resolution skipped: {e}")

        # ── Stage 5: Field extraction + compliance report ─────────────────
        final_fields, full_text, flap_info = extract_fields(merged)
        elapsed = time.time() - t_start
        report = generate_compliance_report(final_fields, flap_info, image_path, elapsed)

        if save_annotation:
            save_annotated_image(image_path, merged, report)

        logger.info(f"Completed in {elapsed:.2f}s | {report['compliance_score']}% | {report['overall_status']}")
        return report

    finally:
        # Clean up temp files in correct order
        if deskew_path and os.path.exists(deskew_path) and deskew_path != image_path:
            try:
                os.remove(deskew_path)
            except Exception:
                pass
        if is_temp and os.path.exists(active_path) and active_path != image_path:
            try:
                os.remove(active_path)
            except Exception:
                pass


def save_annotated_image(image_path: str, all_results: List[Dict[str, Any]], report: Dict[str, Any]):
    img = cv2.imread(image_path)
    if img is None:
        return

    colors = {
        "paddle": (0, 200, 0),
        "easyocr": (200, 140, 0),
        "surya": (0, 0, 220),
        "vlm": (180, 0, 180),
        "ensemble": (0, 200, 0)
    }

    for r in all_results:
        pts = np.array(r["box"], dtype=np.int32)
        if pts.shape == (4, 2):
            cv2.polylines(img, [pts.reshape(-1, 1, 2)], True, colors.get(r.get("source"), (128, 128, 128)), 2)
        text = r.get("text", "")[:30]
        x = int(pts[:, 0].min())
        y = max(int(pts[:, 1].min()) - 4, 12)
        cv2.putText(img, text, (x, y), cv2.FONT_HERSHEY_SIMPLEX, 0.35,
                    colors.get(r.get("source"), (128, 128, 128)), 1, cv2.LINE_AA)

    # Status banner
    status_color = (0, 180, 0) if report["overall_status"] == "COMPLIANT" else (
        (0, 165, 255) if report["overall_status"] == "ACTION_REQUIRED" else (0, 0, 220)
    )
    banner = f"{report['overall_status']} {report['compliance_score']}% ({report['fields_found']}/{report['total_fields']} fields)"
    cv2.rectangle(img, (0, 0), (img.shape[1], 36), status_color, -1)
    cv2.putText(img, banner, (10, 25), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 255), 2, cv2.LINE_AA)

    basename = os.path.splitext(os.path.basename(image_path))[0]
    out_path = os.path.join(BASE_DIR, f"ensemble_{basename}_result.png")
    cv2.imwrite(out_path, img)
