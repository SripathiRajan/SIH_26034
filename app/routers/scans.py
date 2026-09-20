"""
Scans Router
Coordinates scan inspection, history retrieval, PDF generation, and dashboard statistics.
"""

import os
import uuid
import json
import asyncio
from concurrent.futures import ThreadPoolExecutor
from datetime import timezone, timedelta
from typing import Optional, Dict, Any
from collections import Counter

from fastapi import APIRouter, UploadFile, File, Form, Depends, HTTPException, Query, Request
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from sqlalchemy import func
from pydantic import BaseModel

from core.config import UPLOAD_DIR, SCAN_HISTORY_PAGE_SIZE
from core.logger import logger
from core.database import get_db
from core.db_models import ScanRecordDB, ProductMasterDB
from core.auth import get_current_user, require_current_user
from core.limiter import limiter
from pipeline.ensemble_pipeline import ensemble_scan
from api.response_mapper import pipeline_report_to_scan_record
import api.gtin_lookup as gtin_lookup

router = APIRouter(tags=["Scans & Compliance Analysis"])
executor = ThreadPoolExecutor(max_workers=4)
IST = timezone(timedelta(hours=5, minutes=30))


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
        "notes": getattr(r, "notes", "") or "",
    }


# ── Scan Execution Endpoints ─────────────────────────────────────────────

@router.post("/api/analyze")
@router.post("/api/scan")
@router.post("/api/scans")
@limiter.limit("20/minute")
async def analyze_package_image(
    request: Request,
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

    ALLOWED_MAGIC = {
        b'\xff\xd8\xff': '.jpg',
        b'\x89PNG': '.png',
        b'RIFF': '.webp'
    }
    MAX_BYTES = 10 * 1024 * 1024  # 10 MB

    header = await upload.read(4)
    await upload.seek(0)

    ext = None
    for magic, extension in ALLOWED_MAGIC.items():
        if header.startswith(magic):
            ext = extension
            break
    if not ext:
        raise HTTPException(
            status_code=400,
            detail="Invalid image format. Only JPEG, PNG, and WebP images with valid headers are accepted."
        )

    content = await upload.read()
    if len(content) > MAX_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"File exceeds maximum allowable size of {MAX_BYTES // (1024 * 1024)}MB"
        )

    scan_id = f"scan_{uuid.uuid4().hex[:12]}"
    file_path = os.path.join(UPLOAD_DIR, f"{scan_id}{ext}")

    with open(file_path, "wb") as f:
        f.write(content)

    try:
        # 1. Barcode GTIN cross-check
        gtin_data = gtin_lookup.resolve_gtin_metadata(db, gtin)

        # 2. Parallel cascaded OCR scan
        loop = asyncio.get_running_loop()
        report = await loop.run_in_executor(
            executor,
            lambda: ensemble_scan(file_path, use_ensemble=bool(use_ensemble)),
        )

        # 3. Auto-detect GTIN from OCR tokens if not explicitly provided
        if not gtin and not gtin_data:
            detected_gtin, detected_data = gtin_lookup.auto_detect_gtin_metadata(db, report)
            if detected_gtin:
                gtin = detected_gtin
                gtin_data = detected_data

        # 4. Check for annotated image
        annotated_name = f"ensemble_{scan_id}_result.png"
        annotated_path = os.path.join(UPLOAD_DIR, annotated_name)
        image_uri = f"/uploads/{annotated_name}" if os.path.exists(annotated_path) else f"/uploads/{os.path.basename(file_path)}"

        # 5. Map report to frontend contract
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
            image_path=annotated_path if os.path.exists(annotated_path) else file_path,
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
        logger.error(f"[/api/analyze] Scan failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Scan processing failed. Please retry or contact support.")



# ── Scan Retrieval Endpoints ─────────────────────────────────────────────

@router.get("/api/scans")
def list_scans(
    page: int = Query(1, ge=1),
    limit: Optional[int] = Query(None, ge=1, le=100),
    offset: Optional[int] = Query(None, ge=0),
    status_filter: Optional[str] = Query(None, alias="status"),
    user=Depends(require_current_user),
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
def get_scan(scan_id: str, user=Depends(require_current_user), db: Session = Depends(get_db)):
    record = db.query(ScanRecordDB).filter(ScanRecordDB.id == scan_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Scan record not found")
    return _format_scan_record(record)


@router.delete("/api/scans/{scan_id}")
def delete_scan(scan_id: str, user=Depends(require_current_user), db: Session = Depends(get_db)):
    record = db.query(ScanRecordDB).filter(ScanRecordDB.id == scan_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Scan record not found")
    db.delete(record)
    db.commit()
    return {"status": "success", "id": scan_id}


class UpdateNotesRequest(BaseModel):
    notes: str


@router.patch("/api/scans/{scan_id}/notes")
def update_scan_notes(
    scan_id: str,
    payload: UpdateNotesRequest,
    user=Depends(require_current_user),
    db: Session = Depends(get_db),
):
    record = db.query(ScanRecordDB).filter(ScanRecordDB.id == scan_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Scan record not found")
    record.notes = payload.notes
    db.commit()
    return {"status": "success", "id": scan_id, "notes": record.notes}


@router.get("/api/scans/{scan_id}/pdf")
@router.get("/api/scans/{scan_id}/report.pdf")
def get_scan_pdf(scan_id: str, user=Depends(require_current_user), db: Session = Depends(get_db)):
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
def get_dashboard_stats(user=Depends(require_current_user), db: Session = Depends(get_db)):
    """
    Aggregates compliance metrics for the React Native Dashboard screen & test suites.
    Uses SQL aggregation for high efficiency across large audit tables.
    """
    total = db.query(func.count(ScanRecordDB.id)).scalar() or 0

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

    status_counts_raw = db.query(ScanRecordDB.status, func.count(ScanRecordDB.id)).group_by(ScanRecordDB.status).all()
    sc_dict = dict(status_counts_raw)
    pass_c = sc_dict.get("pass", 0)
    warn_c = sc_dict.get("warning", 0)
    nr_c = sc_dict.get("needs_review", 0)
    fail_only = sc_dict.get("fail", 0)
    fail_c = fail_only + nr_c
    non_c = warn_c + fail_c

    flags = db.query(func.count(ScanRecordDB.id)).filter(ScanRecordDB.authenticity_score < 50).scalar() or 0
    raw_avg = db.query(func.avg(ScanRecordDB.processing_time)).scalar()
    avg_t = round(float(raw_avg), 2) if raw_avg else 0.0
    compliance_rate = round(pass_c / total * 100, 1)

    recent_rows = db.query(ScanRecordDB).order_by(ScanRecordDB.scanned_at.desc()).limit(5).all()
    recent = [_format_scan_record(r) for r in recent_rows]

    # Sample latest records for field violation breakdown, brands, and daily counts
    sampled_rows = db.query(
        ScanRecordDB.fields_json,
        ScanRecordDB.brand,
        ScanRecordDB.status,
        ScanRecordDB.scanned_at,
        ScanRecordDB.gtin
    ).order_by(ScanRecordDB.scanned_at.desc()).limit(1000).all()

    field_fails = Counter()
    brand_v = Counter()
    daily: Dict[str, Any] = {}

    for r in sampled_rows:
        f_list = []
        try:
            f_list = json.loads(r.fields_json) if isinstance(r.fields_json, str) else (r.fields_json or [])
        except Exception:
            pass
        for f in f_list:
            if f.get("status") in ("fail", "warning", "needs_review"):
                field_fails[f.get("label") or f.get("fieldName") or "Unknown"] += 1

        if r.status in ("warning", "fail", "needs_review"):
            brand_v[r.brand or "Unknown Brand"] += 1

        d = r.scanned_at.strftime("%Y-%m-%d") if r.scanned_at else ""
        if d:
            if d not in daily:
                daily[d] = {"day": d, "pass": 0, "warning": 0, "fail": 0}
            stat_key = "fail" if r.status == "needs_review" else r.status
            daily[d][stat_key] = daily[d].get(stat_key, 0) + 1

    # Real category breakdown, derived from the product master catalog via scanned GTINs.
    gtins = [r.gtin for r in sampled_rows if r.gtin]
    gtin_category: Dict[str, Optional[str]] = {}
    if gtins:
        for pm in db.query(ProductMasterDB).filter(ProductMasterDB.gtin.in_(gtins)).all():
            gtin_category[pm.gtin] = pm.category
    cat_counts: Counter = Counter()
    cat_violations: Counter = Counter()
    for r in sampled_rows:
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
