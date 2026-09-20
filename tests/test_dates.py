import pytest
from pipeline.field_extractor import normalize_date_token, extract_fields
from pipeline.field_rules import MANDATORY_FIELDS

def test_dot_matrix_date_normalization():
    # Dot matrix month typos
    assert normalize_date_token("1UN/2026") == "JUN/2026"
    assert normalize_date_token("IUN-2026") == "JUN/2026"
    assert normalize_date_token("0CT/2025") == "OCT/2025"
    assert normalize_date_token("0EC/2024") == "DEC/2024"
    assert normalize_date_token("F3B/2026") == "FEB/2026"
    assert normalize_date_token("S3P/2025") == "SEP/2025"
    assert normalize_date_token("AU6/2026") == "AUG/2026"
    assert normalize_date_token("N0V/2025") == "NOV/2025"

    # Year 2-digit to 4-digit disambiguation
    assert normalize_date_token("06/25") == "06/2025"
    assert normalize_date_token("JUN/26") == "JUN/2026"
    assert normalize_date_token("15/08/25") == "15/08/2025"

def test_mrp_symbol_tolerance_and_extraction():
    # MRP with ? symbol (PaddleOCR currency confusion)
    raw_results = [
        {"text": "MRP: ? 120.00 (Incl. of all taxes)", "confidence": 0.94, "box": [[0,0],[10,0],[10,10],[0,10]], "source": "paddle"}
    ]
    fields, _, _ = extract_fields(raw_results)
    assert fields["mrp"]["found"] is True
    assert fields["mrp"]["captured"] == "120.00"

    # MRP with ₹
    raw_results2 = [
        {"text": "MRP ₹ 49.50", "confidence": 0.92, "box": [[0,0],[10,0],[10,10],[0,10]], "source": "paddle"}
    ]
    fields2, _, _ = extract_fields(raw_results2)
    assert fields2["mrp"]["found"] is True
    assert fields2["mrp"]["captured"] == "49.50"

def test_strict_fssai_validation():
    # Valid 14 digit FSSAI
    valid_results = [
        {"text": "FSSAI Lic No: 10020021000123", "confidence": 0.95, "box": [[0,0],[10,0],[10,10],[0,10]], "source": "paddle"}
    ]
    fields, _, _ = extract_fields(valid_results)
    assert fields["fssai"]["found"] is True
    assert fields["fssai"]["captured"] == "10020021000123"

    # Invalid length (e.g. 10 digits phone number mistagged as FSSAI)
    invalid_results = [
        {"text": "Lic No: 9876543210", "confidence": 0.95, "box": [[0,0],[10,0],[10,10],[0,10]], "source": "paddle"}
    ]
    fields_inv, _, _ = extract_fields(invalid_results)
    assert fields_inv["fssai"]["found"] is False

    # Spaced digits FSSAI
    spaced_results = [
        {"text": "FSSAI Lic. No. 100 120 11000 123", "confidence": 0.95, "box": [[0,0],[10,0],[10,10],[0,10]], "source": "paddle"}
    ]
    fields_sp, _, _ = extract_fields(spaced_results)
    assert fields_sp["fssai"]["found"] is True
    assert fields_sp["fssai"]["captured"] == "10012011000123"

    # Near-miss with OCR bounding noise
    near_results = [
        {"text": "Lic No: 12421906000121", "confidence": 0.95, "box": [[0,0],[10,0],[10,10],[0,10]], "source": "paddle"}
    ]
    fields_nr, _, _ = extract_fields(near_results)
    assert fields_nr["fssai"]["found"] is True
    assert fields_nr["fssai"]["captured"] == "12421906000121"
