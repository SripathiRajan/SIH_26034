import re
from typing import List, Dict, Any, Tuple, Optional
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
    "manufacture_date": "manufacture_date",
    "use_by": "use_by",
    "fssai": "fssai",
    "consumer_care": "consumer_care",
    "country_of_origin": "country_of_origin",
    "manufacturer_details": "manufacturer",
}


def normalize_date_token(token: str) -> str:
    """
    Normalizes OCR errors in dot-matrix and stamped dates:
    - Dot matrix month corrections (1UN/IUN/!UN/N2026 -> JUN, 0CT -> OCT, 0EC/OEC -> DEC, etc.)
    - Disambiguates MM/YY -> MM/20YY (if 2-digit year)
    - Disambiguates DD/MM/YY -> DD/MM/20YY
    """
    if not token:
        return token
    t = token.strip()
    t = re.sub(r"[\._\-\s]+", "/", t)

    dot_matrix_map = [
        (r"\b(1UN|IUN|!UN|UN)([\/\-]?)", r"JUN\2"),
        (r"\b(0CT|O CT)([\/\-]?)", r"OCT\2"),
        (r"\b(0EC|OEC)([\/\-]?)", r"DEC\2"),
        (r"\b(F3B|FE8)([\/\-]?)", r"FEB\2"),
        (r"\b(S3P|SE P)([\/\-]?)", r"SEP\2"),
        (r"\b(M4R|MA R)([\/\-]?)", r"MAR\2"),
        (r"\b(A0R|APRIL|A PR)([\/\-]?)", r"APR\2"),
        (r"\b(M4Y|MA Y)([\/\-]?)", r"MAY\2"),
        (r"\b(1UL|IUL|!UL)([\/\-]?)", r"JUL\2"),
        (r"\b(AU6|AU G)([\/\-]?)", r"AUG\2"),
        (r"\b(N0V|NO V)([\/\-]?)", r"NOV\2"),
        (r"\b(1AN|IAN)([\/\-]?)", r"JAN\2"),
    ]
    for pattern, repl in dot_matrix_map:
        t = re.sub(pattern, repl, t, flags=re.I)

    # Disambiguate MM/YY to MM/20YY
    m_my = re.match(r"^([A-Za-z]{3}|\d{1,2})[\/\-](\d{2})$", t)
    if m_my:
        month_part, yr_part = m_my.group(1), m_my.group(2)
        t = f"{month_part}/20{yr_part}"

    # Disambiguate DD/MM/YY to DD/MM/20YY
    m_dmy = re.match(r"^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2})$", t)
    if m_dmy:
        d, m, y = m_dmy.group(1), m_dmy.group(2), m_dmy.group(3)
        t = f"{d}/{m}/20{y}"

    return t


def _extract_table_dates(full_text: str, all_results: List[Dict[str, Any]]) -> Tuple[Optional[str], Optional[str]]:
    """
    Extracts packaging date (manufacture_date) and use_by date from table/column layouts,
    fused dot-matrix tokens (e.g. 'N20260CT/2026'), and nearby date tokens.
    """
    has_mfg_header = bool(re.search(r"(?:date\s*of\s*(?:pkg|packing|packaging)|mfg|pkd|dom)", full_text, re.I))
    has_exp_header = bool(re.search(r"(?:use\s*by|best\s*before|expiry|exp)", full_text, re.I))

    # 1. Search for fused dual dates like 'N20260CT/2026', 'JUN/2026OCT/2026'
    fused_match = re.search(
        r"([A-Za-z0-9]{1,4}[\/\-]?(?:20\d{2}|\d{2}))\s*([0-9A-Za-z]{3,4}[\/\-]?(?:20\d{2}|\d{2}))",
        full_text,
        re.I
    )
    if fused_match:
        d1, d2 = normalize_date_token(fused_match.group(1)), normalize_date_token(fused_match.group(2))
        return d1, d2

    # 2. Search for date candidates across full_text and all_results
    raw_texts = [full_text] + [r.get("text", "") for r in all_results]
    date_candidates: List[str] = []
    seen = set()
    for text in raw_texts:
        found = re.findall(r"\b([0-9A-Za-z]{2,4}[\/\-](?:20\d{2}|\d{2})|\d{1,2}[\/\-]\d{1,2}[\/\-](?:20\d{2}|\d{2}))\b", text, re.I)
        for f in found:
            f_norm = normalize_date_token(f)
            if f_norm.lower() not in seen:
                seen.add(f_norm.lower())
                date_candidates.append(f_norm)

    if len(date_candidates) >= 2 and (has_mfg_header or has_exp_header):
        return date_candidates[0], date_candidates[1]
    elif len(date_candidates) == 1:
        if has_mfg_header and not has_exp_header:
            return date_candidates[0], None
        elif has_exp_header and not has_mfg_header:
            return None, date_candidates[0]
        else:
            return date_candidates[0], None

    return None, None


def extract_fields(all_results: List[Dict[str, Any]]) -> Tuple[Dict[str, Any], str, Dict[str, Any]]:
    """
    Merges all OCR text detections into an ordered text blob using ReadingOrderResolver,
    executes statutory regex patterns, falls back to DeclarationExtractor and table layout resolution,
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
        # Check if flap pointer specifically mentions this field
        is_flap_pointed = flap_detected and field_key in {"mrp", "manufacture_date", "use_by", "net_quantity"}

        match = field_info["pattern"].search(full_text)
        is_field_found = False
        captured_val = None
        matched_line = None

        if match:
            if match.groups():
                for g in match.groups():
                    if g and g.strip():
                        captured_val = g.strip()
                        break
            if not captured_val:
                captured_val = match.group(0).strip()

            matched_line = match.group(0).strip()

            # Normalization per field
            if field_key == "mrp" and captured_val:
                clean_mrp = re.sub(r"^[^\d]*", "", captured_val)
                clean_mrp = re.sub(r"[^\d.]*$", "", clean_mrp)
                if clean_mrp:
                    captured_val = clean_mrp
                    is_field_found = True
            elif field_key == "fssai":
                digits = re.sub(r"\D", "", captured_val)
                if len(digits) == 14:
                    captured_val = digits
                    is_field_found = True
                else:
                    m14 = re.search(r"\b([12]\d{13}|\d{14})\b", matched_line)
                    if m14:
                        captured_val = m14.group(1)
                        is_field_found = True
                    else:
                        is_field_found = False
            elif field_key in {"manufacture_date", "use_by"} and captured_val:
                captured_val = normalize_date_token(captured_val)
                is_field_found = True
            else:
                is_field_found = True

        if is_field_found and captured_val:
            source = "ensemble"
            conf = 0.90
            for r in all_results:
                if captured_val in r.get("text", ""):
                    source = r.get("source", "ensemble")
                    conf = r.get("confidence", 0.90)
                    break

            extracted[field_key] = {
                "found": True,
                "value": matched_line or captured_val,
                "captured": captured_val,
                "confidence": conf,
                "source": source,
                "rule": field_info["rule"],
                "label": field_info["label"],
                "location": "ON_PANEL"
            }
        else:
            # If flap pointer was detected and instructed user to flip, do NOT hallucinate from fallback
            if is_flap_pointed:
                extracted[field_key] = {
                    "found": False,
                    "value": None,
                    "captured": None,
                    "confidence": 0.0,
                    "source": None,
                    "rule": field_info["rule"],
                    "label": field_info["label"],
                    "location": "SEE_FLAP"
                }
                continue

            # Check if CB2 declaration extractor found this field
            cb2_key = next((k for k, v in FIELD_MAP_CB2_TO_CB1.items() if v == field_key), None)
            cb2_data = cb2_decls.get(cb2_key) if cb2_key else None

            if cb2_data and cb2_data.get("found"):
                raw_val = cb2_data.get("rawValue") or str(cb2_data.get("parsedValue") or "")
                if field_key == "fssai":
                    digits = re.sub(r"\D", "", raw_val)
                    if len(digits) != 14:
                        raw_val = None
                if field_key in {"manufacture_date", "use_by"} and raw_val:
                    raw_val = normalize_date_token(raw_val)

            if cb2_data and cb2_data.get("found") and raw_val:
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
                location = "SEE_FLAP" if is_flap_pointed else "MISSING"
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

    # 4. Table / column dual-date resolution fallback for manufacture_date & use_by (only if not on flap)
    if not flap_detected and (not extracted["manufacture_date"]["found"] or not extracted["use_by"]["found"]):
        mfg_date, exp_date = _extract_table_dates(full_text, all_results)
        if mfg_date and not extracted["manufacture_date"]["found"]:
            extracted["manufacture_date"] = {
                "found": True,
                "value": f"DATE OF PACKAGING: {mfg_date}",
                "captured": mfg_date,
                "confidence": 0.88,
                "source": "table_extractor",
                "rule": MANDATORY_FIELDS["manufacture_date"]["rule"],
                "label": MANDATORY_FIELDS["manufacture_date"]["label"],
                "location": "ON_PANEL"
            }
        if exp_date and not extracted["use_by"]["found"]:
            extracted["use_by"] = {
                "found": True,
                "value": f"USE BY: {exp_date}",
                "captured": exp_date,
                "confidence": 0.88,
                "source": "table_extractor",
                "rule": MANDATORY_FIELDS["use_by"]["rule"],
                "label": MANDATORY_FIELDS["use_by"]["label"],
                "location": "ON_PANEL"
            }

    # 5. Fallback for FSSAI if not detected in full_text
    if not extracted["fssai"]["found"]:
        for r in all_results:
            t = r.get("text", "")
            f_match = MANDATORY_FIELDS["fssai"]["pattern"].search(t)
            if f_match:
                cap = None
                for g in f_match.groups():
                    if g and g.strip():
                        digits = re.sub(r"\D", "", g.strip())
                        if len(digits) == 14:
                            cap = digits
                            break
                if not cap:
                    all_digits = re.findall(r"\b([12]\d{13}|\d{14})\b", t)
                    if all_digits:
                        cap = all_digits[0]
                if cap and len(cap) == 14:
                    extracted["fssai"] = {
                        "found": True,
                        "value": t.strip(),
                        "captured": cap,
                        "confidence": float(r.get("confidence", 0.88)),
                        "source": r.get("source", "ensemble"),
                        "rule": MANDATORY_FIELDS["fssai"]["rule"],
                        "label": MANDATORY_FIELDS["fssai"]["label"],
                        "location": "ON_PANEL"
                    }
                    break

    return extracted, full_text, {"flap_detected": flap_detected, "pointer_text": flap_pointer_text}
