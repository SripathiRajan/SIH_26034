"""
Multi-Angle Package Scanning Session Router
Enables capturing, merging, and inspecting packaged commodities from multiple angles.
Features:
- In-memory session management with 15-minute TTL and LRU eviction (max 20 sessions)
- Batch upload (1-6 images per batch)
- Strict sequential OCR execution on Windows
- Live mandatory-field statutory coverage calculation
- Atomic single-record persistence on finalization
- Idempotent discard with temporary file cleanup
"""

import os
import time
import uuid
import json
import asyncio
import threading
from typing import List, Optional, Dict, Any

from fastapi import APIRouter, UploadFile, File, Form, Depends, HTTPException, Request, Response, status
from sqlalchemy.orm import Session

from core.config import UPLOAD_DIR, MIN_SHARPNESS_LAPLACIAN
from core.image_utils import compute_sharpness, check_glare
from core.logger import logger
from core.database import get_db
from core.db_models import ScanRecordDB, ProductMasterDB
from core.auth import get_current_user, require_current_user
from core.limiter import limiter
from pipeline.ensemble_pipeline import ensemble_scan
from pipeline.field_rules import MANDATORY_FIELDS
from api.compliance_merger import merge_package_faces
from api.response_mapper import pipeline_report_to_scan_record
import api.gtin_lookup as gtin_lookup

router = APIRouter(tags=["Multi-Angle Scan Sessions"])

# ── Session Constraints ──────────────────────────────────────────────────
SESSION_TTL_SECONDS = 15 * 60  # 15 minutes TTL
MAX_ACTIVE_SESSIONS = 20       # LRU eviction limit
MAX_IMAGES_PER_BATCH = 6

ALLOWED_MAGIC = {
    b'\xff\xd8\xff': '.jpg',
    b'\x89PNG': '.png',
    b'RIFF': '.webp'
}
MAX_IMAGE_BYTES = 10 * 1024 * 1024  # 10 MB per image


class ScanView:
    def __init__(
        self,
        view_id: str,
        image_path: str,
        annotated_path: str,
        pipeline_report: Dict[str, Any],
        quality: Dict[str, Any],
        elapsed_seconds: float,
    ):
        self.view_id = view_id
        self.image_path = image_path
        self.annotated_path = annotated_path
        self.pipeline_report = pipeline_report
        self.quality = quality
        self.elapsed_seconds = elapsed_seconds

    def to_dict(self) -> Dict[str, Any]:
        return {
            "view_id": self.view_id,
            "image_path": self.image_path,
            "annotated_path": self.annotated_path,
            "pipeline_report": self.pipeline_report,
            "quality": self.quality,
            "elapsed_seconds": self.elapsed_seconds,
        }


class ScanSession:
    def __init__(self, session_id: str, gtin: Optional[str] = None):
        self.session_id = session_id
        self.gtin = gtin
        self.views: List[ScanView] = []
        self.created_at = time.time()
        self.last_accessed_at = time.time()

    def touch(self):
        self.last_accessed_at = time.time()

    def is_expired(self, now: Optional[float] = None) -> bool:
        if now is None:
            now = time.time()
        return (now - self.last_accessed_at) > SESSION_TTL_SECONDS

    def cleanup_files(self):
        for v in self.views:
            for p in (v.image_path, v.annotated_path):
                if p and os.path.exists(p):
                    try:
                        os.remove(p)
                    except Exception as e:
                        logger.warning(f"Error removing session file {p}: {e}")


class SessionStore:
    """Thread-safe in-memory session manager with TTL and LRU eviction."""

    def __init__(self):
        self._sessions: Dict[str, ScanSession] = {}
        self._lock = threading.Lock()

    def _purge_expired_locked(self, now: float):
        expired_ids = [sid for sid, s in self._sessions.items() if s.is_expired(now)]
        for sid in expired_ids:
            sess = self._sessions.pop(sid, None)
            if sess:
                logger.info(f"[SessionStore] Evicting expired session {sid} (TTL exceeded)")
                sess.cleanup_files()

    def _evict_lru_locked(self):
        while len(self._sessions) >= MAX_ACTIVE_SESSIONS:
            oldest_sid = min(self._sessions.keys(), key=lambda k: self._sessions[k].last_accessed_at)
            sess = self._sessions.pop(oldest_sid, None)
            if sess:
                logger.info(f"[SessionStore] LRU capacity eviction: removing oldest session {oldest_sid}")
                sess.cleanup_files()

    def create(self, gtin: Optional[str] = None, session_id: Optional[str] = None) -> ScanSession:
        with self._lock:
            now = time.time()
            self._purge_expired_locked(now)
            self._evict_lru_locked()

            sid = session_id or f"sess_{uuid.uuid4().hex[:12]}"
            sess = ScanSession(sid, gtin=gtin)
            self._sessions[sid] = sess
            logger.info(f"[SessionStore] Created new scan session {sid} (active: {len(self._sessions)})")
            return sess

    def get(self, session_id: str, touch: bool = True) -> Optional[ScanSession]:
        with self._lock:
            now = time.time()
            self._purge_expired_locked(now)
            sess = self._sessions.get(session_id)
            if sess:
                if sess.is_expired(now):
                    self._sessions.pop(session_id, None)
                    sess.cleanup_files()
                    return None
                if touch:
                    sess.touch()
            return sess

    def remove(self, session_id: str, delete_files: bool = True) -> bool:
        with self._lock:
            sess = self._sessions.pop(session_id, None)
            if sess:
                if delete_files:
                    sess.cleanup_files()
                return True
            return False

    def count(self) -> int:
        with self._lock:
            return len(self._sessions)


# Global in-memory session store
session_store = SessionStore()


def _lookup_gtin_data(db: Session, gtin: Optional[str]) -> Optional[Dict[str, Any]]:
    if not gtin:
        return None
    pm = db.query(ProductMasterDB).filter(ProductMasterDB.gtin == gtin).first()
    if pm:
        return {
            "found": True,
            "gtin": gtin,
            "brand": pm.brand,
            "product_name": pm.product_name,
            "net_weight": pm.standard_net_quantity or pm.net_quantity,
            "mrp": pm.expected_mrp_max or pm.standard_mrp,
            "expected_mrp_range": {
                "min": pm.expected_mrp_min or 0.0,
                "max": pm.expected_mrp_max or float("inf"),
            } if (pm.expected_mrp_min or pm.expected_mrp_max) else None,
            "declared_net_qty": pm.standard_net_quantity or pm.net_quantity,
        }
    data = gtin_lookup.lookup_gtin(gtin)
    if data and "gtin" not in data:
        data["gtin"] = gtin
    return data


# ── Endpoint 1: Upload View(s) / Create / Resume Session ──────────────────

@router.post("/api/scan/session")
@limiter.limit("20/minute")
async def process_session_views(
    request: Request,
    images: List[UploadFile] = File(...),
    session_id: Optional[str] = Form(None),
    gtin: Optional[str] = Form(None),
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Accepts 1-6 package images for a multi-angle scan session.
    - If session_id is absent: creates a new in-memory session.
    - If session_id exists: resumes that session and appends views.
    - Validates image magic headers and file size.
    - Sequentially processes each view through ensemble_scan (avoiding parallel OCR races).
    - Merges results using merge_package_faces and builds live mandatory-field coverage.
    """
    if not images or len(images) < 1:
        raise HTTPException(status_code=400, detail="At least 1 image is required")
    if len(images) > MAX_IMAGES_PER_BATCH:
        raise HTTPException(
            status_code=400,
            detail=f"Maximum {MAX_IMAGES_PER_BATCH} images can be uploaded in one batch"
        )

    # 1. Resolve or create session
    cleaned_session_id = session_id.strip() if (session_id and session_id.strip()) else None
    cleaned_gtin = gtin.strip() if (gtin and gtin.strip()) else None

    if cleaned_session_id:
        session = session_store.get(cleaned_session_id, touch=True)
        if not session:
            raise HTTPException(
                status_code=404,
                detail=f"Scan session '{cleaned_session_id}' not found or expired (TTL: 15 min)."
            )
        if cleaned_gtin and not session.gtin:
            session.gtin = cleaned_gtin
    else:
        session = session_store.create(gtin=cleaned_gtin)

    # 2. Validate all uploaded files before saving
    saved_images: List[Dict[str, Any]] = []

    for idx, upload in enumerate(images):
        header = await upload.read(4)
        await upload.seek(0)

        ext = None
        for magic, extension in ALLOWED_MAGIC.items():
            if header.startswith(magic):
                ext = extension
                break
        if not ext:
            # Clean up any already saved images in this batch before failing
            for s in saved_images:
                if os.path.exists(s["path"]):
                    os.remove(s["path"])
            raise HTTPException(
                status_code=400,
                detail=f"Invalid image format for '{upload.filename}'. Only JPEG, PNG, and WebP images with valid headers are accepted."
            )

        content = await upload.read()
        if len(content) > MAX_IMAGE_BYTES:
            for s in saved_images:
                if os.path.exists(s["path"]):
                    os.remove(s["path"])
            raise HTTPException(
                status_code=413,
                detail=f"File '{upload.filename}' exceeds maximum allowable size of {MAX_IMAGE_BYTES // (1024 * 1024)}MB"
            )

        view_index = len(session.views) + idx + 1
        view_id = f"view_{view_index}_{uuid.uuid4().hex[:6]}"
        file_path = os.path.join(UPLOAD_DIR, f"{session.session_id}_{view_id}{ext}")

        with open(file_path, "wb") as f:
            f.write(content)

        saved_images.append({
            "path": file_path,
            "view_id": view_id,
            "base": f"{session.session_id}_{view_id}",
        })

    # 3. Process views SEQUENTIALLY through ensemble_scan
    loop = asyncio.get_running_loop()

    for item in saved_images:
        img_path = item["path"]
        view_id = item["view_id"]
        t_start = time.time()

        # Compute image quality metrics
        sharpness = compute_sharpness(img_path)
        glare_ok, glare_ratio = check_glare(img_path)
        is_sharp = sharpness >= MIN_SHARPNESS_LAPLACIAN

        quality = {
            "sharpness": round(sharpness, 2),
            "glareRatio": glare_ratio,
            "isAcceptable": bool(is_sharp and glare_ok),
            "issues": [],
        }
        if not is_sharp:
            quality["issues"].append(f"Image may be blurry (sharpness {sharpness:.1f} < {MIN_SHARPNESS_LAPLACIAN})")
        if not glare_ok:
            quality["issues"].append(f"High glare detected ({glare_ratio:.1%})")

        # Strict sequential execution: wait for current view to finish before starting the next
        report = await loop.run_in_executor(
            None,
            lambda p=img_path: ensemble_scan(p, session_mode=True),
        )
        elapsed_sec = round(time.time() - t_start, 2)

        annotated_name = f"ensemble_{item['base']}_result.png"
        annotated_path = os.path.join(UPLOAD_DIR, annotated_name)
        final_annotated = annotated_path if os.path.exists(annotated_path) else img_path

        scan_view = ScanView(
            view_id=view_id,
            image_path=img_path,
            annotated_path=final_annotated,
            pipeline_report=report,
            quality=quality,
            elapsed_seconds=elapsed_sec,
        )
        session.views.append(scan_view)

    # 4. Merge all views accumulated in the session
    gtin_data = _lookup_gtin_data(db, session.gtin)

    face_results = [
        {
            "face_label": v.view_id,
            "fields": v.pipeline_report.get("fields", {}),
            "user_instructions": v.pipeline_report.get("user_instructions", []),
        }
        for v in session.views
    ]

    merged_report = merge_package_faces(
        face_results=face_results,
        gtin_data=gtin_data,
        package_type="packet",
    )
    merged_fields = merged_report.get("merged_fields", {})

    # 5. Build live mandatory-field coverage
    mandatory_keys = list(MANDATORY_FIELDS.keys())
    found_keys = [k for k in mandatory_keys if merged_fields.get(k, {}).get("found")]
    missing_keys = [k for k in mandatory_keys if not merged_fields.get(k, {}).get("found")]
    all_found = len(missing_keys) == 0

    hint_line = ""
    if all_found:
        hint_line = "All mandatory statutory declarations detected across captured views."
    elif merged_report.get("user_instructions"):
        first_inst = merged_report["user_instructions"][0]
        hint_line = first_inst.get("instruction") if isinstance(first_inst, dict) else str(first_inst)
    else:
        missing_labels = [MANDATORY_FIELDS[k]["label"] for k in missing_keys[:3]]
        hint_line = f"Capture remaining angles to find: {', '.join(missing_labels)}"

    merged_coverage = {
        "found": found_keys,
        "missing": missing_keys,
        "hintLine": hint_line,
        "allFound": all_found,
    }

    # Aggregate quality metrics
    avg_sharpness = round(sum(v.quality["sharpness"] for v in session.views) / len(session.views), 2)
    overall_quality = {
        "averageSharpness": avg_sharpness,
        "isAcceptable": all(v.quality["isAcceptable"] for v in session.views),
        "latest": session.views[-1].quality if session.views else None,
        "views": [v.quality for v in session.views],
    }

    return {
        "sessionId": session.session_id,
        "viewsCaptured": len(session.views),
        "mergedCoverage": merged_coverage,
        "quality": overall_quality,
        "fields": merged_fields,
    }


# ── Endpoint 2: Finalize Session ──────────────────────────────────────────

@router.post("/api/scan/session/{session_id}/finalize")
async def finalize_scan_session(
    session_id: str,
    user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Finalizes an active multi-angle scan session:
    - Supports authenticated inspector or anonymous/demo inspection (get_current_user).
    - Merges all captured views into a single unified compliance report.
    - Persists exactly ONE ScanRecordDB in the database.
    - Returns the standard ScanRecord contract plus facesScanned and imageUris.
    - Deletes the in-memory session (preserving the committed image files).
    """
    session = session_store.get(session_id, touch=False)
    if not session:
        raise HTTPException(
            status_code=404,
            detail=f"Scan session '{session_id}' not found or expired."
        )

    if not session.views:
        raise HTTPException(
            status_code=400,
            detail="Cannot finalize session with 0 captured views."
        )

    # 1. Lookup GTIN data if present
    gtin_data = _lookup_gtin_data(db, session.gtin)

    # 2. Merge all views
    face_results = [
        {
            "face_label": v.view_id,
            "fields": v.pipeline_report.get("fields", {}),
            "user_instructions": v.pipeline_report.get("user_instructions", []),
        }
        for v in session.views
    ]

    merged_report = merge_package_faces(
        face_results=face_results,
        gtin_data=gtin_data,
        package_type="packet",
    )

    total_elapsed = round(sum(v.elapsed_seconds for v in session.views), 2)
    merged_report["elapsed_seconds"] = total_elapsed
    merged_report["fields"] = merged_report.get("merged_fields", {})

    # 3. Construct image URIs and primary view
    primary_image_path = session.views[0].annotated_path if os.path.exists(session.views[0].annotated_path) else session.views[0].image_path
    primary_image_uri = f"/uploads/{os.path.basename(primary_image_path)}"

    image_uris = [
        f"/uploads/{os.path.basename(v.annotated_path if os.path.exists(v.annotated_path) else v.image_path)}"
        for v in session.views
    ]
    faces_scanned = [v.view_id for v in session.views]

    # 4. Map report to standard frontend ScanRecord interface
    scan_id = f"scan_{uuid.uuid4().hex[:12]}"
    scan_record = pipeline_report_to_scan_record(
        pipeline_report=merged_report,
        scan_id=scan_id,
        image_uri=primary_image_uri,
        gtin_data=gtin_data,
    )

    # Append multi-angle extensions
    scan_record["facesScanned"] = faces_scanned
    scan_record["imageUris"] = image_uris

    # 5. Persist exactly ONE ScanRecordDB row
    db_row = ScanRecordDB(
        id=scan_id,
        product_name=scan_record["productName"],
        brand=scan_record["brand"],
        gtin=session.gtin,
        net_weight=scan_record["netWeight"],
        status=scan_record["status"],
        authenticity_score=scan_record["complianceConfidence"],
        thumbnail_color=scan_record["thumbnailColor"],
        image_path=primary_image_path,
        processing_time=scan_record.get("processingTime"),
        compliance_score=merged_report.get("compliance_score"),
        fields_json=json.dumps(scan_record["fields"]),
        ocr_engines_json=json.dumps(scan_record.get("ocrEnginesUsed", [])),
        user_id=user.id if user else None,
    )
    db.add(db_row)
    db.commit()

    # 6. Delete in-memory session (do NOT delete files as they are referenced in DB)
    session_store.remove(session_id, delete_files=False)

    logger.info(
        f"[/api/scan/session/finalize] Session {session_id} finalized into ScanRecord {scan_id} "
        f"({len(session.views)} views, status={scan_record['status']})"
    )
    return scan_record


# ── Endpoint 3: Discard Session ───────────────────────────────────────────

@router.delete("/api/scan/session/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
async def discard_scan_session(session_id: str):
    """
    Discards the scan session:
    - Removes session from memory.
    - Cleans up temporary uploaded and annotated image files.
    - Creates NO ScanRecordDB entry.
    - Idempotent: deleting an already missing or expired session returns HTTP 204.
    """
    removed = session_store.remove(session_id, delete_files=True)
    if removed:
        logger.info(f"[/api/scan/session] Discarded session {session_id} and cleaned temporary files")
    else:
        logger.info(f"[/api/scan/session] Discard requested for session {session_id} (already absent or expired)")

    return Response(status_code=status.HTTP_204_NO_CONTENT)
