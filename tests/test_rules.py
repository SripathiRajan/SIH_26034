"""
Unit Tests for Rule Engine & Field Validators
"""

from app.validation.rule_engine import RuleEngine


def test_rule_engine_pass():
    engine = RuleEngine()
    declarations = {
        "mrp": {
            "found": True,
            "rawValue": "MRP Rs. 500.00 (Incl. of all taxes)",
            "parsedValue": {"amount": 500.0, "currency": "INR", "inclusiveOfTaxes": True},
            "confidence": 0.95,
        },
        "net_quantity": {
            "found": True,
            "rawValue": "Net Qty: 500 g",
            "parsedValue": {"magnitude": 500.0, "unit": "g"},
            "confidence": 0.96,
        },
        "consumer_care": {
            "found": True,
            "rawValue": "care@brand.in 1800-111-222",
            "parsedValue": {"email": "care@brand.in", "phone": "1800-111-222"},
            "confidence": 0.92,
        },
        "manufacturer_details": {
            "found": True,
            "rawValue": "Manufactured by ABC Foods Ltd, Mumbai",
            "parsedValue": {"name_and_address": "ABC Foods Ltd, Mumbai"},
            "confidence": 0.90,
        },
        "date_of_packing": {
            "found": True,
            "rawValue": "Pkd: 05/2026",
            "parsedValue": {"date_string": "05/2026"},
            "confidence": 0.91,
        },
    }

    status, checks = engine.evaluate(declarations)
    assert status == "pass"
    mrp_check = next(c for c in checks if c["fieldName"] == "mrp")
    assert mrp_check["status"] == "pass"


def test_rule_engine_missing_taxes_warning():
    engine = RuleEngine()
    declarations = {
        "mrp": {
            "found": True,
            "rawValue": "MRP Rs. 500.00",
            "parsedValue": {"amount": 500.0, "currency": "INR", "inclusiveOfTaxes": False},
            "confidence": 0.95,
        },
        "net_quantity": {
            "found": True,
            "rawValue": "Net Qty: 500 g",
            "parsedValue": {"magnitude": 500.0, "unit": "g"},
            "confidence": 0.96,
        },
        "consumer_care": {
            "found": True,
            "rawValue": "care@brand.in",
            "parsedValue": {"email": "care@brand.in", "phone": None},
            "confidence": 0.92,
        },
    }

    status, checks = engine.evaluate(declarations)
    assert status == "warning"
    mrp_check = next(c for c in checks if c["fieldName"] == "mrp")
    assert mrp_check["status"] == "warning"


def test_rule_engine_missing_mandatory_fail():
    engine = RuleEngine()
    declarations = {
        "mrp": {"found": False},
        "net_quantity": {"found": False},
    }

    status, checks = engine.evaluate(declarations)
    assert status == "fail"
    mrp_check = next(c for c in checks if c["fieldName"] == "mrp")
    assert mrp_check["status"] == "fail"
