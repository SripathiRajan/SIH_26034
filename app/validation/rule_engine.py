"""
Legal Metrology Rule Engine
Evaluates extracted fields against statutory requirements defined in rules.json.
Determines compliance status ('pass', 'warning', 'fail', 'needs_review').
"""

import json
import os
from typing import Dict, Any, List, Tuple
from .field_validators import FieldValidators


class RuleEngine:
    def __init__(self, rules_path: str = None):
        if rules_path is None:
            rules_path = os.path.join(os.path.dirname(__file__), "rules.json")
        with open(rules_path, "r", encoding="utf-8") as f:
            self.rules_config = json.load(f)
        self.rules = self.rules_config.get("rules", [])

    def evaluate(self, declarations: Dict[str, Any]) -> Tuple[str, List[Dict[str, Any]]]:
        """
        Evaluates declarations and returns overall status ('pass', 'warning', 'fail', 'needs_review')
        along with list of FieldCheck items.
        """
        field_checks: List[Dict[str, Any]] = []
        statuses = []

        for rule in self.rules:
            field_name = rule["field"]
            field_data = declarations.get(field_name, {"found": False})
            conditions = rule.get("conditions", {})

            if field_name == "mrp":
                status, msg = FieldValidators.validate_mrp(field_data, conditions)
            elif field_name == "net_quantity":
                status, msg = FieldValidators.validate_net_quantity(field_data, conditions)
            elif field_name == "consumer_care":
                status, msg = FieldValidators.validate_consumer_care(field_data, conditions)
            else:
                status, msg = FieldValidators.validate_generic(field_data, rule)

            statuses.append(status)
            field_checks.append({
                "fieldName": field_name,
                "found": field_data.get("found", False),
                "rawValue": field_data.get("rawValue"),
                "parsedValue": field_data.get("parsedValue"),
                "confidence": field_data.get("confidence", 0.0),
                "status": status,
                "ruleRef": rule.get("ruleRef"),
                "message": msg,
            })

        # Overall status resolution hierarchy: fail > needs_review > warning > pass
        if "fail" in statuses:
            overall_status = "fail"
        elif "needs_review" in statuses:
            overall_status = "needs_review"
        elif "warning" in statuses:
            overall_status = "warning"
        else:
            overall_status = "pass"

        return overall_status, field_checks
