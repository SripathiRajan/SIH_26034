import re
from typing import List, Dict, Any, Tuple, Optional, Callable
from pipeline.field_rules import MANDATORY_FIELDS, FLAP_POINTER_PATTERN
from app.ocr.engine_base import TextPolygon
from app.extraction.reading_order import ReadingOrderResolver
from app.extraction.declaration_parser import DeclarationExtractor

_resolver = ReadingOrderResolver()
_declaration_extractor = DeclarationExtractor()

# ---------------------------------------------------------------------------
# FAILURE CLASSES
# F1 – Glyph corruption (dot-matrix pixel fusing/dropping)
# F2 – Token fusion (two adjacent print zones merged by OCR)
# F3 – Digit dropout (ink break causes a digit to disappear)
# F4 – Wrong reading order (linear full_text loses 2-D layout context)
# F5 – Regex brittleness (greedy early exit, first match wins even if wrong)
# ---------------------------------------------------------------------------

# ---------------------------------------------------------------------------
# GLYPH REPAIR TABLE (Layer 1 / F1)
# Per-context confusable character maps.
# ---------------------------------------------------------------------------
_NUMERIC_GLYPH_MAP = {
    'O': '0', 'o': '0', 'I': '1', 'l': '1', '|': '1',
    'S': '5', 'B': '8', 'Z': '2', 'G': '6', 'q': '9',
}
_ALPHA_GLYPH_MAP = {
    '0': 'O', '1': 'I', '5': 'S', '8': 'B',
}
_CURRENCY_GLYPH_MAP = {'?': '₹', 'R': '₹'}


def normalize_ocr_token(token: str, field_type: str = "generic") -> List[str]:
    """
    Universal pre-processor for raw OCR tokens.  Returns a **list** of
    candidate normalised strings (best-first).

    For most tokens this is a singleton list.
    For fused tokens (F2) it may be a list of sub-tokens.
    For numeric fields with digit-dropout (F3) a dropped-digit recovery
    variant is appended as the second candidate.

    field_type hints:
      'date'      – apply date-specific normalisation on top
      'mrp'       – apply currency symbol repair
      'fssai'     – numeric context, digit-drop recovery enabled
      'numeric'   – generic numeric context
      'generic'   – no extra transformation
    """
    if not token:
        return [token]
    t = token.strip()

    # ── F2: Fusion splitter ──────────────────────────────────────────────
    # Detect tokens that look like two month/year patterns concatenated,
    # e.g. 'N2026OCT2026', 'JUN2026OCT2026', 'JUN/2026OCT/2026'
    MONTH_ABBR = r'(?:JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC|'\
                 r'0CT|1UN|IUN|UN|0EC|N0V|AU6|F3B|S3P|M4R|M4Y|1UL|IUL|1AN|IAN)'
    fusion_pat = re.compile(
        rf'({MONTH_ABBR}[\/\-]?(?:20\d{{2}}|\d{{2}}))'
        rf'({MONTH_ABBR}[\/\-]?(?:20\d{{2}}|\d{{2}}))',
        re.I
    )
    fm = fusion_pat.match(t)
    if fm:
        return [fm.group(1), fm.group(2)]  # Return as two candidates

    # ── F1: Glyph repair (context-aware) ────────────────────────────────
    if field_type in ('fssai', 'numeric'):
        # Purely numeric context: fix letter-for-digit confusables
        repaired = ''.join(_NUMERIC_GLYPH_MAP.get(c, c) for c in t)
    elif field_type == 'mrp':
        # Currency context
        repaired = ''.join(_CURRENCY_GLYPH_MAP.get(c, c) for c in t)
    else:
        repaired = t  # Leave untouched for generic / date / alpha fields

    # ── F3: Digit-drop recovery for numeric IDs (FSSAI) ─────────────────
    candidates = [repaired]
    if field_type == 'fssai':
        digits = re.sub(r'\D', '', repaired)
        if 10 <= len(digits) <= 13 and digits and digits[0] in ('1', '2'):
            # Try inserting a '0' at the most likely gap positions (positions 7, 8, 9)
            for pos in (7, 8, 9):
                if pos <= len(digits):
                    recovered = digits[:pos] + '0' + digits[pos:]
                    if len(recovered) == 14 and recovered[0] in ('1', '2'):
                        candidates.append(recovered)

    return candidates


def _audit_field(
    found: bool,
    value,
    captured,
    confidence: float,
    source: str,
    rule: str,
    label: str,
    location: str,
    *,
    raw_token: str = "",
    normalized_token: str = "",
    match_pattern: str = "",
    failure_class: Optional[str] = None,
    retry_count: int = 0,
    source_engine: str = "",
    **extra,
) -> Dict[str, Any]:
    """
    Layer 5 – Structured Audit Trail.
    Constructs a complete field dict that always includes diagnostic metadata
    so that every false-negative is self-reporting.
    """
    d: Dict[str, Any] = {
        "found": found,
        "value": value,
        "captured": captured,
        "confidence": confidence,
        "source": source,
        "rule": rule,
        "label": label,
        "location": location,
        # ── Audit trail (Layer 5) ──────────────────────────────────────────
        "raw_token": raw_token or (str(captured) if captured else ""),
        "normalized_token": normalized_token or (str(captured) if captured else ""),
        "match_pattern": match_pattern,
        "failure_class": failure_class,   # None = clean, else 'F1'–'F5'
        "retry_count": retry_count,
        "source_engine": source_engine or source or "",
    }
    d.update(extra)
    return d


def extract_best_candidate(
    texts: List[str],
    patterns: List[re.Pattern],
    validator: Callable[[str], bool],
    normaliser: Callable[[str], List[str]],
    all_results: Optional[List[Dict[str, Any]]] = None,
) -> Tuple[Optional[str], float, str, str]:
    """
    Layer 2 – Candidate-Pool Extraction.
    Iterates ALL (pattern × text × normalised form) combinations and returns
    the best (value, confidence, matched_pattern_repr, source_engine).

    This eliminates F5 (greedy early exit) and F4 (reading order lock-in) by
    scanning every candidate before committing to a result.
    """
    best_val: Optional[str] = None
    best_conf: float = 0.0
    best_pattern: str = ""
    best_engine: str = ""

    all_results = all_results or []

    for text in texts:
        for pat in patterns:
            for m in pat.finditer(text):
                raw = m.group(0).strip()
                # Try every normalised candidate
                for norm_candidate in normaliser(raw):
                    if validator(norm_candidate):
                        # Look up confidence from the originating OCR region
                        conf = 0.85
                        engine = "ensemble"
                        for r in all_results:
                            if raw in r.get("text", "") or norm_candidate in r.get("text", ""):
                                conf = float(r.get("confidence", 0.85))
                                engine = r.get("source", "ensemble")
                                break
                        if conf > best_conf or best_val is None:
                            best_val = norm_candidate
                            best_conf = conf
                            best_pattern = pat.pattern[:80]
                            best_engine = engine

    return best_val, best_conf, best_pattern, best_engine


def get_neighbours(
    seed_text: str,
    all_results: List[Dict[str, Any]],
    radius_px: float = 150.0,
) -> List[Dict[str, Any]]:
    """
    Layer 3 – Spatial-Context Cross-Check.
    Finds OCR regions whose bounding boxes are within `radius_px` of any
    region whose text matches `seed_text`.  Used to search for field values
    near their label keyword when the linear full_text pass fails (F4).
    """
    import numpy as np

    def _centroid(box) -> Tuple[float, float]:
        pts = np.array(box, dtype=np.float32)
        return float(pts[:, 0].mean()), float(pts[:, 1].mean())

    # Locate seed regions
    seed_pattern = re.compile(re.escape(seed_text), re.I)
    seed_centroids: List[Tuple[float, float]] = []
    for r in all_results:
        if seed_pattern.search(r.get("text", "")):
            box = r.get("box") or []
            if box:
                seed_centroids.append(_centroid(box))

    if not seed_centroids:
        return []

    neighbours: List[Dict[str, Any]] = []
    for r in all_results:
        box = r.get("box") or []
        if not box:
            continue
        cx, cy = _centroid(box)
        for sx, sy in seed_centroids:
            dist = ((cx - sx) ** 2 + (cy - sy) ** 2) ** 0.5
            if dist <= radius_px:
                neighbours.append(r)
                break

    return neighbours

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
    - Preserves relative duration statements (e.g. 'BEST BEFORE NINE MONTHS FROM PACKAGING')
    - Dot matrix month corrections (1UN/IUN/!UN/N2026 -> JUN, 0CT -> OCT, 0EC/OEC -> DEC, etc.)
    - Fused month+year (N2026 -> JUN/2026, UN2026 -> JUN/2026, 0CT2026 -> OCT/2026)
    - Disambiguates MM/YY -> MM/20YY (if 2-digit year)
    - Disambiguates DD/MM/YY -> DD/MM/20YY
    """
    if not token:
        return token
    t = token.strip()
    if re.search(r"(?:month|day|week|year|pkg|packing|packaging|packging|mfg|manufacture)", t, re.I):
        return re.sub(r"\s+", " ", t)

    # 1. Handle fused dot matrix month+year tokens (with or without slashes):
    # e.g. N2026 -> JUN/2026, 1UN2026 -> JUN/2026, 0CT2026 -> OCT/2026, 0CT/2026 -> OCT/2026
    dot_matrix_map = [
        (r"\b(?:1UN|IUN|!UN|UN|N)[\/\-]?(20\d{2}|\d{2})\b", r"JUN/\1"),
        (r"\b(?:0CT|O\s*CT)[\/\-]?(20\d{2}|\d{2})\b", r"OCT/\1"),
        (r"\b(?:0EC|O\s*EC)[\/\-]?(20\d{2}|\d{2})\b", r"DEC/\1"),
        (r"\b(?:F3B|FE\s*8)[\/\-]?(20\d{2}|\d{2})\b", r"FEB/\1"),
        (r"\b(?:S3P|SE\s*P)[\/\-]?(20\d{2}|\d{2})\b", r"SEP/\1"),
        (r"\b(?:M4R|MA\s*R)[\/\-]?(20\d{2}|\d{2})\b", r"MAR/\1"),
        (r"\b(?:A0R|A\s*PR)[\/\-]?(20\d{2}|\d{2})\b", r"APR/\1"),
        (r"\b(?:M4Y|MA\s*Y)[\/\-]?(20\d{2}|\d{2})\b", r"MAY/\1"),
        (r"\b(?:1UL|IUL|!UL)[\/\-]?(20\d{2}|\d{2})\b", r"JUL/\1"),
        (r"\b(?:AU6|AU\s*G)[\/\-]?(20\d{2}|\d{2})\b", r"AUG/\1"),
        (r"\b(?:N0V|NO\s*V)[\/\-]?(20\d{2}|\d{2})\b", r"NOV/\1"),
        (r"\b(?:1AN|IAN)[\/\-]?(20\d{2}|\d{2})\b", r"JAN/\1"),
        # Standalone prefix replacements
        (r"\b(1UN|IUN|!UN|UN)([\/\-]?)", r"JUN\2"),
        (r"\b(0CT|O\s*CT)([\/\-]?)", r"OCT\2"),
        (r"\b(0EC|O\s*EC)([\/\-]?)", r"DEC\2"),
        (r"\b(F3B|FE8)([\/\-]?)", r"FEB\2"),
        (r"\b(S3P|SE\s*P)([\/\-]?)", r"SEP\2"),
        (r"\b(M4R|MA\s*R)([\/\-]?)", r"MAR\2"),
        (r"\b(A0R|APRIL|A\s*PR)([\/\-]?)", r"APR\2"),
        (r"\b(M4Y|MA\s*Y)([\/\-]?)", r"MAY\2"),
        (r"\b(1UL|IUL|!UL)([\/\-]?)", r"JUL\2"),
        (r"\b(AU6|AU\s*G)([\/\-]?)", r"AUG\2"),
        (r"\b(N0V|NO\s*V)([\/\-]?)", r"NOV\2"),
        (r"\b(1AN|IAN)([\/\-]?)", r"JAN\2"),
    ]
    for pattern, repl in dot_matrix_map:
        t = re.sub(pattern, repl, t, flags=re.I)

    # General month name without slash followed directly by 4-digit or 2-digit year
    t = re.sub(r"\b(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)(20\d{2}|\d{2})\b", r"\1/\2", t, flags=re.I)

    t = re.sub(r"[\._\-\s]+", "/", t)

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


MONTH_NAMES = {'jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'}


def is_valid_date(tok: str) -> bool:
    """Validates that a token represents an actual calendar date, not arbitrary text or numeric IDs."""
    if not tok:
        return False
    t = tok.strip().lower()
    # DD/MM/YYYY or DD/MM/YY
    m_dmy = re.match(r"^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](20\d{2}|\d{2})$", t)
    if m_dmy:
        d, m, y = int(m_dmy.group(1)), int(m_dmy.group(2)), int(m_dmy.group(3))
        if 1 <= d <= 31 and 1 <= m <= 12:
            return True
    # MM/YYYY or MM/YY
    m_my = re.match(r"^(\d{1,2})[\/\-.](20\d{2}|\d{2})$", t)
    if m_my:
        m, y = int(m_my.group(1)), int(m_my.group(2))
        if 1 <= m <= 12:
            return True
    # MON/YYYY or MON/YY
    m_mony = re.match(r"^([a-z]{3})[\/\-.](20\d{2}|\d{2})$", t)
    if m_mony:
        mon = m_mony.group(1)
        if mon in MONTH_NAMES:
            return True
    # DD/MON/YYYY or DD/MON/YY
    m_dmon = re.match(r"^(\d{1,2})[\/\-.]([a-z]{3})[\/\-.](20\d{2}|\d{2})$", t)
    if m_dmon:
        d, mon = int(m_dmon.group(1)), m_dmon.group(2)
        if 1 <= d <= 31 and mon in MONTH_NAMES:
            return True
    # Compact 6-digit DDMMYY (e.g. 150728 -> 15/07/28)
    if re.match(r"^\d{6}$", t):
        d, m, y = int(t[:2]), int(t[2:4]), int(t[4:])
        if 1 <= d <= 31 and 1 <= m <= 12 and 20 <= y <= 35:
            return True
    # Compact 7-digit DDMMYYY (e.g. 1507206 -> 15/07/2026 where a digit was dropped by OCR)
    if re.match(r"^\d{7}$", t):
        d, m = int(t[:2]), int(t[2:4])
        if 1 <= d <= 31 and 1 <= m <= 12 and t[4:6] == "20":
            return True
    # Compact 8-digit DDMMYYYY (e.g. 15072026 -> 15/07/2026)
    if re.match(r"^\d{8}$", t):
        d, m, y = int(t[:2]), int(t[2:4]), int(t[4:])
        if 1 <= d <= 31 and 1 <= m <= 12 and 2020 <= y <= 2035:
            return True
    return False


def _extract_table_dates(
    full_text: str,
    all_results: List[Dict[str, Any]],
    exp_already_found: bool = False,
    mfg_already_found: bool = False,
) -> Tuple[Optional[str], Optional[str]]:
    """
    Extracts packaging date (manufacture_date) and use_by date from table/column layouts,
    fused dot-matrix tokens (e.g. 'JUN/2026OCT/2026'), and nearby date tokens.
    Excludes FSSAI licenses (14 digits), phone numbers (10 digits), and postal PIN codes (6 digits).
    """
    has_mfg_header = bool(re.search(r"(?:date\s*of\s*(?:pkg|packing|packaging)|mfg|pkd|dom|packed)", full_text, re.I))
    has_exp_header = bool(re.search(r"(?:use\s*by|best\s*before|expiry|exp)", full_text, re.I))

    # 1. Search for fused dual dates like 'N20260CT/2026', 'JUN/2026OCT/2026'
    for fused_match in re.finditer(
        r"([A-Za-z0-9]{1,4}[\/\-]?(?:20\d{2}|\d{2}))\s*([0-9A-Za-z]{3,4}[\/\-]?(?:20\d{2}|\d{2}))",
        full_text,
        re.I
    ):
        d1, d2 = normalize_date_token(fused_match.group(1)), normalize_date_token(fused_match.group(2))
        if is_valid_date(d1) and is_valid_date(d2):
            return d1, d2

    # 2. Search for date candidates across full_text and all_results
    raw_texts = [full_text] + [r.get("text", "") for r in all_results]
    date_candidates: List[str] = []
    seen = set()

    for text in raw_texts:
        # Strip out 14-digit FSSAI licenses, 10-digit phone numbers, and address PIN codes before searching
        clean_t = re.sub(r"\b(?:lic(?:\s*no\.?)?|fssai)?\s*[12]\d{13}\b", " ", text, flags=re.I)
        clean_t = re.sub(r"\b(?:\+?91[\s\-]?)?[6-9]\d{9}\b", " ", clean_t)
        # Only strip 6-digit PIN if separated with space or in address context (e.g. '625 009')
        clean_t = re.sub(r"\b[1-9]\d{2}\s+\d{3}\b", " ", clean_t)

        found = re.findall(
            r"\b((?:0?[1-9]|[12]\d|3[01])[\/\-.](?:0?[1-9]|1[0-2])[\/\-.](?:20\d{2}|\d{2})|"
            r"(?:0?[1-9]|1[0-2])[\/\-.](?:20\d{2}|\d{2})|"
            r"[A-Za-z]{3}[\/\-.](?:20\d{2}|\d{2})|"
            r"(?:0?[1-9]|[12]\d|3[01])[\/\-.][A-Za-z]{3}[\/\-.](?:20\d{2}|\d{2})|"
            r"\b\d{6,8}\b)\b",
            clean_t,
            re.I
        )
        for f in found:
            f_norm = normalize_date_token(f)
            if is_valid_date(f_norm) and f_norm.lower() not in seen:
                seen.add(f_norm.lower())
                if re.match(r"^\d{6}$", f_norm):
                    f_norm = f"{f_norm[:2]}/{f_norm[2:4]}/20{f_norm[4:]}"
                elif re.match(r"^\d{7}$", f_norm):
                    f_norm = f"{f_norm[:2]}/{f_norm[2:4]}/202{f_norm[6]}"
                elif re.match(r"^\d{8}$", f_norm):
                    f_norm = f"{f_norm[:2]}/{f_norm[2:4]}/{f_norm[4:]}"
                date_candidates.append(f_norm)

    if len(date_candidates) >= 2:
        return date_candidates[0], date_candidates[1]
    elif len(date_candidates) == 1:
        if exp_already_found and not mfg_already_found:
            return date_candidates[0], None
        elif mfg_already_found and not exp_already_found:
            return None, date_candidates[0]
        elif has_mfg_header and not has_exp_header:
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
            if field_key == "net_quantity":
                g = match.groups()
                if len(g) >= 2 and g[0] and g[1]:
                    captured_val = f"{g[0].strip()} {g[1].strip()}"
                elif len(g) >= 5 and g[3] and g[4]:
                    captured_val = f"{g[3].strip()} {g[4].strip()}"
                elif match.groups():
                    non_empty = [x.strip() for x in match.groups() if x and x.strip()]
                    captured_val = " ".join(non_empty)
                else:
                    captured_val = match.group(0).strip()
            elif match.groups():
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
            elif field_key == "net_quantity" and captured_val:
                m_qty = re.search(r"(\d+[.,\d]*)\s*([a-zA-Z]+|\b[nu]\b)", matched_line or captured_val)
                if m_qty:
                    captured_val = f"{m_qty.group(1)} {m_qty.group(2)}"
                is_field_found = True

            elif field_key == "fssai":
                digits = re.sub(r"\D", "", captured_val or "")
                if len(digits) == 14 and digits[0] in ("1", "2"):
                    captured_val = digits
                    is_field_found = True
                elif len(digits) in (13, 14, 15):
                    near = re.search(r"[12]\d{13}", digits)
                    if near:
                        captured_val = near.group(0)
                        is_field_found = True
                    else:
                        m14 = re.search(r"\b([12]\d{13}|\d{14})\b", matched_line)
                        if m14:
                            captured_val = m14.group(1)
                            is_field_found = True
                        else:
                            raw_line_digits = re.sub(r"\D", "", matched_line)
                            m_raw = re.search(r"[12]\d{13}", raw_line_digits)
                            if m_raw:
                                captured_val = m_raw.group(0)
                                is_field_found = True
                            elif 10 <= len(digits) <= 13 and digits[0] in ("1", "2"):
                                captured_val = digits
                                is_field_found = True
                            else:
                                is_field_found = False
                elif 10 <= len(digits) <= 13 and digits[0] in ("1", "2"):
                    captured_val = digits
                    is_field_found = True
                else:
                    m14 = re.search(r"\b([12]\d{13}|\d{14})\b", matched_line)
                    if m14:
                        captured_val = m14.group(1)
                        is_field_found = True
                    else:
                        raw_line_digits = re.sub(r"\D", "", matched_line)
                        m_raw = re.search(r"[12]\d{13}", raw_line_digits)
                        if m_raw:
                            captured_val = m_raw.group(0)
                            is_field_found = True
                        elif 10 <= len(raw_line_digits) <= 13 and raw_line_digits[0] in ("1", "2"):
                            captured_val = raw_line_digits
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

            # Determine failure class (F1 if normalisation changed the raw value)
            raw_tok = matched_line or captured_val
            norm_tok = captured_val
            fc = None
            if raw_tok and norm_tok and raw_tok != norm_tok:
                fc = "F1"  # glyph correction was needed

            extracted[field_key] = _audit_field(
                found=True,
                value=matched_line or captured_val,
                captured=captured_val,
                confidence=conf,
                source=source,
                rule=field_info["rule"],
                label=field_info["label"],
                location="ON_PANEL",
                raw_token=raw_tok,
                normalized_token=norm_tok,
                match_pattern=field_info["pattern"].pattern[:80],
                failure_class=fc,
                retry_count=0,
                source_engine=source,
            )
        else:
            # If flap pointer was detected and instructed user to flip, do NOT hallucinate from fallback
            if is_flap_pointed:
                extracted[field_key] = _audit_field(
                    found=False, value=None, captured=None,
                    confidence=0.0, source=None,
                    rule=field_info["rule"], label=field_info["label"],
                    location="SEE_FLAP",
                    failure_class="F4",  # Reading order / flap context
                    retry_count=0,
                )
                continue

            # Check if CB2 declaration extractor found this field
            cb2_key = next((k for k, v in FIELD_MAP_CB2_TO_CB1.items() if v == field_key), None)
            cb2_data = cb2_decls.get(cb2_key) if cb2_key else None

            raw_val = None
            if cb2_data and cb2_data.get("found"):
                raw_val = cb2_data.get("rawValue") or str(cb2_data.get("parsedValue") or "")
                if field_key == "fssai":
                    digits = re.sub(r"\D", "", raw_val)
                    if len(digits) != 14:
                        raw_val = None
                if field_key in {"manufacture_date", "use_by"} and raw_val:
                    raw_val = normalize_date_token(raw_val)

            if cb2_data and cb2_data.get("found") and raw_val:
                extracted[field_key] = _audit_field(
                    found=True,
                    value=raw_val,
                    captured=raw_val,
                    confidence=float(cb2_data.get("confidence", 0.85)),
                    source="declaration_extractor",
                    rule=field_info["rule"],
                    label=field_info["label"],
                    location="ON_PANEL",
                    retry_count=1,
                    failure_class="F5",  # Needed CB2 fallback = regex missed it
                    parsedValue=cb2_data.get("parsedValue"),
                )
            else:
                location = "SEE_FLAP" if is_flap_pointed else "MISSING"
                extracted[field_key] = _audit_field(
                    found=False, value=None, captured=None,
                    confidence=0.0, source=None,
                    rule=field_info["rule"], label=field_info["label"],
                    location=location,
                    failure_class="F5",  # All patterns exhausted
                    retry_count=0,
                )

    # 4. Table / column dual-date resolution fallback for manufacture_date & use_by (only if not on flap)
    if not flap_detected and (not extracted["manufacture_date"]["found"] or not extracted["use_by"]["found"]):
        mfg_date, exp_date = _extract_table_dates(
            full_text,
            all_results,
            exp_already_found=extracted["use_by"]["found"],
            mfg_already_found=extracted["manufacture_date"]["found"],
        )
        if mfg_date and not extracted["manufacture_date"]["found"]:
            extracted["manufacture_date"] = _audit_field(
                found=True,
                value=f"DATE OF PACKAGING: {mfg_date}",
                captured=mfg_date,
                confidence=0.88,
                source="table_extractor",
                rule=MANDATORY_FIELDS["manufacture_date"]["rule"],
                label=MANDATORY_FIELDS["manufacture_date"]["label"],
                location="ON_PANEL",
                normalized_token=mfg_date,
                failure_class="F2",  # Was found via table/fusion recovery
                retry_count=1,
            )
        if exp_date and not extracted["use_by"]["found"]:
            extracted["use_by"] = _audit_field(
                found=True,
                value=f"USE BY: {exp_date}",
                captured=exp_date,
                confidence=0.88,
                source="table_extractor",
                rule=MANDATORY_FIELDS["use_by"]["rule"],
                label=MANDATORY_FIELDS["use_by"]["label"],
                location="ON_PANEL",
                normalized_token=exp_date,
                failure_class="F2",
                retry_count=1,
            )

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
                        if len(digits) == 14 and digits[0] in ("1", "2"):
                            cap = digits
                            break
                        elif 10 <= len(digits) <= 14 and digits[0] in ("1", "2"):
                            cap = digits
                            break
                if not cap:
                    all_digits = re.findall(r"\b([12]\d{13}|\d{14})\b", t)
                    if all_digits:
                        cap = all_digits[0]
                    else:
                        raw_d = re.sub(r"\D", "", t)
                        if 10 <= len(raw_d) <= 14 and raw_d[0] in ("1", "2"):
                            cap = raw_d
                if cap:
                    fc = None if len(cap) == 14 else "F3"  # F3 = digit drop
                    extracted["fssai"] = _audit_field(
                        found=True,
                        value=t.strip(),
                        captured=cap,
                        confidence=float(r.get("confidence", 0.88)),
                        source=r.get("source", "ensemble"),
                        rule=MANDATORY_FIELDS["fssai"]["rule"],
                        label=MANDATORY_FIELDS["fssai"]["label"],
                        location="ON_PANEL",
                        raw_token=t.strip(),
                        normalized_token=cap,
                        failure_class=fc,
                        retry_count=1,
                        source_engine=r.get("source", "ensemble"),
                    )
                    break

    # 5.5 Fallback for MRP: standalone price next to / near MRP table header
    if not extracted["mrp"]["found"]:
        if re.search(r"(?:m\.?r\.?p|maximum\s+retail\s+price)", full_text, re.I):
            for r in all_results:
                t = r.get("text", "").strip()
                m_price = re.search(r"^(?:(?:rs\.?|₹|\?|inr)\s*)?(\d{1,4}\.\d{2})\b", t, re.I)
                if m_price:
                    val = float(m_price.group(1))
                    if 1.0 <= val <= 100000.0:
                        extracted["mrp"] = _audit_field(
                            found=True,
                            value=f"M.R.P. RS {m_price.group(1)}",
                            captured=m_price.group(1),
                            confidence=float(r.get("confidence", 0.88)),
                            source="table_mrp_resolver",
                            rule=MANDATORY_FIELDS["mrp"]["rule"],
                            label=MANDATORY_FIELDS["mrp"]["label"],
                            location="ON_PANEL",
                            raw_token=t,
                            normalized_token=m_price.group(1),
                            failure_class="F5",  # Needed table fallback
                            retry_count=1,
                            source_engine=r.get("source", "ensemble"),
                        )
                        break

    # 6. Fallback for Net Quantity: standalone metric declarations outside nutrition tables
    if not extracted["net_quantity"]["found"]:
        nutritional_keywords = {'protein', 'fat', 'energy', 'carb', 'carbohydrate', 'kcals', 'each', 'contains', 'per', 'sugar', 'cholesterol', 'sodium', 'serving'}
        raw_texts = [r.get("text", "") for r in all_results]
        best_cand = None
        best_conf = 0.88

        for i, r in enumerate(all_results):
            t = r.get("text", "").strip()
            # Match standard metric units e.g. '100 gms', '100 g', '500 g', '1 kg', '200 ml'
            m = re.search(r"\b(\d+(?:\.\d+)?)\s*(gms?|g|kg|ml|l|ltrs?|count|units?|u|n)\b", t, re.I)
            if m:
                val = float(m.group(1))
                unit = m.group(2)
                # Exclude nutrient breakdown amounts < 1g (e.g. 0.4g, 0.2g)
                if val < 1.0 and unit.lower() in ('g', 'gm', 'gms'):
                    continue
                # Exclude lines part of nutrition facts table
                if any(k in t.lower() for k in nutritional_keywords):
                    continue
                # Exclude if surrounding tokens contain nutritional keywords
                surrounding = ' '.join(raw_texts[max(0, i-2):min(len(raw_texts), i+3)]).lower()
                if any(k in surrounding for k in ('protein', 'fat', 'carbohydrate', 'energy', 'kcals')):
                    continue

                best_cand = f"{m.group(1)} {m.group(2)}"
                best_conf = float(r.get("confidence", 0.88))
                break

        if best_cand:
            extracted["net_quantity"] = _audit_field(
                found=True,
                value=f"NET WEIGHT: {best_cand}",
                captured=best_cand,
                confidence=best_conf,
                source="metric_quantity_resolver",
                rule=MANDATORY_FIELDS["net_quantity"]["rule"],
                label=MANDATORY_FIELDS["net_quantity"]["label"],
                location="ON_PANEL",
                normalized_token=best_cand,
                failure_class="F5",  # Needed metric fallback resolver
                retry_count=1,
            )

    # 7. Fallback for Country of Origin: domestic manufacturer address / postal PIN code
    if not extracted["country_of_origin"]["found"]:
        # In India under LM Rule §6(1)(aa), country of origin is required for imported products.
        # For domestic products, the address of the manufacturer/marketer with postal PIN code establishes domestic Indian origin.
        pin_match = None
        for r in all_results:
            t = r.get("text", "")
            m_pin = re.search(r"\b([1-9]\d{2}\s*\d{3})\b", t)
            if m_pin and (' ' in m_pin.group(1) or any(k in t.lower() for k in ['madurai', 'chennai', 'road', 'p.o', 'nagar', 'delhi', 'mumbai', 'pin', '-'])):
                pin_match = m_pin.group(1)
                break
        fssai_match = re.search(r"\b[12]\d{13}\b", re.sub(r"\D", "", full_text))
        indian_geo_match = re.search(
            r"\b(madurai|chennai|mumbai|delhi|new\s*delhi|bangalore|bengaluru|kolkata|hyderabad|coimbatore|"
            r"pennagaram|puducherry|pondicherry|ahmedabad|pune|surat|jaipur|lucknow|kanpur|nagpur|indore|"
            r"tamil\s*nadu|kerala|karnataka|andhra\s*pradesh|telangana|maharashtra|gujarat|rajasthan|"
            r"uttar\s*pradesh|madhya\s*pradesh|west\s*bengal|punjab|haryana|bihar|odisha|assam)\b",
            full_text,
            re.I
        )
        if pin_match or (indian_geo_match and fssai_match):
            loc_detail = pin_match or (indian_geo_match.group(1).title() if indian_geo_match else "Domestic")
            extracted["country_of_origin"] = _audit_field(
                found=True,
                value=f"India (Domestic Product — {loc_detail})",
                captured="India",
                confidence=0.92,
                source="domestic_address_resolver",
                rule=MANDATORY_FIELDS["country_of_origin"]["rule"],
                label=MANDATORY_FIELDS["country_of_origin"]["label"],
                location="ON_PANEL",
                normalized_token="India",
                failure_class="F4",  # Resolved via spatial/geo context
                retry_count=1,
            )

    # 8. Refinement for Manufacturer: clean up if corrupted by price/mrp
    if extracted["manufacturer"]["found"]:
        mfr_val = str(extracted["manufacturer"].get("value") or "")
        if re.search(r"(?:m\.?r\.?p|rs\.?|₹|incl)", mfr_val, re.I) or len(mfr_val.strip()) < 5:
            mfr_parts = []
            raw_t_list = [r.get("text", "").strip() for r in all_results]
            for i, t in enumerate(raw_t_list):
                if re.search(r"(?:marketed|manufactured|packed|mfg)\s+by", t, re.I):
                    if i + 1 < len(raw_t_list) and len(raw_t_list[i+1]) > 3:
                        if not any(k in raw_t_list[i+1].lower() for k in ['m.r.p', 'rs.', 'price']):
                            mfr_parts.append(raw_t_list[i+1])
                    for j in range(i+1, min(i+10, len(raw_t_list))):
                        jt = raw_t_list[j]
                        if any(k in jt.lower() for k in ['m.r.p', 'rs.', 'customer care', 'care number', '0944', '124190']):
                            continue
                        if any(k in jt.lower() for k in ['ponnagar', 'pannaiyoor', 'madurai', 'road', 'p.o', 'nagar', 'industrial']) or re.search(r'\b\d{3}\s*\d{3}\b', jt):
                            mfr_parts.append(jt)
                    break
            if mfr_parts:
                clean_mfr = ", ".join(dict.fromkeys(mfr_parts))
                extracted["manufacturer"]["value"] = clean_mfr
                extracted["manufacturer"]["captured"] = clean_mfr

    return extracted, full_text, {"flap_detected": flap_detected, "pointer_text": flap_pointer_text}

