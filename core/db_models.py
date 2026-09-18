# core/db_models.py
import os
import json
from datetime import datetime, timezone
from sqlalchemy import Column, String, Float, DateTime, Text, Boolean
from core.database import Base


class ScanRecordDB(Base):
    """
    Audit trail for every scan call.
    fields_json: JSON-serialised list of FieldCheck dicts.
    ocr_engines_json: JSON-serialised list of engine name strings.
    """
    __tablename__ = "scan_records"

    id                 = Column(String(64),  primary_key=True, index=True)
    product_name       = Column(String(256), nullable=True, default="Unknown Product")
    brand              = Column(String(128), nullable=True, default="Unknown Brand")
    gtin               = Column(String(32),  nullable=True, index=True)
    net_weight         = Column(String(64),  nullable=True)
    status             = Column(String(32),  nullable=False, index=True)   # "pass"/"warning"/"fail"/"needs_review"
    authenticity_score = Column(Float,       nullable=True, default=0.0)  # 0–100 or 0.0-1.0
    thumbnail_color    = Column(String(16),  nullable=False, default="#607D8B")
    image_path         = Column(String(512), nullable=True)
    processing_time    = Column(Float,       nullable=True)
    compliance_score   = Column(Float,       nullable=True)
    fields_json        = Column(Text,        nullable=False, default="[]")
    ocr_engines_json   = Column(Text,        nullable=False, default="[]")
    scanned_at         = Column(DateTime,    nullable=False, default=lambda: datetime.now(timezone.utc))
    user_id            = Column(String(64),  nullable=True)
    notes              = Column(Text,        nullable=True, default="")

    @property
    def image_url(self) -> str:
        if self.image_path:
            return f"/uploads/{os.path.basename(self.image_path)}"
        return ""

    @image_url.setter
    def image_url(self, val: str):
        self.image_path = val

    @property
    def fields_data(self):
        return self.fields_list()

    @fields_data.setter
    def fields_data(self, val):
        if isinstance(val, (list, dict)):
            self.fields_json = json.dumps(val)
        elif isinstance(val, str):
            self.fields_json = val

    def fields_list(self):
        try:
            return json.loads(self.fields_json) if isinstance(self.fields_json, str) else (self.fields_json or [])
        except Exception:
            return []

    def engines_list(self):
        try:
            return json.loads(self.ocr_engines_json) if isinstance(self.ocr_engines_json, str) else (self.ocr_engines_json or [])
        except Exception:
            return []


class UserDB(Base):
    """Enforcement officer accounts."""
    __tablename__ = "users"

    id              = Column(String(64),  primary_key=True, index=True)
    username        = Column(String(256), unique=True, nullable=True, index=True)
    email           = Column(String(256), unique=True, nullable=True, index=True)
    hashed_password = Column(String(256), nullable=False)
    full_name       = Column(String(256), nullable=True)
    role            = Column(String(32),  nullable=False, default="inspector")
    zone            = Column(String(128), nullable=True)   # for zoneBreakdown stats
    is_active       = Column(Boolean,     nullable=False, default=True)
    created_at      = Column(DateTime,    nullable=False, default=lambda: datetime.now(timezone.utc))


class ProductMasterDB(Base):
    """
    Official brand/product master for GTIN cross-verification.
    Extends the existing gtin_cache.db with brand logo verification data.
    """
    __tablename__ = "product_master"

    gtin                  = Column(String(32),   primary_key=True, index=True)
    brand                 = Column(String(128),  nullable=False)
    product_name          = Column(String(256),  nullable=False)
    standard_mrp          = Column(Float,        nullable=True)
    expected_mrp_min      = Column(Float,        nullable=True)
    expected_mrp_max      = Column(Float,        nullable=True)
    net_quantity          = Column(String(64),   nullable=True)
    standard_net_quantity = Column(String(64),   nullable=True)
    category              = Column(String(128),  nullable=True)
    country_origin        = Column(String(64),   nullable=True)
    logo_embedding        = Column(Text,         nullable=True)
    created_at            = Column(DateTime,     nullable=False, default=lambda: datetime.now(timezone.utc))
    updated_at            = Column(DateTime,     nullable=False, default=lambda: datetime.now(timezone.utc))
