"""
Declaration Extractor: Legal Metrology Field Parser
Extracts mandatory statutory declarations using a two-stage strategy:
  1. Regex Pattern Matching (direct syntactic extraction)
  2. Contextual Fallback (spatial keyword-anchored token proximity)
Computes field-level confidence and flags low-confidence (<0.60) extractions for review.
"""

import re
from typing import Dict, Any, List
from ..ocr.engine_base import TextPolygon
from ..config import settings


class DeclarationExtractor:
    def __init__(self, confidence_threshold: float = None):
        self.confidence_threshold = (
            confidence_threshold
            if confidence_threshold is not None
            else getattr(settings, "EXTRACTION_CONFIDENCE_THRESHOLD", 0.60)
        )

        # Stage 1: Standard statutory regular expressions
        self.mrp_pattern = re.compile(
            r"(?:m\.?r\.?p\.?|max(?:imum)?\s+retail\s+price)[:\s]*(?:rs\.?|₹)?\s*([\d,]+(?:\.\d{1,2})?)",
            re.IGNORECASE,
        )
        self.tax_inclusion_pattern = re.compile(
            r"\(?\s*(?:incl|inclusive)\.?\s+of\s+all\s+taxes\s*\)?",
            re.IGNORECASE,
        )
        self.net_qty_pattern = re.compile(
            r"(?:net\s+(?:wt\.?|weight|quantity|qty|volume|contents?))[:\s]*([\d\.]+)\s*([a-zA-Z]+)\b",
            re.IGNORECASE,
        )
        self.standalone_qty_pattern = re.compile(
            r"\b([\d\.]+)\s*(kg|g|gm|ml|l|ltr|litre|m|cm|units?|u|n)\b",
            re.IGNORECASE,
        )
        self.date_pattern = re.compile(
            r"(?:mfg|pkd|mfd|packed|manufactured|date\s*of\s*(?:mfg|pkg|packing|packaging)|dom)[:\s]*([0-9]{1,2}[\/\-\.][0-9]{2,4}|(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|0ct|1un)[a-z0-9]*[\s\.\,\-\/]+[0-9]{2,4}|\b\d{4}\b)",
            re.IGNORECASE,
        )
        self.use_by_pattern = re.compile(
            r"(?:use\s*by|best\s*before|expiry|exp\.?|expires?|bb\.?)[:\s]*([0-9]{1,2}[\/\-\.][0-9]{2,4}|(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|0ct|1un)[a-z0-9]*[\s\.\,\-\/]+[0-9]{2,4}|\w+\/\d{4}|\d+\s+months)",
            re.IGNORECASE,
        )
        self.fssai_pattern = re.compile(
            r"(?:fssai|fsat|fssal|issai|lic(?:ense)?\.?\s*(?:no\.?)?|lic\s*#)[\s\S]{0,25}?[:\-]?\s*([0-9\s]{10,18})|\b([0-9]{14})\b",
            re.IGNORECASE,
        )
        self.standalone_date_pattern = re.compile(
            r"\b([0-9]{1,2}[\/\-\.][0-9]{2,4})\b",
            re.IGNORECASE,
        )
        self.consumer_care_email_pattern = re.compile(
            r"[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+"
        )
        self.consumer_care_phone_pattern = re.compile(
            r"(?:tel|phone|toll[- ]?free|call|helpline|care)?[:\s]*(1800[\d\- ]{6,10}|\+?91[\d\- ]{10}|\b\d{10}\b)",
            re.IGNORECASE,
        )
        self.country_origin_pattern = re.compile(
            r"(?:country\s+of\s+origin|made\s+in|product\s+of)[:\s]*([a-zA-Z\s]+)",
            re.IGNORECASE,
        )
        self.manufacturer_pattern = re.compile(
            r"(?:manufactured(?:\s*&\s*marketed)?\s+by|manufactured\s+by|marketed\s+by|packed\s+by|imported\s+by)[:\s]*([^\n\r]+)",
            re.IGNORECASE,
        )

    def parse(
        self,
        tokens: List[TextPolygon],
        engine_agreement_score: float = 1.0,
    ) -> Dict[str, Any]:
        """
        Extracts all Legal Metrology declarations from tokens.
        Tries Stage 1 (Regex) first; falls back to Stage 2 (Contextual) if needed.
        """
        full_text = " \n ".join(t.text for t in tokens)
        avg_ocr_conf = (
            sum(t.confidence for t in tokens) / len(tokens) if tokens else 0.85
        )

        declarations: Dict[str, Any] = {
            "mrp": self._extract_mrp(tokens, full_text, avg_ocr_conf, engine_agreement_score),
            "net_quantity": self._extract_net_qty(tokens, full_text, avg_ocr_conf, engine_agreement_score),
            "date_of_packing": self._extract_date(tokens, full_text, avg_ocr_conf, engine_agreement_score),
            "use_by": self._extract_use_by(tokens, full_text, avg_ocr_conf, engine_agreement_score),
            "consumer_care": self._extract_consumer_care(tokens, full_text, avg_ocr_conf, engine_agreement_score),
            "country_of_origin": self._extract_country_of_origin(tokens, full_text, avg_ocr_conf, engine_agreement_score),
            "manufacturer_details": self._extract_manufacturer(tokens, full_text, avg_ocr_conf, engine_agreement_score),
            "fssai": self._extract_fssai(tokens, full_text, avg_ocr_conf, engine_agreement_score),
        }

        return declarations

    def _find_token_confidence(self, target_text: str, tokens: List[TextPolygon], default_conf: float) -> float:
        """
        Finds the average confidence of tokens matching or containing target_text.
        """
        if not target_text or not tokens:
            return default_conf

        target_norm = target_text.strip().lower()
        matched_confs = []
        for t in tokens:
            t_norm = t.text.strip().lower()
            if t_norm in target_norm or target_norm in t_norm:
                matched_confs.append(t.confidence)

        if matched_confs:
            return sum(matched_confs) / len(matched_confs)
        return default_conf

    def _compute_confidence(
        self,
        token_conf: float,
        is_stage_one: bool,
        engine_agreement: float,
    ) -> float:
        """
        Combines token OCR confidence, stage match multiplier, and engine agreement score.
        """
        stage_mult = 1.0 if is_stage_one else 0.85
        # Blend engine agreement gently (between 0.85 and 1.0)
        agreement_factor = 0.85 + 0.15 * max(0.0, min(1.0, engine_agreement))
        final_conf = token_conf * stage_mult * agreement_factor
        return round(max(0.05, min(1.0, final_conf)), 2)

    # -------------------------------------------------------------------------
    # Field 1: MRP
    # -------------------------------------------------------------------------
    def _extract_mrp(
        self,
        tokens: List[TextPolygon],
        full_text: str,
        avg_ocr_conf: float,
        engine_agreement: float,
    ) -> Dict[str, Any]:
        # Stage 1: Regex
        match = self.mrp_pattern.search(full_text)
        tax_match = self.tax_inclusion_pattern.search(full_text)

        if match:
            raw_amount = match.group(1).replace(",", "")
            try:
                amount = float(raw_amount)
            except ValueError:
                amount = 0.0

            matched_str = match.group(0)
            token_conf = self._find_token_confidence(matched_str, tokens, avg_ocr_conf)
            conf = self._compute_confidence(token_conf, is_stage_one=True, engine_agreement=engine_agreement)

            return {
                "found": True,
                "rawValue": matched_str,
                "parsedValue": {
                    "amount": amount,
                    "currency": "INR",
                    "inclusiveOfTaxes": bool(tax_match),
                },
                "confidence": conf,
                "needs_review": bool(conf < self.confidence_threshold),
            }

        # Stage 2: Contextual fallback (keyword anchor + neighboring numeric)
        for i, token in enumerate(tokens):
            t_text = token.text.upper()
            if any(kw in t_text for kw in ["MRP", "M.R.P", "RETAIL PRICE", "PRICE"]):
                # Search horizontally or in subsequent 3 tokens
                for j in range(max(0, i - 1), min(len(tokens), i + 4)):
                    candidate = tokens[j].text.replace("₹", "").replace("Rs.", "").replace("Rs", "").strip()
                    num_match = re.search(r"(\d+(?:\.\d{1,2})?)", candidate)
                    if num_match:
                        try:
                            amount = float(num_match.group(1))
                            token_conf = (token.confidence + tokens[j].confidence) / 2.0
                            conf = self._compute_confidence(token_conf, is_stage_one=False, engine_agreement=engine_agreement)
                            return {
                                "found": True,
                                "rawValue": f"{token.text} {tokens[j].text}",
                                "parsedValue": {
                                    "amount": amount,
                                    "currency": "INR",
                                    "inclusiveOfTaxes": bool(tax_match),
                                },
                                "confidence": conf,
                                "needs_review": bool(conf < self.confidence_threshold),
                            }
                        except ValueError:
                            continue

        return {
            "found": False,
            "rawValue": None,
            "parsedValue": None,
            "confidence": 0.0,
            "needs_review": False,
        }

    # -------------------------------------------------------------------------
    # Field 2: Net Quantity
    # -------------------------------------------------------------------------
    def _extract_net_qty(
        self,
        tokens: List[TextPolygon],
        full_text: str,
        avg_ocr_conf: float,
        engine_agreement: float,
    ) -> Dict[str, Any]:
        # Stage 1: Regex
        match = self.net_qty_pattern.search(full_text)
        if match:
            magnitude = float(match.group(1))
            unit = match.group(2).lower()
            token_conf = self._find_token_confidence(match.group(0), tokens, avg_ocr_conf)
            conf = self._compute_confidence(token_conf, is_stage_one=True, engine_agreement=engine_agreement)

            return {
                "found": True,
                "rawValue": match.group(0),
                "parsedValue": {
                    "magnitude": magnitude,
                    "unit": unit,
                },
                "confidence": conf,
                "needs_review": bool(conf < self.confidence_threshold),
            }

        # Stage 2: Contextual fallback (Net keyword + adjacent unit quantity)
        for i, token in enumerate(tokens):
            t_upper = token.text.upper()
            if any(kw in t_upper for kw in ["NET", "WEIGHT", "QUANTITY", "QTY", "CONTENTS", "WT"]):
                for j in range(max(0, i - 1), min(len(tokens), i + 4)):
                    if j == i:
                        continue
                    candidate_match = self.standalone_qty_pattern.search(tokens[j].text)
                    if candidate_match:
                        magnitude = float(candidate_match.group(1))
                        unit = candidate_match.group(2).lower()
                        token_conf = (token.confidence + tokens[j].confidence) / 2.0
                        conf = self._compute_confidence(token_conf, is_stage_one=False, engine_agreement=engine_agreement)
                        return {
                            "found": True,
                            "rawValue": f"{token.text} {tokens[j].text}",
                            "parsedValue": {
                                "magnitude": magnitude,
                                "unit": unit,
                            },
                            "confidence": conf,
                            "needs_review": bool(conf < self.confidence_threshold),
                        }

        return {
            "found": False,
            "rawValue": None,
            "parsedValue": None,
            "confidence": 0.0,
            "needs_review": False,
        }

    # -------------------------------------------------------------------------
    # Field 3: Date of Packing
    # -------------------------------------------------------------------------
    def _extract_date(
        self,
        tokens: List[TextPolygon],
        full_text: str,
        avg_ocr_conf: float,
        engine_agreement: float,
    ) -> Dict[str, Any]:
        # Stage 1: Regex
        match = self.date_pattern.search(full_text)
        if match:
            token_conf = self._find_token_confidence(match.group(0), tokens, avg_ocr_conf)
            conf = self._compute_confidence(token_conf, is_stage_one=True, engine_agreement=engine_agreement)
            return {
                "found": True,
                "rawValue": match.group(0),
                "parsedValue": {"date_string": match.group(1)},
                "confidence": conf,
                "needs_review": bool(conf < self.confidence_threshold),
            }

        # Stage 2: Contextual fallback
        for i, token in enumerate(tokens):
            t_upper = token.text.upper()
            if any(kw in t_upper for kw in ["MFG", "PKD", "MFD", "PACKED", "EXP", "DATE"]):
                for j in range(max(0, i - 1), min(len(tokens), i + 3)):
                    date_cand = self.standalone_date_pattern.search(tokens[j].text)
                    if date_cand:
                        token_conf = (token.confidence + tokens[j].confidence) / 2.0
                        conf = self._compute_confidence(token_conf, is_stage_one=False, engine_agreement=engine_agreement)
                        return {
                            "found": True,
                            "rawValue": f"{token.text} {tokens[j].text}",
                            "parsedValue": {"date_string": date_cand.group(1)},
                            "confidence": conf,
                            "needs_review": bool(conf < self.confidence_threshold),
                        }

        return {"found": False, "rawValue": None, "confidence": 0.0, "needs_review": False}

    # -------------------------------------------------------------------------
    # Field 4: Consumer Care
    # -------------------------------------------------------------------------
    def _extract_consumer_care(
        self,
        tokens: List[TextPolygon],
        full_text: str,
        avg_ocr_conf: float,
        engine_agreement: float,
    ) -> Dict[str, Any]:
        email_match = self.consumer_care_email_pattern.search(full_text)
        phone_match = self.consumer_care_phone_pattern.search(full_text)

        if email_match or phone_match:
            raw_val = f"{email_match.group(0) if email_match else ''} {phone_match.group(0) if phone_match else ''}".strip()
            token_conf = self._find_token_confidence(raw_val, tokens, avg_ocr_conf)
            conf = self._compute_confidence(token_conf, is_stage_one=True, engine_agreement=engine_agreement)
            return {
                "found": True,
                "rawValue": raw_val,
                "parsedValue": {
                    "email": email_match.group(0) if email_match else None,
                    "phone": phone_match.group(1).strip() if phone_match else None,
                },
                "confidence": conf,
                "needs_review": bool(conf < self.confidence_threshold),
            }

        # Stage 2: Contextual keywords (care, helpline, contact)
        for i, token in enumerate(tokens):
            if any(kw in token.text.lower() for kw in ["helpline", "tollfree", "customer care", "feedback"]):
                token_conf = token.confidence
                conf = self._compute_confidence(token_conf, is_stage_one=False, engine_agreement=engine_agreement)
                return {
                    "found": True,
                    "rawValue": token.text,
                    "parsedValue": {"email": None, "phone": None},
                    "confidence": conf,
                    "needs_review": bool(conf < self.confidence_threshold),
                }

        return {
            "found": False,
            "rawValue": None,
            "parsedValue": None,
            "confidence": 0.0,
            "needs_review": False,
        }

    # -------------------------------------------------------------------------
    # Field 5: Country of Origin
    # -------------------------------------------------------------------------
    def _extract_country_of_origin(
        self,
        tokens: List[TextPolygon],
        full_text: str,
        avg_ocr_conf: float,
        engine_agreement: float,
    ) -> Dict[str, Any]:
        match = self.country_origin_pattern.search(full_text)
        if match:
            token_conf = self._find_token_confidence(match.group(0), tokens, avg_ocr_conf)
            conf = self._compute_confidence(token_conf, is_stage_one=True, engine_agreement=engine_agreement)
            return {
                "found": True,
                "rawValue": match.group(0),
                "parsedValue": {"country": match.group(1).strip()},
                "confidence": conf,
                "needs_review": bool(conf < self.confidence_threshold),
            }

        # Stage 2: Look for 'India' or common origins in tokens or full text
        for token in tokens:
            if re.search(r"\b(india|bharat|made in india)\b", token.text, re.I):
                conf = self._compute_confidence(token.confidence, is_stage_one=False, engine_agreement=engine_agreement)
                return {
                    "found": True,
                    "rawValue": token.text,
                    "parsedValue": {"country": "India"},
                    "confidence": conf,
                    "needs_review": bool(conf < self.confidence_threshold),
                }

        if re.search(r"\b(india|bharat)\b", full_text, re.I):
            conf = self._compute_confidence(avg_ocr_conf, is_stage_one=False, engine_agreement=engine_agreement)
            return {
                "found": True,
                "rawValue": "India",
                "parsedValue": {"country": "India"},
                "confidence": conf,
                "needs_review": bool(conf < self.confidence_threshold),
            }

        return {"found": False, "rawValue": None, "confidence": 0.0, "needs_review": False}

    # -------------------------------------------------------------------------
    # Field 6: Manufacturer Details
    # -------------------------------------------------------------------------
    def _extract_manufacturer(
        self,
        tokens: List[TextPolygon],
        full_text: str,
        avg_ocr_conf: float,
        engine_agreement: float,
    ) -> Dict[str, Any]:
        match = self.manufacturer_pattern.search(full_text)
        if match:
            token_conf = self._find_token_confidence(match.group(0), tokens, avg_ocr_conf)
            conf = self._compute_confidence(token_conf, is_stage_one=True, engine_agreement=engine_agreement)
            return {
                "found": True,
                "rawValue": match.group(0).strip(),
                "parsedValue": {"name_and_address": match.group(1).strip()},
                "confidence": conf,
                "needs_review": bool(conf < self.confidence_threshold),
            }

        # Stage 2: Contextual fallback (Ltd, Pvt, Foods, etc.)
        for i, token in enumerate(tokens):
            t_upper = token.text.upper()
            if any(kw in t_upper for kw in ["MFD BY", "MFG BY", "PACKED BY", "MARKETED BY"]):
                window = tokens[i : min(len(tokens), i + 5)]
                combined_text = " ".join(t.text for t in window)
                token_conf = sum(t.confidence for t in window) / len(window)
                conf = self._compute_confidence(token_conf, is_stage_one=False, engine_agreement=engine_agreement)
                return {
                    "found": True,
                    "rawValue": combined_text,
                    "parsedValue": {"name_and_address": combined_text},
                    "confidence": conf,
                    "needs_review": bool(conf < self.confidence_threshold),
                }

        return {"found": False, "rawValue": None, "confidence": 0.0, "needs_review": False}

    # -------------------------------------------------------------------------
    # Field 7: Use By / Expiry
    # -------------------------------------------------------------------------
    def _extract_use_by(
        self,
        tokens: List[TextPolygon],
        full_text: str,
        avg_ocr_conf: float,
        engine_agreement: float,
    ) -> Dict[str, Any]:
        match = self.use_by_pattern.search(full_text)
        if match:
            matched_str = match.group(0)
            date_val = match.group(1) if match.groups() else matched_str
            token_conf = self._find_token_confidence(matched_str, tokens, avg_ocr_conf)
            conf = self._compute_confidence(token_conf, is_stage_one=True, engine_agreement=engine_agreement)
            return {
                "found": True,
                "rawValue": matched_str,
                "parsedValue": {"date_string": date_val},
                "confidence": conf,
                "needs_review": bool(conf < self.confidence_threshold),
            }

        # Stage 2: Contextual fallback
        for i, token in enumerate(tokens):
            t_upper = token.text.upper()
            if any(kw in t_upper for kw in ["USEBY", "USE BY", "BEST BEFORE", "EXPIRY", "EXP"]):
                for j in range(max(0, i - 1), min(len(tokens), i + 4)):
                    if j == i:
                        continue
                    date_cand = re.search(r"([0-9A-Za-z]{3,4}[\/\-]20\d{2}|\d{1,2}[\/\-]20\d{2})", tokens[j].text, re.I)
                    if date_cand:
                        token_conf = (token.confidence + tokens[j].confidence) / 2.0
                        conf = self._compute_confidence(token_conf, is_stage_one=False, engine_agreement=engine_agreement)
                        return {
                            "found": True,
                            "rawValue": f"{token.text} {tokens[j].text}",
                            "parsedValue": {"date_string": date_cand.group(1)},
                            "confidence": conf,
                            "needs_review": bool(conf < self.confidence_threshold),
                        }

        return {"found": False, "rawValue": None, "confidence": 0.0, "needs_review": False}

    # -------------------------------------------------------------------------
    # Field 8: FSSAI License Number
    # -------------------------------------------------------------------------
    def _extract_fssai(
        self,
        tokens: List[TextPolygon],
        full_text: str,
        avg_ocr_conf: float,
        engine_agreement: float,
    ) -> Dict[str, Any]:
        match = self.fssai_pattern.search(full_text)
        if match:
            captured_val = None
            if match.groups():
                for g in match.groups():
                    if g and g.strip():
                        captured_val = g.strip()
                        break
            if not captured_val:
                captured_val = match.group(0).strip()

            cleaned_digits = re.sub(r"\D", "", captured_val)
            if len(cleaned_digits) >= 10:
                matched_str = match.group(0).strip()
                token_conf = self._find_token_confidence(matched_str, tokens, avg_ocr_conf)
                conf = self._compute_confidence(token_conf, is_stage_one=True, engine_agreement=engine_agreement)
                return {
                    "found": True,
                    "rawValue": matched_str,
                    "parsedValue": {"license_number": cleaned_digits},
                    "confidence": conf,
                    "needs_review": bool(conf < self.confidence_threshold or len(cleaned_digits) < 14),
                }

        # Stage 2: Contextual fallback (token with lic or fssai + digits)
        for token in tokens:
            cleaned = re.sub(r"\D", "", token.text)
            if len(cleaned) in (12, 14):
                conf = self._compute_confidence(token.confidence, is_stage_one=False, engine_agreement=engine_agreement)
                return {
                    "found": True,
                    "rawValue": token.text,
                    "parsedValue": {"license_number": cleaned},
                    "confidence": conf,
                    "needs_review": bool(conf < self.confidence_threshold),
                }

        return {"found": False, "rawValue": None, "confidence": 0.0, "needs_review": False}


# Alias for backward compatibility
DeclarationParser = DeclarationExtractor
