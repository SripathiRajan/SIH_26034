"""
Legacy Endpoints Router
Provides /health and / index status endpoints.
"""

import socket
import time

from fastapi import APIRouter

router = APIRouter(tags=["Legacy & Compatibility"])


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
