"""
Modular Field Validators
Implements statutory validation logic for Legal Metrology (Packaged Commodities) Rules, 2011.
Flags low-confidence extractions (< 0.60) as 'needs_review'.
"""

from typing import Dict, Any, Tuple
from ..config import settings


class FieldValidators:
    @staticmethod
    def _is_low_confidence(field_data: Dict[str, Any]) -> bool:
        threshold = getattr(settings, "EXTRACTION_CONFIDENCE_THRESHOLD", 0.60)
        return bool(
            field_data.get("needs_review")
            or (field_data.get("found") and field_data.get("confidence", 0.0) < threshold)
        )

    @classmethod
    def validate_mrp(cls, field_data: Dict[str, Any], rule_conditions: Dict[str, Any]) -> Tuple[str, str]:
        if not field_data.get("found"):
            return "fail", "MRP declaration missing from package"

        if cls._is_low_confidence(field_data):
            conf = field_data.get("confidence", 0.0)
            return "needs_review", f"Low extraction confidence ({conf:.2f} < 0.60) for MRP - requires manual verification"

        parsed = field_data.get("parsedValue") or {}
        amount = parsed.get("amount", 0.0)
        inclusive = parsed.get("inclusiveOfTaxes", False)

        if amount <= 0:
            return "fail", "MRP amount must be a positive numeric value"

        if rule_conditions.get("requireInclusiveOfTaxes", True) and not inclusive:
            return "warning", "MRP declared but missing '(inclusive of all taxes)' statement"

        return "pass", "Valid MRP declaration with tax inclusion statement"

    @classmethod
    def validate_net_quantity(cls, field_data: Dict[str, Any], rule_conditions: Dict[str, Any]) -> Tuple[str, str]:
        if not field_data.get("found"):
            return "fail", "Net quantity declaration missing"

        if cls._is_low_confidence(field_data):
            conf = field_data.get("confidence", 0.0)
            return "needs_review", f"Low extraction confidence ({conf:.2f} < 0.60) for Net Quantity - requires manual verification"

        parsed = field_data.get("parsedValue") or {}
        unit = parsed.get("unit", "").lower()
        magnitude = parsed.get("magnitude", 0.0)

        allowed_units = rule_conditions.get(
            "allowedUnits", ["g", "kg", "ml", "l", "ltr", "m", "cm", "u", "n", "units"]
        )

        if magnitude <= 0:
            return "fail", "Net quantity magnitude must be greater than zero"

        if unit not in allowed_units:
            return "fail", f"Non-standard unit '{unit}' declared. Must use standard metric units"

        return "pass", f"Valid net quantity in standard metric units ({magnitude} {unit})"

    @classmethod
    def validate_consumer_care(cls, field_data: Dict[str, Any], rule_conditions: Dict[str, Any]) -> Tuple[str, str]:
        if not field_data.get("found"):
            return "fail", "Mandatory consumer care details (Rule 6(1)(h)) missing"

        if cls._is_low_confidence(field_data):
            conf = field_data.get("confidence", 0.0)
            return "needs_review", f"Low extraction confidence ({conf:.2f} < 0.60) for Consumer Care - requires manual verification"

        parsed = field_data.get("parsedValue") or {}
        email = parsed.get("email")
        phone = parsed.get("phone")

        if not email and not phone:
            return "fail", "Neither consumer care email nor telephone number found"

        if email and not phone:
            return "warning", "Consumer care email provided; telephone number recommended"

        return "pass", "Consumer care contact details compliant"

    @classmethod
    def validate_generic(cls, field_data: Dict[str, Any], rule_def: Dict[str, Any]) -> Tuple[str, str]:
        is_found = field_data.get("found", False)
        is_mandatory = rule_def.get("mandatory", False)
        rule_ref = rule_def.get("ruleRef", "")

        if not is_found:
            if is_mandatory:
                severity = rule_def.get("failureSeverity", "fail")
                return severity, f"Mandatory declaration ({rule_ref}) is missing"
            return "pass", f"Optional declaration ({rule_ref}) omitted"

        if cls._is_low_confidence(field_data):
            conf = field_data.get("confidence", 0.0)
            return "needs_review", f"Low extraction confidence ({conf:.2f} < 0.60) for {rule_ref} - requires manual verification"

        return "pass", f"Declaration present and compliant ({rule_ref})"
