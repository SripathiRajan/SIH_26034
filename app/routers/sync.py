"""
Offline Synchronization Router
Accepts offline scans taken during network dropouts and processes them into audit database.
"""

import base64
import logging
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.services.scan_service import ScanService

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/scans", tags=["Offline Sync"])

_scan_service = ScanService()


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
async def sync_offline_scans(payload: OfflineSyncPayload):
    """
    Synchronizes offline scans captured by mobile client during network outage.
    Processes each base64-encoded frame through the inspection pipeline,
    persists scan records into database, and returns processed verdicts.
    """
    synced_ids = []
    processed_records = []

    for item in payload.scans:
        try:
            base64_str = item.imageBase64
            if "," in base64_str:
                base64_str = base64_str.split(",", 1)[1]

            image_bytes = base64.b64decode(base64_str)
            scan_result = _scan_service.process_scan(
                image_bytes=image_bytes,
                gtin=item.gtin,
                use_ensemble=False,
            )
            synced_ids.append(item.clientScanId)
            processed_records.append(scan_result)
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
