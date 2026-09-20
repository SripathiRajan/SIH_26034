from typing import List, Dict, Any, Optional
import re
from core.config import COMPLIANCE_PASS_THRESHOLD

def normalize_str(s: Optional[str]) -> str:
    if not s:
        return ""
    return re.sub(r"[^\w\s]", "", str(s)).strip().lower()

def check_quantity_match(ocr_qty: str, gtin_qty: str) -> Dict[str, Any]:
    norm_ocr = normalize_str(ocr_qty)
    norm_gtin = normalize_str(gtin_qty)
    match = norm_ocr == norm_gtin or (norm_ocr in norm_gtin) or (norm_gtin in norm_ocr)
    return {
        "matched": match,
        "ocr_qty": ocr_qty,
        "gtin_qty": gtin_qty,
        "status": "MATCH" if match else "MISMATCH"
    }

def check_mrp_in_range(ocr_mrp_str: str, mrp_range: Optional[Dict[str, float]]) -> Dict[str, Any]:
    if not mrp_range or not ocr_mrp_str:
        return {"status": "NO_BASELINE", "mrp": ocr_mrp_str}

    match = re.search(r"(\d+(?:\.\d+)?)", ocr_mrp_str.replace(",", ""))
    if not match:
        return {"status": "UNPARSED", "mrp": ocr_mrp_str}

    val = float(match.group(1))
    min_val = mrp_range.get("min", 0.0)
    max_val = mrp_range.get("max", float("inf"))
    within_range = min_val <= val <= max_val
    return {
        "status": "WITHIN_RANGE" if within_range else "OUT_OF_RANGE",
        "ocr_mrp": val,
        "expected_min": min_val,
        "expected_max": max_val
    }

def merge_package_faces(
    face_results: List[Dict[str, Any]],
    gtin_data: Optional[Dict[str, Any]] = None,
    package_type: str = "box"
) -> Dict[str, Any]:
    """Merges declarations found across package faces and cross-verifies with GTIN master data."""
    merged_fields: Dict[str, Dict[str, Any]] = {}
    faces_scanned = []
    user_instructions = []

    for face in face_results:
        label = face.get("face_label", "unknown")
        faces_scanned.append(label)

        if face.get("user_instructions"):
            for inst in face["user_instructions"]:
                if inst not in user_instructions:
                    user_instructions.append(inst)

        fields = face.get("fields", {})
        for field_name, f_data in fields.items():
            if field_name not in merged_fields:
                merged_fields[field_name] = {
                    "label": f_data.get("label", field_name),
                    "rule": f_data.get("rule", ""),
                    "found": False,
                    "value": None,
                    "confidence": 0.0,
                    "found_on_face": None,
                    "source": None
                }

            if f_data.get("found", False):
                curr_conf = merged_fields[field_name]["confidence"]
                new_conf = f_data.get("confidence", 0.0)
                if not merged_fields[field_name]["found"] or new_conf > curr_conf:
                    merged_fields[field_name]["found"] = True
                    merged_fields[field_name]["value"] = f_data.get("value")
                    merged_fields[field_name]["confidence"] = new_conf
                    merged_fields[field_name]["found_on_face"] = label
                    merged_fields[field_name]["source"] = f_data.get("source")
                    for extra_key in ("is_valid", "needs_review", "review_reason", "violation_reason", "captured", "location", "failure_class"):
                        if extra_key in f_data:
                            merged_fields[field_name][extra_key] = f_data[extra_key]
            else:
                if not merged_fields[field_name]["found"]:
                    for extra_key in ("is_valid", "needs_review", "review_reason", "violation_reason", "captured", "location", "failure_class"):
                        if extra_key in f_data and f_data[extra_key] is not None:
                            merged_fields[field_name][extra_key] = f_data[extra_key]


    total_fields = len(merged_fields)
    found_count = sum(1 for v in merged_fields.values() if v.get("found", False))
    missing_fields = [v["label"] for v in merged_fields.values() if not v.get("found", False)]
    compliance_score = round((found_count / total_fields) * 100, 1) if total_fields else 0.0

    gtin_verification = {
        "gtin_provided": bool(gtin_data and gtin_data.get("found")),
        "checks": {}
    }

    if gtin_data and gtin_data.get("found"):
        gtin_prod = gtin_data

        # 1. Brand matching
        gtin_brand = gtin_prod.get("brand")
        ocr_mfg = merged_fields.get("manufacturer", {}).get("value")
        if gtin_brand and ocr_mfg:
            norm_brand = normalize_str(gtin_brand)
            norm_mfg = normalize_str(ocr_mfg)
            brand_matched = norm_brand in norm_mfg or norm_mfg in norm_brand
            gtin_verification["checks"]["brand"] = {
                "matched": brand_matched,
                "gtin_brand": gtin_brand,
                "ocr_manufacturer": ocr_mfg,
                "status": "PASS" if brand_matched else "REVIEW"
            }

        # 2. Net quantity check
        gtin_qty = gtin_prod.get("declared_net_qty")
        ocr_qty = merged_fields.get("net_quantity", {}).get("value")
        if gtin_qty and ocr_qty:
            gtin_verification["checks"]["net_quantity"] = check_quantity_match(ocr_qty, gtin_qty)

        # 3. MRP range check
        mrp_range = gtin_prod.get("expected_mrp_range")
        ocr_mrp = merged_fields.get("mrp", {}).get("value")
        if mrp_range and ocr_mrp:
            gtin_verification["checks"]["mrp_range"] = check_mrp_in_range(ocr_mrp, mrp_range)

    # Filter out instructions whose target fields have now been detected on another face
    active_instructions = []
    for inst in user_instructions:
        if isinstance(inst, dict) and "target_fields" in inst:
            if any(tf in missing_fields for tf in inst["target_fields"]):
                active_instructions.append(inst)
        else:
            active_instructions.append(inst)

    # Status verdict based on configurable threshold
    if compliance_score >= COMPLIANCE_PASS_THRESHOLD and not active_instructions:
        overall_status = "COMPLIANT"
        verdict_message = "All mandatory statutory declarations are present and compliant with Legal Metrology 2011 & FSSAI."
    elif active_instructions:
        overall_status = "ACTION_REQUIRED"
        verdict_message = "A declaration pointer was detected directing to inspect package bottom/flaps for MRP/expiry."
    else:
        overall_status = "NON_COMPLIANT"
        verdict_message = f"Missing mandatory declarations: {', '.join(missing_fields[:3])}."

    return {
        "overall_status": overall_status,
        "verdict_message": verdict_message,
        "package_type": package_type,
        "faces_scanned": faces_scanned,
        "compliance_score": compliance_score,
        "fields_found": found_count,
        "total_fields": total_fields,
        "missing_fields": missing_fields,
        "merged_fields": merged_fields,
        "fields": merged_fields,
        "user_instructions": active_instructions,
        "gtin_verification": gtin_verification
    }
