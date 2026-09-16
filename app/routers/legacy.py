"""
Legacy Endpoints Router
Preserves backward compatibility for /analyze-face, /analyze-burst, /analyze-package, and /health.
"""

import os
import shutil
import uuid
import time
import socket
import asyncio
from concurrent.futures import ThreadPoolExecutor
from typing import List, Optional, Dict, Any

from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel

from core.config import UPLOAD_DIR
from core.logger import logger
from pipeline.ensemble_pipeline import ensemble_scan
import api.burst_handler as burst_handler
import api.compliance_merger as compliance_merger

router = APIRouter(tags=["Legacy & Compatibility"])
executor = ThreadPoolExecutor(max_workers=4)


def get_local_ip() -> str:
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return "127.0.0.1"


@router.get("/health")
def health_check():
    return {
        "status": "healthy",
        "service": "PRAMAN_v4_unified",
        "version": "4.0.0",
        "ocr_engines": {
            "primary": "paddleocr",
            "secondary": "easyocr",
            "tertiary": "surya",
        },
        "engines": ["paddleocr", "easyocr", "surya", "vlm"],
        "server_time": time.time(),
        "host_ip": get_local_ip(),
        "port": 8000,
    }


@router.get("/")
def index():
    return {
        "message": "PRAMAN v4 Legal Metrology API Server Online",
        "docs": "/docs",
        "version": "4.0.0",
    }


@router.post("/analyze-face")
async def analyze_face(
    image: UploadFile = File(...),
    face_label: str = Form("front"),
    package_type: str = Form("packet"),
):
    req_id = uuid.uuid4().hex[:8]
    file_id = f"{req_id}_{face_label}.jpg"
    file_path = os.path.join(UPLOAD_DIR, file_id)

    with open(file_path, "wb") as f:
        shutil.copyfileobj(image.file, f)

    try:
        loop = asyncio.get_running_loop()
        report = await loop.run_in_executor(executor, ensemble_scan, file_path)

        return {
            "success": True,
            "request_id": req_id,
            "face_label": face_label,
            "package_type": package_type,
            "file_id": file_id,
            "fields": report.get("fields", {}),
            "fields_found": report.get("fields_found", 0),
            "total_fields": report.get("total_fields", 0),
            "compliance_score": report.get("compliance_score", 0.0),
            "overall_status": report.get("overall_status", "UNKNOWN"),
            "user_instructions": report.get("user_instructions", []),
            "elapsed_seconds": report.get("elapsed_seconds", 0.0),
        }
    except Exception as e:
        logger.error(f"Error in /analyze-face: {e}")
        raise HTTPException(status_code=500, detail=f"OCR analysis failed: {str(e)}")


@router.post("/analyze-burst")
async def analyze_burst(
    frames: List[UploadFile] = File(...),
    face_label: str = Form("front"),
    package_type: str = Form("packet"),
):
    session_id = uuid.uuid4().hex[:8]
    saved_paths = []

    for idx, frame in enumerate(frames):
        fname = f"{session_id}_{face_label}_burst{idx}.jpg"
        fpath = os.path.join(UPLOAD_DIR, fname)
        with open(fpath, "wb") as f:
            shutil.copyfileobj(frame.file, f)
        saved_paths.append(fpath)

    try:
        loop = asyncio.get_running_loop()
        fusion_result = await loop.run_in_executor(
            executor, burst_handler.process_burst_frames, saved_paths, face_label
        )
        fusion_result["package_type"] = package_type
        return {"success": True, **fusion_result}
    except Exception as e:
        logger.error(f"Error in /analyze-burst: {e}")
        raise HTTPException(status_code=500, detail=f"Burst fusion failed: {str(e)}")


class PackageMergeRequest(BaseModel):
    face_results: List[Dict[str, Any]]
    gtin_data: Optional[Dict[str, Any]] = None
    package_type: str = "box"


@router.post("/analyze-package")
def analyze_package(req: PackageMergeRequest):
    try:
        report = compliance_merger.merge_package_faces(
            face_results=req.face_results,
            gtin_data=req.gtin_data,
            package_type=req.package_type,
        )
        return {"success": True, "report": report}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Package merge failed: {str(e)}")
