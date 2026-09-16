"""
Comprehensive Unit & Integration Tests:
Image Pipeline, Reading Order Resolver, Declaration Extractor, Rule Engine, and Authenticity Verifier.
"""

import pytest
import numpy as np
import cv2
from app.vision.image_pipeline import ImagePipeline
from app.vision.authenticity import AuthenticityVerifier
from app.extraction.reading_order import ReadingOrderResolver, ReadingOrderReconstructor
from app.extraction.declaration_parser import DeclarationExtractor, DeclarationParser
from app.validation.rule_engine import RuleEngine
from app.validation.field_validators import FieldValidators
from app.ocr.engine_base import TextPolygon
from app.services.scan_service import ScanService


# =============================================================================
# 1. Image Preprocessing Pipeline Tests
# =============================================================================

def test_image_pipeline_quality_check():
    pipeline = ImagePipeline()

    # High quality synthetic image (high variance texture)
    good_img = np.random.randint(50, 200, (300, 300, 3), dtype=np.uint8)
    q_good = pipeline.check_quality(good_img)
    assert "sharpness" in q_good
    assert "glare_ratio" in q_good
    assert q_good["sharpness"] > 0.0

    # Completely washed out / glare image
    glare_img = np.full((300, 300, 3), 255, dtype=np.uint8)
    q_glare = pipeline.check_quality(glare_img)
    assert q_glare["glare_ratio"] > 0.9
    assert q_glare["is_acceptable"] is False

    # Empty / corrupted image
    empty_img = np.zeros((0, 0, 3), dtype=np.uint8)
    q_empty = pipeline.check_quality(empty_img)
    assert q_empty["is_acceptable"] is False


def test_image_pipeline_deskew_and_clahe():
    pipeline = ImagePipeline()
    # Create image with horizontal text lines
    img = np.zeros((200, 400, 3), dtype=np.uint8)
    cv2.putText(img, "LEGAL METROLOGY INDIA", (30, 100), cv2.FONT_HERSHEY_SIMPLEX, 1.0, (255, 255, 255), 2)

    enhanced, quality_info = pipeline.preprocess(img)
    assert enhanced.shape == img.shape
    assert isinstance(quality_info, dict)


# =============================================================================
# 2. Reading Order Resolver Tests
# =============================================================================

def test_reading_order_resolver_line_grouping():
    resolver = ReadingOrderResolver()

    # Create tokens arranged in 2 lines:
    # Line 1 (y ≈ 50): "PACKED BY" at x=20, "XYZ FOODS LTD" at x=200
    # Line 2 (y ≈ 120): "NET WT:" at x=20, "500 g" at x=150, "MRP Rs. 150" at x=280
    # Shuffled input order
    tokens = [
        TextPolygon(text="MRP Rs. 150", bbox=[[280.0, 110.0], [380.0, 110.0], [380.0, 130.0], [280.0, 130.0]], confidence=0.95),
        TextPolygon(text="XYZ FOODS LTD", bbox=[[200.0, 40.0], [350.0, 40.0], [350.0, 60.0], [200.0, 60.0]], confidence=0.92),
        TextPolygon(text="NET WT:", bbox=[[20.0, 110.0], [120.0, 110.0], [120.0, 130.0], [20.0, 130.0]], confidence=0.98),
        TextPolygon(text="PACKED BY", bbox=[[20.0, 40.0], [150.0, 40.0], [150.0, 60.0], [20.0, 60.0]], confidence=0.90),
        TextPolygon(text="500 g", bbox=[[140.0, 110.0], [220.0, 110.0], [220.0, 130.0], [140.0, 130.0]], confidence=0.94),
    ]

    sorted_tokens = resolver.sort_tokens(tokens)
    text_sequence = [t.text for t in sorted_tokens]

    # Line 1 should be first: PACKED BY, then XYZ FOODS LTD
    assert text_sequence[0] == "PACKED BY"
    assert text_sequence[1] == "XYZ FOODS LTD"
    # Line 2 should be next: NET WT:, 500 g, MRP Rs. 150
    assert text_sequence[2] == "NET WT:"
    assert text_sequence[3] == "500 g"
    assert text_sequence[4] == "MRP Rs. 150"

    # Verify multiline text representation
    ordered_text = resolver.get_ordered_text(tokens)
    lines = ordered_text.split("\n")
    assert len(lines) == 2
    assert "PACKED BY XYZ FOODS LTD" in lines[0]
    assert "NET WT: 500 g MRP Rs. 150" in lines[1]

    # Backward compatibility alias
    alias_resolver = ReadingOrderReconstructor()
    assert len(alias_resolver.sort_tokens(tokens)) == len(tokens)


# =============================================================================
# 3. Declaration Extractor Tests (Regex & Contextual)
# =============================================================================

def test_declaration_extractor_stage1_regex():
    extractor = DeclarationExtractor()

    tokens = [
        TextPolygon(text="MRP Rs. 249.00 (Incl. of all taxes)", bbox=[[10.0, 10.0], [200.0, 10.0], [200.0, 30.0], [10.0, 30.0]], confidence=0.95),
        TextPolygon(text="Net Weight: 750 ml", bbox=[[10.0, 40.0], [150.0, 40.0], [150.0, 60.0], [10.0, 60.0]], confidence=0.92),
        TextPolygon(text="Mfg Date: 03/2026", bbox=[[10.0, 70.0], [140.0, 70.0], [140.0, 90.0], [10.0, 90.0]], confidence=0.90),
        TextPolygon(text="Consumer Care: 1800-222-333 care@nestle.in", bbox=[[10.0, 100.0], [300.0, 100.0], [300.0, 120.0], [10.0, 120.0]], confidence=0.91),
        TextPolygon(text="Country of Origin: India", bbox=[[10.0, 130.0], [180.0, 130.0], [180.0, 150.0], [10.0, 150.0]], confidence=0.94),
        TextPolygon(text="Manufactured by ABC Confectionery Ltd, Bangalore", bbox=[[10.0, 160.0], [350.0, 160.0], [350.0, 180.0], [10.0, 180.0]], confidence=0.89),
    ]

    declarations = extractor.parse(tokens, engine_agreement_score=1.0)

    # MRP
    assert declarations["mrp"]["found"] is True
    assert declarations["mrp"]["parsedValue"]["amount"] == 249.0
    assert declarations["mrp"]["parsedValue"]["inclusiveOfTaxes"] is True
    assert declarations["mrp"]["confidence"] >= 0.85
    assert declarations["mrp"]["needs_review"] is False

    # Net Quantity
    assert declarations["net_quantity"]["found"] is True
    assert declarations["net_quantity"]["parsedValue"]["magnitude"] == 750.0
    assert declarations["net_quantity"]["parsedValue"]["unit"] == "ml"
    assert declarations["net_quantity"]["needs_review"] is False

    # Date
    assert declarations["date_of_packing"]["found"] is True
    assert declarations["date_of_packing"]["parsedValue"]["date_string"] == "03/2026"

    # Consumer Care
    assert declarations["consumer_care"]["found"] is True
    assert declarations["consumer_care"]["parsedValue"]["email"] == "care@nestle.in"
    assert declarations["consumer_care"]["parsedValue"]["phone"] == "1800-222-333"

    # Country of Origin
    assert declarations["country_of_origin"]["found"] is True
    assert "India" in declarations["country_of_origin"]["parsedValue"]["country"]

    # Manufacturer Details
    assert declarations["manufacturer_details"]["found"] is True
    assert "ABC Confectionery Ltd" in declarations["manufacturer_details"]["parsedValue"]["name_and_address"]


def test_declaration_extractor_stage2_contextual():
    extractor = DeclarationExtractor()

    # Split tokens where direct regex on individual token fails regex anchor
    tokens = [
        TextPolygon(text="MAX RETAIL PRICE", bbox=[[10.0, 20.0], [120.0, 20.0], [120.0, 40.0], [10.0, 40.0]], confidence=0.85),
        TextPolygon(text="175.50", bbox=[[130.0, 20.0], [180.0, 20.0], [180.0, 40.0], [130.0, 40.0]], confidence=0.88),
        TextPolygon(text="NET QTY", bbox=[[10.0, 60.0], [80.0, 60.0], [80.0, 80.0], [10.0, 80.0]], confidence=0.87),
        TextPolygon(text="250 g", bbox=[[90.0, 60.0], [140.0, 60.0], [140.0, 80.0], [90.0, 80.0]], confidence=0.86),
        TextPolygon(text="PKD", bbox=[[10.0, 100.0], [50.0, 100.0], [50.0, 120.0], [10.0, 120.0]], confidence=0.85),
        TextPolygon(text="11/2025", bbox=[[60.0, 100.0], [120.0, 100.0], [120.0, 120.0], [60.0, 120.0]], confidence=0.84),
    ]

    declarations = extractor.parse(tokens, engine_agreement_score=0.9)

    # Contextual MRP extraction
    assert declarations["mrp"]["found"] is True
    assert declarations["mrp"]["parsedValue"]["amount"] == 175.50

    # Contextual Net Quantity extraction
    assert declarations["net_quantity"]["found"] is True
    assert declarations["net_quantity"]["parsedValue"]["magnitude"] == 250.0
    assert declarations["net_quantity"]["parsedValue"]["unit"] == "g"

    # Contextual Date extraction
    assert declarations["date_of_packing"]["found"] is True
    assert declarations["date_of_packing"]["parsedValue"]["date_string"] == "11/2025"


def test_declaration_low_confidence_flag():
    extractor = DeclarationExtractor(confidence_threshold=0.60)

    # Low OCR confidence tokens (< 0.60)
    tokens = [
        TextPolygon(text="MRP Rs. 99.00", bbox=[[10.0, 10.0], [100.0, 10.0], [100.0, 30.0], [10.0, 30.0]], confidence=0.45),
        TextPolygon(text="Net Qty: 100 g", bbox=[[10.0, 40.0], [100.0, 40.0], [100.0, 60.0], [10.0, 60.0]], confidence=0.50),
    ]

    declarations = extractor.parse(tokens, engine_agreement_score=0.7)

    assert declarations["mrp"]["found"] is True
    assert declarations["mrp"]["confidence"] < 0.60
    assert declarations["mrp"]["needs_review"] is True

    assert declarations["net_quantity"]["found"] is True
    assert declarations["net_quantity"]["confidence"] < 0.60
    assert declarations["net_quantity"]["needs_review"] is True


# =============================================================================
# 4. Rule Engine & Field Validators (Needs Review Hierarchy)
# =============================================================================

def test_rule_engine_low_confidence_triggers_needs_review():
    engine = RuleEngine()

    declarations = {
        "mrp": {
            "found": True,
            "rawValue": "MRP Rs. 200.00 (incl of all taxes)",
            "parsedValue": {"amount": 200.0, "currency": "INR", "inclusiveOfTaxes": True},
            "confidence": 0.52,  # Low confidence < 0.60
            "needs_review": True,
        },
        "net_quantity": {
            "found": True,
            "rawValue": "Net Qty: 200 g",
            "parsedValue": {"magnitude": 200.0, "unit": "g"},
            "confidence": 0.95,
            "needs_review": False,
        },
        "consumer_care": {
            "found": True,
            "rawValue": "care@brand.com 1800-111-222",
            "parsedValue": {"email": "care@brand.com", "phone": "1800-111-222"},
            "confidence": 0.92,
            "needs_review": False,
        },
        "manufacturer_details": {
            "found": True,
            "rawValue": "Mfg by ABC Ltd, Delhi",
            "parsedValue": {"name_and_address": "ABC Ltd, Delhi"},
            "confidence": 0.91,
            "needs_review": False,
        },
        "date_of_packing": {
            "found": True,
            "rawValue": "Pkd: 01/2026",
            "parsedValue": {"date_string": "01/2026"},
            "confidence": 0.90,
            "needs_review": False,
        },
    }

    status, checks = engine.evaluate(declarations)

    # Low confidence field should have status 'needs_review'
    mrp_check = next(c for c in checks if c["fieldName"] == "mrp")
    assert mrp_check["status"] == "needs_review"
    assert "manual" in mrp_check["message"].lower() or "review" in mrp_check["message"].lower()

    # Overall status should be 'needs_review'
    assert status == "needs_review"


def test_rule_engine_status_hierarchy():
    engine = RuleEngine()

    # Case A: Both fail and needs_review present -> overall is 'fail'
    declarations_fail = {
        "mrp": {
            "found": True,
            "rawValue": "MRP Rs. 100",
            "parsedValue": {"amount": 100.0, "currency": "INR", "inclusiveOfTaxes": True},
            "confidence": 0.45,  # needs_review
            "needs_review": True,
        },
        "net_quantity": {
            "found": False,  # Mandatory missing -> fail
            "confidence": 0.0,
        },
    }
    status_fail, _ = engine.evaluate(declarations_fail)
    assert status_fail == "fail"

    # Case B: Both warning and needs_review present -> overall is 'needs_review'
    declarations_nr = {
        "mrp": {
            "found": True,
            "rawValue": "MRP Rs. 100",
            "parsedValue": {"amount": 100.0, "currency": "INR", "inclusiveOfTaxes": False},  # Missing taxes -> warning
            "confidence": 0.95,
            "needs_review": False,
        },
        "consumer_care": {
            "found": True,
            "rawValue": "care@brand.in",
            "parsedValue": {"email": "care@brand.in", "phone": None},
            "confidence": 0.50,  # needs_review
            "needs_review": True,
        },
        "net_quantity": {
            "found": True,
            "rawValue": "500 g",
            "parsedValue": {"magnitude": 500.0, "unit": "g"},
            "confidence": 0.95,
        },
    }
    status_nr, _ = engine.evaluate(declarations_nr)
    assert status_nr == "needs_review"


# =============================================================================
# 5. Authenticity Verifier Tests
# =============================================================================

def test_authenticity_verifier_registered_brand():
    verifier = AuthenticityVerifier()
    test_img = np.random.randint(0, 255, (200, 200, 3), dtype=np.uint8)

    # Registered brand Britannia
    score = verifier.verify(test_img, "Britannia")
    assert score is not None
    assert isinstance(score, float)
    assert 0.0 <= score <= 1.0


def test_authenticity_verifier_unregistered_or_empty_brand():
    verifier = AuthenticityVerifier()
    test_img = np.random.randint(0, 255, (200, 200, 3), dtype=np.uint8)

    # Unregistered brand
    score_unreg = verifier.verify(test_img, "Unknown Nonexistent Brand XYZ")
    assert score_unreg is None

    # Empty / None brand
    assert verifier.verify(test_img, None) is None
    assert verifier.verify(test_img, "") is None


# =============================================================================
# 6. End-to-End ScanService Orchestration Test
# =============================================================================

def test_scan_service_end_to_end():
    service = ScanService()

    # Create a synthetic image with text
    img = np.zeros((300, 500, 3), dtype=np.uint8)
    cv2.putText(img, "MRP Rs. 150 (Incl. of all taxes)", (20, 60), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 255), 2)
    cv2.putText(img, "Net Wt: 250 g", (20, 120), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 255), 2)
    cv2.putText(img, "care@brand.in 1800-111-222", (20, 180), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 2)

    _, encoded_jpg = cv2.imencode(".jpg", img)
    image_bytes = encoded_jpg.tobytes()

    result = service.process_scan(image_bytes=image_bytes, gtin=None, use_ensemble=False)

    # Verify response matches contract
    assert "id" in result
    assert "productName" in result
    assert "brand" in result
    assert "status" in result
    assert result["status"] in ["pass", "warning", "fail", "needs_review"]
    assert "authenticityScore" in result
    assert "fields" in result
    assert isinstance(result["fields"], list)
    assert len(result["fields"]) > 0
