"""
Scan Analysis Orchestration Service
Coordinates the end-to-end pipeline:
Image Pipeline -> OCR Ensemble -> Reading Order Resolver -> Declaration Extractor -> Rule Engine -> Authenticity Verifier.
"""

import uuid
import os
import logging
from datetime import datetime
from typing import Optional, Dict, Any
import numpy as np
import cv2

from ..vision.image_pipeline import ImagePipeline
from ..vision.authenticity import AuthenticityVerifier
from ..ocr.ensemble import AdaptiveOCREnsemble
from ..extraction.reading_order import ReadingOrderResolver
from ..extraction.declaration_parser import DeclarationExtractor
from ..validation.rule_engine import RuleEngine
from core.database import SessionLocal
from core.db_models import ScanRecordDB, ProductMasterDB

logger = logging.getLogger(__name__)


class ScanService:
    def __init__(self):
        self.image_pipeline = ImagePipeline()
        self.ocr_ensemble = AdaptiveOCREnsemble()
        self.reading_order = ReadingOrderResolver()
        self.declaration_extractor = DeclarationExtractor()
        # Backwards compatible reference
        self.declaration_parser = self.declaration_extractor
        self.rule_engine = RuleEngine()
        self.authenticity_verifier = AuthenticityVerifier()

    def process_scan(
        self,
        image_bytes: bytes,
        gtin: Optional[str] = None,
        use_ensemble: bool = False,
    ) -> Dict[str, Any]:
        scan_id = f"scan_{uuid.uuid4().hex[:8]}_{int(datetime.utcnow().timestamp())}"

        # 1. Decode Image
        nparr = np.frombuffer(image_bytes, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        if img is None:
            raise ValueError("Invalid or corrupted image format")

        # 2. Image Preprocessing Pipeline (Deskew, CLAHE, Sharpness check)
        preprocessed_img, quality_info = self.image_pipeline.preprocess(img)

        # 3. Lookup GTIN if provided to seed product master reference
        product_name = "Packaged Consumer Commodity"
        brand_name = "Generic Brand"
        db = SessionLocal()
        try:
            if gtin:
                pm_record = db.query(ProductMasterDB).filter(ProductMasterDB.gtin == gtin).first()
                if pm_record:
                    product_name = pm_record.product_name
                    brand_name = pm_record.brand
        finally:
            db.close()

        # 4. OCR Ensemble (PaddleOCR primary, fallback to EasyOCR + TrOCR)
        ocr_result = self.ocr_ensemble.process(preprocessed_img, force_ensemble=use_ensemble)

        # 5. Reading Order Resolution
        ordered_tokens = self.reading_order.sort_tokens(ocr_result.tokens)

        # 6. Statutory Declarations Extraction (Regex -> Contextual with confidence)
        declarations = self.declaration_extractor.parse(
            ordered_tokens,
            engine_agreement_score=ocr_result.engine_agreement_score,
        )

        # 7. Rule Engine Compliance Check (Legal Metrology Rules 2011 + needs_review)
        compliance_status, field_checks = self.rule_engine.evaluate(declarations)

        # 8. Authenticity Verification (YOLOv8n logo crop + DINOv2 embeddings)
        authenticity_score = self.authenticity_verifier.verify(img, brand_name)

        # Extract net weight display string
        net_qty_data = declarations.get("net_quantity", {})
        net_weight_str = (
            f"{net_qty_data.get('parsedValue', {}).get('magnitude', '')} {net_qty_data.get('parsedValue', {}).get('unit', '')}".strip()
            if net_qty_data.get("found")
            else "N/A"
        )

        # 9. Persist ScanRecord to Database
        scanned_at_iso = datetime.utcnow().isoformat() + "Z"
        image_url = f"/uploads/{scan_id}.jpg"

        # Save annotated image on disk
        os.makedirs("./uploads", exist_ok=True)
        cv2.imwrite(f"./uploads/{scan_id}.jpg", preprocessed_img)

        db = SessionLocal()
        try:
            db_record = ScanRecordDB(
                id=scan_id,
                product_name=product_name,
                brand=brand_name,
                net_weight=net_weight_str,
                status=compliance_status,
                authenticity_score=authenticity_score,
                image_url=image_url,
                gtin=gtin,
                fields_data=field_checks,
            )
            db.add(db_record)
            db.commit()
        except Exception as e:
            logger.error(f"Error persisting scan record: {e}")
            db.rollback()
        finally:
            db.close()

        # Construct final ScanRecord matching API contract
        return {
            "id": scan_id,
            "productName": product_name,
            "brand": brand_name,
            "netWeight": net_weight_str,
            "scannedAt": scanned_at_iso,
            "status": compliance_status,
            "authenticityScore": authenticity_score,
            "imageUrl": image_url,
            "fields": field_checks,
            "gtin": gtin,
        }
