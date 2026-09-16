import os
from typing import List, Dict, Any, Tuple
from core.image_utils import compute_sharpness
from core.logger import logger
from pipeline.ensemble_pipeline import ensemble_scan
from ocr.paddle_engine import run_paddle_ocr
from ocr.easyocr_engine import run_easyocr
from pipeline.field_extractor import extract_fields

def process_burst_frames(frame_paths: List[str], face_label: str = "front") -> Dict[str, Any]:
    """
    Evaluates 1 to 3 burst frames:
    1. Ranks frames by sharpness.
    2. Runs ensemble OCR on the sharpest frame.
    3. Scans secondary frames only for missing fields.
    """
    if not frame_paths:
        return {"error": "No frames provided"}

    scored_frames: List[Tuple[str, float]] = []
    for p in frame_paths:
        if os.path.exists(p):
            sharpness = compute_sharpness(p)
            scored_frames.append((p, sharpness))

    if not scored_frames:
        return {"error": "No valid frames found"}

    scored_frames.sort(key=lambda x: x[1], reverse=True)
    best_frame, best_sharpness = scored_frames[0]
    logger.info(f"[BurstFusion] Best frame: {os.path.basename(best_frame)} (sharpness: {best_sharpness:.1f})")

    # Primary pass on best frame
    primary_report = ensemble_scan(best_frame)
    fields = dict(primary_report.get("fields", {}))
    missing_keys = [k for k, v in fields.items() if not v.get("found", False)]

    secondary_contributions = []
    if missing_keys and len(scored_frames) > 1:
        logger.info(f"[BurstFusion] Checking {len(scored_frames)-1} secondary frames for missing fields: {missing_keys}")
        for sec_path, _ in scored_frames[1:]:
            if not missing_keys:
                break
            try:
                paddle_res = run_paddle_ocr(sec_path)
                easy_res = run_easyocr(sec_path)
                sec_fields, _, _ = extract_fields(paddle_res + easy_res)

                recovered = []
                for k in list(missing_keys):
                    if sec_fields.get(k, {}).get("found", False):
                        fields[k] = sec_fields[k]
                        missing_keys.remove(k)
                        recovered.append(k)

                if recovered:
                    secondary_contributions.append({
                        "frame": os.path.basename(sec_path),
                        "recovered_fields": recovered
                    })
            except Exception as e:
                logger.error(f"[BurstFusion] Secondary frame scan error: {e}")

    found_count = sum(1 for v in fields.values() if v.get("found", False))
    total_count = len(fields)
    compliance_score = round((found_count / total_count) * 100, 1) if total_count else 0.0

    return {
        "face_label": face_label,
        "primary_frame": os.path.basename(best_frame),
        "sharpness_scores": [{"frame": os.path.basename(p), "score": round(s, 1)} for p, s in scored_frames],
        "fields": fields,
        "fields_found": found_count,
        "total_fields": total_count,
        "compliance_score": compliance_score,
        "user_instructions": primary_report.get("user_instructions"),
        "secondary_contributions": secondary_contributions,
        "elapsed_seconds": primary_report.get("elapsed_seconds")
    }
