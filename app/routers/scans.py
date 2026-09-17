"""
Scans Router
Coordinates scan inspection, history retrieval, PDF generation, and dashboard statistics.
"""

import os
import shutil
import uuid
import time
import json
import asyncio
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Dict, Any
from collections import Counter

from fastapi import APIRouter, UploadFile, File, Form, Depends, HTTPException, Query, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from pydantic import BaseModel

from core.config import UPLOAD_DIR, SCAN_HISTORY_PAGE_SIZE, BASE_DIR
from core.logger import logger
from core.database import get_db
from core.db_models import ScanRecordDB, ProductMasterDB
from core.auth import get_current_user
from pipeline.ensemble_pipeline import ensemble_scan
from api.response_mapper import pipeline_report_to_scan_record
from app.services.scan_service import ScanService
import api.gtin_lookup as gtin_lookup

router = APIRouter(tags=["Scans & Compliance Analysis"])
executor = ThreadPoolExecutor(max_workers=4)
IST = timezone(timedelta(hours=5, minutes=30))
_scan_service = ScanService()


def _format_scan_record(r: ScanRecordDB) -> Dict[str, Any]:
    scanned_at_dt = r.scanned_at
    if scanned_at_dt.tzinfo is None:
        scanned_at_dt = scanned_at_dt.replace(tzinfo=timezone.utc)
    scanned_at_iso = scanned_at_dt.astimezone(IST).isoformat()
    scanned_at_date = scanned_at_dt.astimezone(IST).strftime("%d %b %Y, %I:%M %p")

    image_uri = f"/uploads/{os.path.basename(r.image_path)}" if r.image_path else ""

    # Compliance confidence: stored compliance-derived score, 0-100. None stays None — no fake default.
    conf_score = r.authenticity_score
    if conf_score is not None and conf_score <= 1.0:
        conf_score = int(conf_score * 100)
    elif conf_score is not None:
        conf_score = int(conf_score)

    return {
        "id": r.id,
        "productName": r.product_name or "Unknown Product",
        "brand": r.brand or "Unknown Brand",
        "netWeight": r.net_weight or "",
        "scannedAt": scanned_at_iso,
        "date": scanned_at_date,
        "status": r.status,
        "complianceConfidence": conf_score,
        "thumbnailColor": r.thumbnail_color or "#607D8B",
        "imageUri": image_uri,
        "imageUrl": image_uri,
        "processingTime": r.processing_time or 0.0,
        "ocrEnginesUsed": r.engines_list(),
        "fields": r.fields_list(),
        "gtin": r.gtin,
    }


# ── Scan Execution Endpoints ─────────────────────────────────────────────

@router.post("/api/analyze")
@router.post("/api/scan")
@router.post("/api/scans")
async def analyze_package_image(
    image: Optional[UploadFile] = File(None),
    file: Optional[UploadFile] = File(None),
    gtin: Optional[str] = Form(None),
    use_ensemble: Optional[bool] = Form(False),
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Primary real-time scan endpoint used by React Native / Expo mobile client & CB2 callers.
    Executes the 5-stage cascaded OCR ensemble, ReadingOrderResolver,
    DeclarationExtractor, and RuleEngine.
    """
    upload = image or file
    if not upload:
        raise HTTPException(status_code=400, detail="An image or file upload is required")

    scan_id = f"scan_{uuid.uuid4().hex[:12]}"
    ext = os.path.splitext(upload.filename or "img.jpg")[1] or ".jpg"
    file_path = os.path.join(UPLOAD_DIR, f"{scan_id}{ext}")

    with open(file_path, "wb") as f:
        shutil.copyfileobj(upload.file, f)

    try:
        # 1. Barcode GTIN cross-check
        gtin_data = None
        if gtin:
            pm = db.query(ProductMasterDB).filter(ProductMasterDB.gtin == gtin).first()
            if pm:
                gtin_data = {
                    "found": True,
                    "gtin": gtin,
                    "brand": pm.brand,
                    "product_name": pm.product_name,
                    "net_weight": pm.standard_net_quantity or pm.net_quantity,
                    "mrp": pm.expected_mrp_max or pm.standard_mrp,
                }
            else:
                gtin_data = gtin_lookup.lookup_gtin(gtin)
                if gtin_data and "gtin" not in gtin_data:
                    gtin_data["gtin"] = gtin

        # 2. Parallel cascaded OCR scan
        loop = asyncio.get_running_loop()
        report = await loop.run_in_executor(
            executor,
            lambda: ensemble_scan(file_path, use_ensemble=bool(use_ensemble)),
        )

        # 3. Check for annotated image
        annotated_name = f"ensemble_{scan_id}_result.png"
        src = os.path.join(BASE_DIR, f"ensemble_{os.path.splitext(os.path.basename(file_path))[0]}_result.png")
        dst = os.path.join(UPLOAD_DIR, annotated_name)
        if os.path.exists(src):
            shutil.move(src, dst)

        image_uri = f"/uploads/{annotated_name}" if os.path.exists(dst) else f"/uploads/{os.path.basename(file_path)}"

        # 4. Map report to frontend contract
        scan_record = pipeline_report_to_scan_record(report, scan_id, image_uri, gtin_data)

        # 5. Persist to database
        db_row = ScanRecordDB(
            id=scan_id,
            product_name=scan_record["productName"],
            brand=scan_record["brand"],
            gtin=gtin,
            net_weight=scan_record["netWeight"],
            status=scan_record["status"],
            authenticity_score=scan_record["complianceConfidence"],
            thumbnail_color=scan_record["thumbnailColor"],
            image_path=dst if os.path.exists(dst) else file_path,
            processing_time=scan_record.get("processingTime"),
            compliance_score=report.get("compliance_score"),
            fields_json=json.dumps(scan_record["fields"]),
            ocr_engines_json=json.dumps(scan_record.get("ocrEnginesUsed", [])),
            user_id=current_user.id if current_user else None,
        )
        db.add(db_row)
        db.commit()

        logger.info(f"[/api/analyze] {scan_id} -> {scan_record['status']} (conf={scan_record['complianceConfidence']})")
        return scan_record

    except Exception as e:
        logger.error(f"[/api/analyze] Scan failed: {e}")
        raise HTTPException(status_code=500, detail=f"Scan processing failed: {str(e)}")



# ── Scan Retrieval Endpoints ─────────────────────────────────────────────

@router.get("/api/scans")
def list_scans(
    page: int = Query(1, ge=1),
    limit: Optional[int] = Query(None, ge=1, le=100),
    offset: Optional[int] = Query(None, ge=0),
    status_filter: Optional[str] = Query(None, alias="status"),
    db: Session = Depends(get_db),
):
    """
    List historical scan records with pagination and optional status filter.
    Returns both 'scans' and 'items' for dual CB1 & CB2 frontend/test compatibility.
    """
    q = db.query(ScanRecordDB).order_by(ScanRecordDB.scanned_at.desc())
    if status_filter:
        q = q.filter(ScanRecordDB.status == status_filter.lower())

    total = q.count()
    page_size = limit or SCAN_HISTORY_PAGE_SIZE
    skip = offset if offset is not None else (page - 1) * page_size

    records = q.offset(skip).limit(page_size).all()
    formatted = [_format_scan_record(r) for r in records]

    return {
        "scans": formatted,
        "items": formatted,
        "total": total,
        "page": page,
        "pageSize": page_size,
        "limit": page_size,
        "offset": skip,
    }


@router.get("/api/scans/{scan_id}")
def get_scan(scan_id: str, db: Session = Depends(get_db)):
    record = db.query(ScanRecordDB).filter(ScanRecordDB.id == scan_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Scan record not found")
    return _format_scan_record(record)


@router.delete("/api/scans/{scan_id}")
def delete_scan(scan_id: str, db: Session = Depends(get_db)):
    record = db.query(ScanRecordDB).filter(ScanRecordDB.id == scan_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Scan record not found")
    db.delete(record)
    db.commit()
    return {"status": "success", "id": scan_id}


@router.get("/api/scans/{scan_id}/pdf")
@router.get("/api/scans/{scan_id}/report.pdf")
def get_scan_pdf(scan_id: str, db: Session = Depends(get_db)):
    from app.services.pdf_service import generate_audit_pdf
    record = db.query(ScanRecordDB).filter(ScanRecordDB.id == scan_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Scan record not found")

    pdf_path = generate_audit_pdf(record)
    return FileResponse(
        pdf_path,
        media_type="application/pdf",
        filename=f"praman_audit_{scan_id}.pdf",
        headers={"Content-Disposition": f'attachment; filename="praman_audit_{scan_id}.pdf"'},
    )


# ── Dashboard Statistics Endpoint ────────────────────────────────────────

@router.get("/api/stats")
@router.get("/api/dashboard/stats")
def get_dashboard_stats(db: Session = Depends(get_db)):
    """
    Aggregates compliance metrics for the React Native Dashboard screen & test suites.
    """
    all_records = db.query(ScanRecordDB).all()
    total = len(all_records)

    if total == 0:
        return {
            "totalScans": 0,
            "statusCounts": {"pass": 0, "warning": 0, "fail": 0, "needs_review": 0},
            "complianceRatePercent": 100.0,
            "violationsByField": {},
            "recentScans": [],
            "violationRate": 0.0,
            "lowConfidenceFlags": 0,
            "avgSecondsPerScan": 0.0,
            "compliantCount": 0,
            "nonCompliantCount": 0,
            "topViolationFields": [],
            "topFlaggedBrands": [],
            "dailyCounts": [],
            "categoryBreakdown": [],
            "zoneBreakdown": [],
        }

    pass_c = sum(1 for r in all_records if r.status == "pass")
    warn_c = sum(1 for r in all_records if r.status == "warning")
    nr_c = sum(1 for r in all_records if r.status == "needs_review")
    fail_only = sum(1 for r in all_records if r.status == "fail")
    fail_c = fail_only + nr_c
    non_c = warn_c + fail_c
    flags = sum(1 for r in all_records if (r.authenticity_score or 0) < 50)
    avg_t = round(sum(r.processing_time or 0.0 for r in all_records) / total, 2)
    compliance_rate = round(pass_c / total * 100, 1)

    field_fails = Counter()
    for r in all_records:
        for f in r.fields_list():
            if f.get("status") in ("fail", "warning", "needs_review"):
                field_fails[f.get("label") or f.get("fieldName") or "Unknown"] += 1

    brand_v = Counter()
    for r in all_records:
        if r.status in ("warning", "fail", "needs_review"):
            brand_v[r.brand] += 1

    daily: Dict[str, Any] = {}
    for r in all_records:
        d = r.scanned_at.strftime("%Y-%m-%d")
        if d not in daily:
            daily[d] = {"day": d, "pass": 0, "warning": 0, "fail": 0}
        stat_key = "fail" if r.status == "needs_review" else r.status
        daily[d][stat_key] = daily[d].get(stat_key, 0) + 1

    recent = [_format_scan_record(r) for r in sorted(all_records, key=lambda x: x.scanned_at, reverse=True)[:5]]

    # Real category breakdown, derived from the product master catalog via scanned GTINs.
    # Scans without a known GTIN/category are reported as Uncategorized — no fabricated splits.
    gtins = [r.gtin for r in all_records if r.gtin]
    gtin_category: Dict[str, Optional[str]] = {}
    if gtins:
        for pm in db.query(ProductMasterDB).filter(ProductMasterDB.gtin.in_(gtins)).all():
            gtin_category[pm.gtin] = pm.category
    cat_counts: Counter = Counter()
    cat_violations: Counter = Counter()
    for r in all_records:
        category = (gtin_category.get(r.gtin) if r.gtin else None) or "Uncategorized"
        cat_counts[category] += 1
        if r.status in ("warning", "fail", "needs_review"):
            cat_violations[category] += 1

    return {
        "totalScans": total,
        "statusCounts": {
            "pass": pass_c,
            "warning": warn_c,
            "fail": fail_only,
            "needs_review": nr_c,
        },
        "complianceRatePercent": compliance_rate,
        "violationsByField": dict(field_fails.most_common(10)),
        "recentScans": recent,
        "violationRate": round(non_c / total * 100, 1),
        "lowConfidenceFlags": flags,
        "avgSecondsPerScan": avg_t,
        "compliantCount": pass_c,
        "nonCompliantCount": non_c,
        "topViolationFields": [
            {"label": l, "count": c, "percentage": round(c / total * 100, 1)}
            for l, c in field_fails.most_common(5)
        ],
        "topFlaggedBrands": [
            {"brand": b, "violations": c} for b, c in brand_v.most_common(5)
        ],
        "dailyCounts": sorted(daily.values(), key=lambda x: x["day"])[-7:],
        "categoryBreakdown": [
            {
                "category": cat,
                "count": n,
                "violationRate": round(cat_violations[cat] / n * 100, 1) if n else 0.0,
            }
            for cat, n in cat_counts.most_common()
        ],
        # Zone analytics remain empty until officers are actually assigned zones in their profiles.
        "zoneBreakdown": [],
    }
