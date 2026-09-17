#!/usr/bin/env python3
"""
PRAMAN v4 Accuracy & Precision Evaluation Harness
Measures field extraction Precision, Recall, and F1 score against annotated ground truth.
"""

import os
import sys
import json
import logging
from typing import Dict, Any, List

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from pipeline.field_extractor import extract_fields
from pipeline.compliance_engine import generate_compliance_report
from pipeline.field_rules import MANDATORY_FIELDS

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
logger = logging.getLogger("eval_accuracy")

ANNOTATIONS_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "eval", "annotations", "sample_packaging.json")


def evaluate_dataset(annotations_file: str = ANNOTATIONS_PATH) -> Dict[str, Any]:
    if not os.path.exists(annotations_file):
        logger.error(f"Annotations file not found: {annotations_file}")
        return {}

    with open(annotations_file, "r", encoding="utf-8") as f:
        samples: List[Dict[str, Any]] = json.load(f)

    field_stats = {
        k: {"tp": 0, "fp": 0, "fn": 0, "tn": 0}
        for k in MANDATORY_FIELDS
    }
    flap_stats = {"tp": 0, "fp": 0, "fn": 0, "tn": 0}

    total_samples = len(samples)
    logger.info(f"Evaluating accuracy across {total_samples} benchmark sample(s)...")

    for idx, sample in enumerate(samples):
        # Synthesize OCR tokens based on annotated declarations for evaluation
        gt_fields = sample.get("ground_truth_fields", {})
        ocr_tokens = []

        if sample.get("flap_pointer", {}).get("present"):
            ocr_tokens.append({"text": sample["flap_pointer"]["text"], "confidence": 0.95, "source": "paddle"})

        if gt_fields.get("net_quantity", {}).get("declared"):
            mag = gt_fields["net_quantity"].get("magnitude", 100)
            u = gt_fields["net_quantity"].get("unit", "g")
            ocr_tokens.append({"text": f"Net Qty: {mag} {u}", "confidence": 0.94, "source": "paddle"})

        if gt_fields.get("mrp", {}).get("declared"):
            amt = gt_fields["mrp"].get("amount", 50.0)
            ocr_tokens.append({"text": f"MRP: Rs. {amt:.2f} (Incl. of all taxes)", "confidence": 0.93, "source": "paddle"})

        if gt_fields.get("manufacturer", {}).get("declared"):
            mfg_txt = gt_fields["manufacturer"].get("text", "ABC Pvt Ltd")
            ocr_tokens.append({"text": f"Manufactured by {mfg_txt}", "confidence": 0.91, "source": "paddle"})

        if gt_fields.get("manufacture_date", {}).get("declared"):
            d_str = gt_fields["manufacture_date"].get("date_string", "06/2026")
            ocr_tokens.append({"text": f"Date of Pkg: {d_str}", "confidence": 0.90, "source": "paddle"})

        if gt_fields.get("use_by", {}).get("declared"):
            e_str = gt_fields["use_by"].get("date_string", "12/2026")
            ocr_tokens.append({"text": f"Best Before: {e_str}", "confidence": 0.89, "source": "paddle"})

        if gt_fields.get("consumer_care", {}).get("declared"):
            c_str = gt_fields["consumer_care"].get("contact", "1800-111-222")
            ocr_tokens.append({"text": f"Consumer Helpline: {c_str}", "confidence": 0.92, "source": "paddle"})

        if gt_fields.get("fssai", {}).get("declared"):
            lic = gt_fields["fssai"].get("license_no", "10015043001129")
            ocr_tokens.append({"text": f"FSSAI Lic. No: {lic}", "confidence": 0.95, "source": "paddle"})

        if gt_fields.get("country_of_origin", {}).get("declared"):
            co = gt_fields["country_of_origin"].get("country", "India")
            ocr_tokens.append({"text": f"Country of Origin: {co}", "confidence": 0.92, "source": "paddle"})

        # Run extraction
        extracted, full_text, flap_info = extract_fields(ocr_tokens)

        # Flap detection metrics
        expected_flap = sample.get("flap_pointer", {}).get("present", False)
        actual_flap = flap_info.get("flap_detected", False)
        if expected_flap and actual_flap:
            flap_stats["tp"] += 1
        elif not expected_flap and actual_flap:
            flap_stats["fp"] += 1
        elif expected_flap and not actual_flap:
            flap_stats["fn"] += 1
        else:
            flap_stats["tn"] += 1

        # Field extraction metrics
        for f_key in MANDATORY_FIELDS:
            expected_declared = gt_fields.get(f_key, {}).get("declared", False)
            actual_found = extracted[f_key]["found"]

            if expected_declared and actual_found:
                field_stats[f_key]["tp"] += 1
            elif not expected_declared and actual_found:
                field_stats[f_key]["fp"] += 1
            elif expected_declared and not actual_found:
                field_stats[f_key]["fn"] += 1
            else:
                field_stats[f_key]["tn"] += 1

    # Output metrics
    results = {}
    print("\n" + "=" * 76)
    print(f"{'Field':<25} | {'Precision':<10} | {'Recall':<10} | {'F1-Score':<10} | {'Support'}")
    print("-" * 76)

    total_tp = 0
    total_fp = 0
    total_fn = 0

    for f_key, stats in field_stats.items():
        tp, fp, fn = stats["tp"], stats["fp"], stats["fn"]
        total_tp += tp
        total_fp += fp
        total_fn += fn

        prec = tp / (tp + fp) if (tp + fp) > 0 else 1.0
        rec = tp / (tp + fn) if (tp + fn) > 0 else 1.0
        f1 = (2 * prec * rec) / (prec + rec) if (prec + rec) > 0 else 0.0

        results[f_key] = {"precision": round(prec, 3), "recall": round(rec, 3), "f1": round(f1, 3), "support": tp + fn}
        print(f"{f_key:<25} | {prec*100:>8.1f}% | {rec*100:>8.1f}% | {f1:>9.3f}  | {tp+fn:>5}")

    macro_prec = total_tp / (total_tp + total_fp) if (total_tp + total_fp) > 0 else 1.0
    macro_rec = total_tp / (total_tp + total_fn) if (total_tp + total_fn) > 0 else 1.0
    macro_f1 = (2 * macro_prec * macro_rec) / (macro_prec + macro_rec) if (macro_prec + macro_rec) > 0 else 0.0

    print("=" * 76)
    print(f"{'OVERALL MACRO':<25} | {macro_prec*100:>8.1f}% | {macro_rec*100:>8.1f}% | {macro_f1:>9.3f}  | {total_tp+total_fn:>5}")
    print("=" * 76 + "\n")

    return results


if __name__ == "__main__":
    evaluate_dataset()
