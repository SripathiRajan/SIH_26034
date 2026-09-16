import os
from typing import Dict, Any
from pipeline.field_rules import MANDATORY_FIELDS

def generate_compliance_report(extracted_fields: Dict[str, Any], flap_info: Dict[str, Any], image_path: str, elapsed: float) -> Dict[str, Any]:
    compliant = [k for k, v in extracted_fields.items() if v["found"]]
    non_compliant = [k for k, v in extracted_fields.items() if not v["found"]]
    flap_fields = [k for k, v in extracted_fields.items() if not v["found"] and v["location"] == "SEE_FLAP"]

    total = len(MANDATORY_FIELDS)
    score = round(len(compliant) / total * 100, 1) if total else 0.0

    if score == 100.0:
        overall_status = "COMPLIANT"
    elif flap_fields:
        overall_status = "ACTION_REQUIRED"
    else:
        overall_status = "NON-COMPLIANT"

    user_instructions = []
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

    violations = []
    for k in non_compliant:
        violations.append({
            "field": extracted_fields[k]["label"],
            "rule_reference": extracted_fields[k]["rule"],
            "status": "STAMP_ON_FLAP" if extracted_fields[k]["location"] == "SEE_FLAP" else "MISSING"
        })

    return {
        "image": os.path.basename(image_path),
        "elapsed_seconds": round(elapsed, 2),
        "compliance_score": score,
        "overall_status": overall_status,
        "total_fields": total,
        "fields_found": len(compliant),
        "fields_missing": len(non_compliant),
        "fields_on_flap": len(flap_fields),
        "fields": extracted_fields,  # Standardized key
        "details": extracted_fields, # Backward compatibility
        "violations": violations,
        "user_instructions": user_instructions
    }
