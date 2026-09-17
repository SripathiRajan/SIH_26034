import os
import re
from typing import Dict, Any, List
from pipeline.field_rules import MANDATORY_FIELDS

ALLOWED_METRIC_UNITS = {
    "g", "gm", "gms", "g.", "kg", "ml", "l", "ltr", "litre", "litres",
    "m", "cm", "mm", "count", "units", "unit", "tablets", "capsules", "n", "u"
}

EXTRACTION_CONFIDENCE_THRESHOLD = 0.60

def generate_compliance_report(
    extracted_fields: Dict[str, Any],
    flap_info: Dict[str, Any],
    image_path: str,
    elapsed: float
) -> Dict[str, Any]:
    """
    Evaluates extracted statutory declarations against Legal Metrology & FSSAI standards.
    Ports FieldValidators:
      - Confidence-gating: extractions with confidence < 0.60 flagged as 'needs_review'
      - Unit validation: Rule 6(1)(c) metric unit whitelist check
      - Tax inclusion: Rule 6(1)(e) 'inclusive of all taxes' check
    """
    total = len(MANDATORY_FIELDS)
    violations: List[Dict[str, Any]] = []
    user_instructions: List[Dict[str, Any]] = []

    compliant_keys = []
    non_compliant_keys = []
    review_keys = []
    flap_fields = []

    for k, v in extracted_fields.items():
        found = v.get("found", False)
        conf = float(v.get("confidence", 0.0))
        val_text = str(v.get("value") or "")
        captured = str(v.get("captured") or "")

        if not found:
            if v.get("location") == "SEE_FLAP":
                flap_fields.append(k)
                violations.append({
                    "field": v["label"],
                    "rule_reference": v["rule"],
                    "status": "STAMP_ON_FLAP"
                })
            else:
                non_compliant_keys.append(k)
                violations.append({
                    "field": v["label"],
                    "rule_reference": v["rule"],
                    "status": "MISSING"
                })
            continue

        # Check extraction confidence
        if conf < EXTRACTION_CONFIDENCE_THRESHOLD:
            v["needs_review"] = True
            v["review_reason"] = f"Low extraction confidence ({conf:.2f} < {EXTRACTION_CONFIDENCE_THRESHOLD:.2f}) — requires manual verification"
            review_keys.append(k)

        # Field-specific statutory validations
        if k == "net_quantity":
            # Check unit against standard metric units whitelist
            unit_match = re.search(r"([a-z]+|\b[nu]\b)\.?$", captured.lower().strip())
            unit = unit_match.group(1) if unit_match else ""
            if unit and unit not in ALLOWED_METRIC_UNITS:
                v["is_valid"] = False
                v["violation_reason"] = f"Non-standard unit '{unit}' declared. Must use standard metric units (LM Rule §6(1)(c))"
                violations.append({
                    "field": v["label"],
                    "rule_reference": v["rule"],
                    "status": "NON_METRIC_UNIT",
                    "detail": v["violation_reason"]
                })
                non_compliant_keys.append(k)
                continue

        if k == "mrp":
            # Check for statutory 'inclusive of all taxes' declaration
            has_tax = bool(re.search(r"(?:incl\.?|inclusive)\s*(?:of\s*)?(?:all\s*)?taxes?", val_text, re.IGNORECASE))
            if not has_tax:
                v["tax_inclusive_warning"] = "MRP declared without explicit '(inclusive of all taxes)' statement (LM Rule §6(1)(e))"

        if k not in review_keys:
            compliant_keys.append(k)

    score = round(len(compliant_keys) / total * 100, 1) if total else 0.0

    if flap_fields and flap_info.get("flap_detected"):
        labels_on_flap = [extracted_fields[k]["label"] for k in flap_fields]
        user_instructions.append({
            "action": "FLIP_PACKAGE_AND_PHOTOGRAPH",
            "trigger_text": flap_info.get("pointer_text"),
            "target_fields": labels_on_flap,
            "instruction": (
                f"📸 ACTION REQUIRED: Detected '{flap_info.get('pointer_text')}' on package. "
                f"Please flip the package and take a photo of the bottom/flap to capture: {', '.join(labels_on_flap)}."
            )
        })

    # Determine overall status
    if non_compliant_keys:
        overall_status = "NON-COMPLIANT"
    elif flap_fields:
        overall_status = "ACTION_REQUIRED"
    elif review_keys:
        overall_status = "NEEDS_REVIEW"
    else:
        overall_status = "COMPLIANT"

    return {
        "image": os.path.basename(image_path),
        "elapsed_seconds": round(elapsed, 2),
        "compliance_score": score,
        "overall_status": overall_status,
        "total_fields": total,
        "fields_found": len(compliant_keys) + len(review_keys),
        "fields_missing": len(non_compliant_keys),
        "fields_on_flap": len(flap_fields),
        "fields_needs_review": len(review_keys),
        "fields": extracted_fields,
        "details": extracted_fields,
        "violations": violations,
        "user_instructions": user_instructions
    }
