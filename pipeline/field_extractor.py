from typing import List, Dict, Any, Tuple
from pipeline.field_rules import MANDATORY_FIELDS, FLAP_POINTER_PATTERN
from app.ocr.engine_base import TextPolygon
from app.extraction.reading_order import ReadingOrderResolver
from app.extraction.declaration_parser import DeclarationExtractor

_resolver = ReadingOrderResolver()
_declaration_extractor = DeclarationExtractor()

FIELD_MAP_CB2_TO_CB1 = {
    "mrp": "mrp",
    "net_quantity": "net_quantity",
    "date_of_packing": "manufacture_date",
    "consumer_care": "consumer_care",
    "country_of_origin": "country_of_origin",
    "manufacturer_details": "manufacturer",
}


def extract_fields(all_results: List[Dict[str, Any]]) -> Tuple[Dict[str, Any], str, Dict[str, Any]]:
    """
    Merges all OCR text detections into an ordered text blob using ReadingOrderResolver,
    executes statutory regex patterns, falls back to DeclarationExtractor,
    and checks for package flip pointers.
    Returns: (extracted_fields, full_text, flap_info)
    """
    # 1. Convert detections to TextPolygon for ReadingOrderResolver
    tokens: List[TextPolygon] = []
    for r in all_results:
        box = r.get("box") or [[0.0, 0.0], [0.0, 0.0], [0.0, 0.0], [0.0, 0.0]]
        text = r.get("text", "").strip()
        conf = float(r.get("confidence", 0.85))
        engine = r.get("source", r.get("engine", "ensemble"))
        if text:
            tokens.append(TextPolygon(text=text, confidence=conf, bbox=box, engine=engine))

    if tokens:
        full_text = _resolver.get_ordered_text(tokens)
    else:
        seen = set()
        lines = []
        for r in sorted(all_results, key=lambda x: -x.get("confidence", 0.0)):
            t = r.get("text", "").strip()
            if t.lower() not in seen and len(t) > 1:
                seen.add(t.lower())
                lines.append(t)
        full_text = "\n".join(lines)

    # 2. Check for flap/bottom pointers
    flap_match = FLAP_POINTER_PATTERN.search(full_text)
    flap_detected = bool(flap_match)
    flap_pointer_text = flap_match.group(0).strip() if flap_match else None

    # 3. CB2 statutory declaration parsing
    cb2_decls: Dict[str, Any] = {}
    if tokens:
        try:
            cb2_decls = _declaration_extractor.parse(tokens)
        except Exception:
            cb2_decls = {}

    extracted = {}
    for field_key, field_info in MANDATORY_FIELDS.items():
        match = field_info["pattern"].search(full_text)
        if match:
            captured_val = None
            if match.groups():
                for g in match.groups():
                    if g and g.strip():
                        captured_val = g.strip()
                        break
            if not captured_val:
                captured_val = match.group(0).strip()

            matched_line = match.group(0).strip()
            source = "ensemble"
            conf = 0.90
            for r in all_results:
                if captured_val in r.get("text", ""):
                    source = r.get("source", "ensemble")
                    conf = r.get("confidence", 0.90)
                    break

            extracted[field_key] = {
                "found": True,
                "value": matched_line,
                "captured": captured_val,
                "confidence": conf,
                "source": source,
                "rule": field_info["rule"],
                "label": field_info["label"],
                "location": "ON_PANEL"
            }
        else:
            # Check if CB2 declaration extractor found this field
            cb2_key = next((k for k, v in FIELD_MAP_CB2_TO_CB1.items() if v == field_key), None)
            cb2_data = cb2_decls.get(cb2_key) if cb2_key else None

            if cb2_data and cb2_data.get("found"):
                raw_val = cb2_data.get("rawValue") or str(cb2_data.get("parsedValue") or "")
                extracted[field_key] = {
                    "found": True,
                    "value": raw_val,
                    "captured": raw_val,
                    "confidence": float(cb2_data.get("confidence", 0.85)),
                    "source": "declaration_extractor",
                    "rule": field_info["rule"],
                    "label": field_info["label"],
                    "location": "ON_PANEL",
                    "parsedValue": cb2_data.get("parsedValue")
                }
            else:
                location = "SEE_FLAP" if (flap_detected and field_key in {"mrp", "manufacture_date", "use_by", "net_quantity"}) else "MISSING"
                extracted[field_key] = {
                    "found": False,
                    "value": None,
                    "captured": None,
                    "confidence": 0.0,
                    "source": None,
                    "rule": field_info["rule"],
                    "label": field_info["label"],
                    "location": location
                }

    return extracted, full_text, {"flap_detected": flap_detected, "pointer_text": flap_pointer_text}
