"""
PRAMAN v4 Unified Backend — Legal Metrology Compliance Inspection Platform
Unified API combining Codebase 1 (Multi-Stage Cascaded OCR) & Codebase 2 (Statutory RuleEngine, RAG & Sync)
"""

import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from core.config import UPLOAD_DIR, CORS_ORIGINS
from core.database import create_tables
from core.logger import logger

from app.routers import auth, scans, product, sync, rules, chat, legacy

# Initialize FastAPI application
app = FastAPI(
    title="PRAMAN v4 — Legal Metrology Compliance & AI Enforcement Platform",
    description="Unified API combining multi-stage cascaded OCR, statutory rule evaluation, RAG assistant, and offline sync.",
    version="4.0.0",
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Ensure upload directory exists
os.makedirs(UPLOAD_DIR, exist_ok=True)
if os.path.exists(UPLOAD_DIR):
    app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")


@app.on_event("startup")
def startup_event():
    import threading
    create_tables()
    logger.info("✓ PRAMAN v4 database initialized")

    def _warmup_models():
        try:
            from core.models import registry
            registry.get_paddle_ocr()
            logger.info("✓ Primary PaddleOCR engine pre-warmed and ready in memory")
        except Exception as e:
            logger.warning(f"Background model pre-warm note: {e}")

    threading.Thread(target=_warmup_models, daemon=True).start()


# Include all modular routers
app.include_router(auth.router)
app.include_router(scans.router)
app.include_router(product.router)
app.include_router(sync.router)
app.include_router(rules.router)
app.include_router(chat.router)
app.include_router(legacy.router)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
