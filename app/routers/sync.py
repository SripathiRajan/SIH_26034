"""
Offline Synchronization Router
Accepts offline scans taken during network dropouts and processes them into audit database
using the unified ensemble scan pipeline.
"""

import os
import uuid
import json
import base64
import asyncio
import logging
from typing import List, Optional, Dict, Any
from concurrent.futures import ThreadPoolExecutor

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from core.database import get_db
from core.config import UPLOAD_DIR
from core.db_models import ScanRecordDB, ProductMasterDB
from pipeline.ensemble_pipeline import ensemble_scan
from api.response_mapper import pipeline_report_to_scan_record
import api.gtin_lookup as gtin_lookup

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/scans", tags=["Offline Sync"])
executor = ThreadPoolExecutor(max_workers=2)


class OfflineSyncItem(BaseModel):
    clientScanId: str
    timestamp: str
    gtin: Optional[str] = None
    imageBase64: str


class OfflineSyncPayload(BaseModel):
    deviceId: str
    scans: List[OfflineSyncItem]


class OfflineSyncResponse(BaseModel):
    status: str
    deviceId: str
    syncedCount: int
    syncedClientIds: List[str]
    results: List[Dict[str, Any]]


@router.post("/sync", response_model=OfflineSyncResponse)
async def sync_offline_scans(
    payload: OfflineSyncPayload,
    db: Session = Depends(get_db),
):
    """
    Synchronizes offline scans captured by mobile client during network outage.
    Processes each base64-encoded frame through the unified inspection pipeline,
    persists scan records into database, and returns processed verdicts.
    """
    synced_ids = []
    processed_records = []
    loop = asyncio.get_running_loop()

    for item in payload.scans:
        try:
            base64_str = item.imageBase64
            if "," in base64_str:
                base64_str = base64_str.split(",", 1)[1]

            image_bytes = base64.b64decode(base64_str)
            scan_id = f"sync_{uuid.uuid4().hex[:12]}"
            file_path = os.path.join(UPLOAD_DIR, f"{scan_id}.jpg")

            with open(file_path, "wb") as f:
                f.write(image_bytes)

            # 1. Product GTIN lookup
            gtin_data = None
            if item.gtin:
                pm = db.query(ProductMasterDB).filter(ProductMasterDB.gtin == item.gtin).first()
                if pm:
                    gtin_data = {
                        "found": True,
                        "gtin": item.gtin,
                        "brand": pm.brand,
                        "product_name": pm.product_name,
                        "net_weight": pm.standard_net_quantity or pm.net_quantity,
                        "mrp": pm.expected_mrp_max or pm.standard_mrp,
                    }
                else:
                    gtin_data = gtin_lookup.lookup_gtin(item.gtin)
                    if gtin_data and "gtin" not in gtin_data:
                        gtin_data["gtin"] = item.gtin

            # 2. Run pipeline
            report = await loop.run_in_executor(
                executor,
                lambda: ensemble_scan(file_path, save_annotation=False, use_ensemble=False)
            )

            # 3. Map to client scan record
            image_uri = f"/uploads/{os.path.basename(file_path)}"
            scan_record = pipeline_report_to_scan_record(report, scan_id, image_uri, gtin_data)

            # 4. Save to DB
            db_row = ScanRecordDB(
                id=scan_id,
                product_name=scan_record["productName"],
                brand=scan_record["brand"],
                gtin=item.gtin,
                net_weight=scan_record["netWeight"],
                status=scan_record["status"],
                authenticity_score=scan_record["complianceConfidence"],
                thumbnail_color=scan_record["thumbnailColor"],
                image_path=file_path,
                processing_time=scan_record.get("processingTime"),
                compliance_score=report.get("compliance_score"),
                fields_json=json.dumps(scan_record["fields"]),
                ocr_engines_json=json.dumps(scan_record.get("ocrEnginesUsed", [])),
            )
            db.add(db_row)
            db.commit()
            db.refresh(db_row)

            synced_ids.append(item.clientScanId)
            processed_records.append(scan_record)

        except Exception as exc:
            logger.warning(f"Failed to sync offline item {item.clientScanId}: {exc}")
            continue

    return {
        "status": "success",
        "deviceId": payload.deviceId,
        "syncedCount": len(synced_ids),
        "syncedClientIds": synced_ids,
        "results": processed_records,
    }
