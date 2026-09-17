"""
Product Master & GTIN Catalog Router
Provides GTIN barcode verification and product master management.
"""

from typing import Optional
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from pydantic import BaseModel

from core.database import get_db
from core.db_models import ProductMasterDB
import api.gtin_lookup as gtin_lookup

router = APIRouter(tags=["Product Master & GTIN"])


class ProductMasterCreate(BaseModel):
    gtin: str
    brand: str
    productName: str
    category: Optional[str] = None
    standardNetQuantity: Optional[str] = None
    expectedMrpMin: Optional[float] = None
    expectedMrpMax: Optional[float] = None


class ProductMasterResponse(BaseModel):
    gtin: str
    brand: str
    productName: str
    category: Optional[str] = None
    standardNetQuantity: Optional[str] = None
    expectedMrpMin: Optional[float] = None
    expectedMrpMax: Optional[float] = None
    updatedAt: Optional[str] = None


@router.get("/api/products/{gtin}", response_model=ProductMasterResponse)
def get_product_by_gtin(gtin: str, db: Session = Depends(get_db)):
    # 1. Query database first
    record = db.query(ProductMasterDB).filter(ProductMasterDB.gtin == gtin).first()
    if record:
        return ProductMasterResponse(
            gtin=record.gtin,
            brand=record.brand,
            productName=record.product_name,
            category=record.category,
            standardNetQuantity=record.standard_net_quantity or record.net_quantity,
            expectedMrpMin=record.expected_mrp_min or record.standard_mrp,
            expectedMrpMax=record.expected_mrp_max or record.standard_mrp,
            updatedAt=record.updated_at.isoformat() if record.updated_at else None,
        )

    # 2. Fall back to gtin_lookup cache
    lookup_res = gtin_lookup.lookup_gtin(gtin)
    if lookup_res and lookup_res.get("found"):
        return ProductMasterResponse(
            gtin=gtin,
            brand=lookup_res.get("brand", "Unknown Brand"),
            productName=lookup_res.get("product_name", "Unknown Product"),
            category=lookup_res.get("category"),
            standardNetQuantity=lookup_res.get("net_weight"),
            expectedMrpMin=lookup_res.get("mrp"),
            expectedMrpMax=lookup_res.get("mrp"),
            updatedAt=datetime.now(timezone.utc).isoformat(),
        )

    raise HTTPException(status_code=404, detail=f"Product with GTIN {gtin} not found")


@router.post("/api/products", response_model=ProductMasterResponse, status_code=status.HTTP_201_CREATED)
def create_or_update_product(data: ProductMasterCreate, db: Session = Depends(get_db)):
    record = db.query(ProductMasterDB).filter(ProductMasterDB.gtin == data.gtin).first()
    now = datetime.now(timezone.utc)

    if record:
        record.brand = data.brand
        record.product_name = data.productName
        record.category = data.category
        record.standard_net_quantity = data.standardNetQuantity
        record.net_quantity = data.standardNetQuantity
        record.expected_mrp_min = data.expectedMrpMin
        record.expected_mrp_max = data.expectedMrpMax
        record.standard_mrp = data.expectedMrpMax or data.expectedMrpMin
        record.updated_at = now
    else:
        record = ProductMasterDB(
            gtin=data.gtin,
            brand=data.brand,
            product_name=data.productName,
            category=data.category,
            standard_net_quantity=data.standardNetQuantity,
            net_quantity=data.standardNetQuantity,
            expected_mrp_min=data.expectedMrpMin,
            expected_mrp_max=data.expectedMrpMax,
            standard_mrp=data.expectedMrpMax or data.expectedMrpMin,
            created_at=now,
            updated_at=now,
        )
        db.add(record)

    db.commit()
    db.refresh(record)

    return ProductMasterResponse(
        gtin=record.gtin,
        brand=record.brand,
        productName=record.product_name,
        category=record.category,
        standardNetQuantity=record.standard_net_quantity or record.net_quantity,
        expectedMrpMin=record.expected_mrp_min,
        expectedMrpMax=record.expected_mrp_max,
        updatedAt=record.updated_at.isoformat(),
    )


@router.get("/lookup-gtin")
def lookup_barcode(code: str = Query(..., description="EAN-13, UPC or GTIN code")):
    """Legacy alias for GTIN lookup."""
    return gtin_lookup.lookup_gtin(code)
