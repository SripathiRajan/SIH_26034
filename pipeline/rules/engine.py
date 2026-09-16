# pipeline/rules/engine.py
"""
4-State statutory rule evaluator.
Reads rules.json and enriches FieldCheck dicts with legal citations,
rule explanations, and machine-readable violation reasons.
"""
import json
import os
from typing import Dict, Any

_RULES_PATH = os.path.join(os.path.dirname(__file__), "rules.json")

def _load_rules() -> Dict:
    with open(_RULES_PATH, "r", encoding="utf-8") as f:
        return json.load(f)

_RULES_CACHE = None

def get_rules() -> Dict:
    global _RULES_CACHE
    if _RULES_CACHE is None:
        _RULES_CACHE = _load_rules()
    return _RULES_CACHE


def enrich_field_checks(field_checks: list) -> list:
    """
    Takes the FieldCheck[] list from response_mapper and enriches each item
    with statutory citations and violation explanations from rules.json.
    Called from response_mapper.py after building the base field check list.
    """
    rules = get_rules()
    field_rules = rules.get("fields", {})

    enriched = []
    for fc in field_checks:
        field_name = fc.get("fieldName", "")
        rule_data = field_rules.get(field_name, {})

        fc["ruleRef"]         = rule_data.get("rule_ref",         fc.get("ruleRef", ""))
        fc["ruleCitation"]    = rule_data.get("rule_citation",     fc.get("ruleCitation", ""))
        fc["ruleExplanation"] = rule_data.get("rule_explanation",  fc.get("ruleExplanation", ""))

        # Refine violation reason using statutory language
        if fc.get("status") == "fail":
            fc["violationReason"] = rule_data.get("fail_condition",    fc.get("violationReason", ""))
            fc["detail"]          = f"VIOLATION: {rule_data.get('penalty', 'Penalty applies')}"
        elif fc.get("status") == "warning":
            fc["violationReason"] = rule_data.get("warning_condition", fc.get("violationReason", ""))
            fc["detail"]          = "Please photograph remaining package faces to confirm compliance"

        enriched.append(fc)
    return enriched
