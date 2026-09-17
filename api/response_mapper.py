# api/response_mapper.py
"""
Converts ensemble_scan() output dict → ScanRecord TypeScript interface.
This is the only place format differences between the pipeline and the
mobile frontend are resolved. Nothing in the pipeline itself changes.
"""
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, List, Optional

STATUS_MAP = {
    "COMPLIANT":       "pass",
    "ACTION_REQUIRED": "warning",
    "NON-COMPLIANT":   "fail",
    "NON_COMPLIANT":   "fail",
}

COLOR_MAP = {
    "pass":    "#4CAF50",
    "warning": "#FF9800",
    "fail":    "#F44336",
}

SOURCE_DISPLAY = {
    "paddle": "paddleocr", "easyocr": "easyocr",
    "surya": "suryaocr",   "vlm": "florence2", "ensemble": "paddleocr"
}

IST = timezone(timedelta(hours=5, minutes=30))


def _map_status(pipeline_status: str) -> str:
    return STATUS_MAP.get((pipeline_status or "").upper().replace(" ", "_"), "fail")


def _field_status(field_data: Dict) -> str:
    if field_data.get("found"):
        return "pass"
    return "warning" if field_data.get("location") == "SEE_FLAP" else "fail"


def _compliance_confidence(compliance_score: float) -> int:
    """The honest 0-100 confidence that declarations were found — no clamping games."""
    return int(round(compliance_score))


def _engines_used(fields: Dict) -> List[str]:
    sources = {SOURCE_DISPLAY.get(v.get("source", ""), "paddleocr")
               for v in fields.values() if v.get("source")}
    return sorted(sources) or ["paddleocr"]


def _product_info(fields: Dict, gtin_data: Optional[Dict]) -> Dict[str, str]:
    product_name = "Unknown Product"
    brand        = "Unknown Brand"
    net_weight   = ""

    if gtin_data and gtin_data.get("found"):
        product_name = gtin_data.get("product_name") or product_name
        brand        = gtin_data.get("brand")         or brand

    mfg = fields.get("manufacturer", {})
    if mfg.get("found") and brand == "Unknown Brand":
        raw = mfg.get("captured") or mfg.get("value") or ""
        import re
        cleaned = re.sub(r"^(?:manufactured(?:\s*&\s*marketed)?|marketed|packed|mfg|mfd)\s+by[:\s]*", "", raw, flags=re.I).strip()
        cleaned = re.sub(r"^[\(\[\{I\|l][A-Za-z0-9][\)\]\}I\|l]\s*", "", cleaned).strip()
        cleaned = re.sub(r"^\([A-Za-z0-9]\)\s*", "", cleaned).strip()
        if cleaned:
            brand        = cleaned[:50].strip()
            product_name = cleaned[:100].strip()

    qty = fields.get("net_quantity", {})
    if qty.get("found"):
        net_weight = qty.get("captured") or qty.get("value") or ""

    return {"productName": product_name, "brand": brand, "netWeight": net_weight}


def _build_field_checks(fields: Dict) -> List[Dict]:
    result = []
    for field_name, data in fields.items():
        fstatus = _field_status(data)
        if fstatus == "warning":
            violation = "Declaration found on package flap — please scan bottom face"
        elif fstatus == "fail":
            violation = f"{data.get('label', field_name)} not found on any visible panel"
        else:
            violation = None

        result.append({
            "label":           data.get("label", field_name),
            "fieldName":       field_name,
            "status":          fstatus,
            "extractedValue":  data.get("value"),
            "extractedText":   data.get("value"),
            "confidence":      round(data.get("confidence", 0.0), 3),
            "ruleRef":         data.get("rule", ""),
            "ruleCitation":    data.get("rule", ""),
            "ruleExplanation": data.get("rule", ""),
            "violationReason": violation,
            "detail":          violation or (f"Extracted: {data.get('captured')}" if data.get("found") else None),
        })
    return result


def pipeline_report_to_scan_record(
    pipeline_report: Dict[str, Any],
    scan_id: str,
    image_uri: Optional[str] = None,
    gtin_data: Optional[Dict] = None,
) -> Dict[str, Any]:
    """
    Main bridge function.
    Call after ensemble_scan() to get a ScanRecord-shaped response dict.
    """
    from pipeline.rules.engine import enrich_field_checks

    pipeline_status  = pipeline_report.get("overall_status", "NON-COMPLIANT")
    status           = _map_status(pipeline_status)
    fields_dict      = pipeline_report.get("fields", {})
    compliance_score = float(pipeline_report.get("compliance_score", 0.0))
    compliance_conf  = _compliance_confidence(compliance_score)
    product_info     = _product_info(fields_dict, gtin_data)
    field_checks     = _build_field_checks(fields_dict)
    field_checks     = enrich_field_checks(field_checks)   # add statutory citations
    engines_used     = _engines_used(fields_dict)

    return {
        "id":                scan_id,
        "productName":       product_info["productName"],
        "brand":             product_info["brand"],
        "netWeight":         product_info["netWeight"],
        "scannedAt":         datetime.now(IST).isoformat(),
        "status":            status,
        "complianceConfidence": compliance_conf,
        "thumbnailColor":    COLOR_MAP.get(status, "#607D8B"),
        "imageUri":          image_uri,
        "processingTime":    pipeline_report.get("elapsed_seconds"),
        "ocrEnginesUsed":    engines_used,
        "fields":            field_checks,
        "gtin":              gtin_data.get("gtin") if gtin_data else None,
    }
