"""
PRAMAN v4 Unified Backend — Legal Metrology Compliance Inspection Platform
Unified API combining Codebase 1 (Multi-Stage Cascaded OCR) & Codebase 2 (Statutory RuleEngine, RAG & Sync)
"""

import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from core.config import UPLOAD_DIR, CORS_ORIGINS, DATABASE_URL
from core.database import create_tables
from core.logger import logger
from core.limiter import limiter
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

from app.routers import auth, scans, product, sync, rules, chat, legacy, scan_session

def _verify_schema_version():
    """Refuse to boot against a DB whose alembic revision is not the current head."""
    import sqlalchemy
    from alembic.config import Config
    from alembic.script import ScriptDirectory
    from alembic.runtime.migration import MigrationContext

    try:
        cfg = Config("alembic.ini")
        head = ScriptDirectory.from_config(cfg).get_current_head()
        with sqlalchemy.create_engine(DATABASE_URL).connect() as conn:
            ctx = MigrationContext.configure(conn)
            current = ctx.get_current_revision()
        if current is not None and current != head:
            raise RuntimeError(
                f"Database schema revision {current} != expected {head}. "
                "Run `python -m alembic upgrade head` before starting the server."
            )
    except RuntimeError:
        raise
    except Exception as e:
        # Unmigrated/legacy DBs are allowed through (create_tables handles them);
        # only a *stale known revision* is fatal.
        logger.warning(f"Schema version check skipped: {e}")


@asynccontextmanager
async def lifespan(_app: FastAPI):
    import threading
    _verify_schema_version()
    create_tables()
    logger.info("✓ PRAMAN v4 database initialized")

    if os.environ.get("PRAMAN_PRELOAD_MODELS", "1") != "0":
        def _warmup_models():
            # Sequential preload of every OCR engine. Lazy first-use inside worker
            # threads crashes natively on Windows (OpenMP/DLL init race), and
            # preloading also removes the multi-second first-scan latency spike.
            # Set PRAMAN_PRELOAD_MODELS=0 to keep startup fast on constrained SKUs.
            from core.models import registry
            for name, getter in (
                ("PaddleOCR (primary)", registry.get_paddle_ocr),
                ("EasyOCR (tier 2)", registry.get_easyocr_reader),
                ("SuryaOCR (tier 2)", registry.get_surya_detector),
            ):
                try:
                    getter()
                    logger.info(f"✓ {name} pre-warmed and ready in memory")
                except Exception as e:
                    logger.warning(f"Background model pre-warm note ({name}): {e}")

        threading.Thread(target=_warmup_models, daemon=True).start()
    yield


# Initialize FastAPI application
app = FastAPI(
    title="PRAMAN v4 — Legal Metrology Compliance & AI Enforcement Platform",
    description="Unified API combining multi-stage cascaded OCR, statutory rule evaluation, RAG assistant, and offline sync.",
    version="4.0.0",
    lifespan=lifespan,
)

# Rate limiting
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(SlowAPIMiddleware)

# Configure CORS — explicit origins come from CORS_ORIGINS (env-configurable).
# The dev regex only permits loopback/private ranges; production hosts must be
# listed explicitly in CORS_ORIGINS rather than matched by wildcard.
from core.config import ENVIRONMENT

if ENVIRONMENT in ("development", "dev", "test", "local"):
    _origin_regex = (
        r"^https?://(localhost|127\.0\.0\.1|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+"
        r"|172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+)(:\d+)?$"
    )
else:
    _origin_regex = None  # explicit allowlist only

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_origin_regex=_origin_regex,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    allow_private_network=ENVIRONMENT in ("development", "dev", "test", "local"),
)

# Ensure upload directory exists
os.makedirs(UPLOAD_DIR, exist_ok=True)
if os.path.exists(UPLOAD_DIR):
    app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")


# Include all modular routers
app.include_router(auth.router)
app.include_router(scans.router)
app.include_router(product.router)
app.include_router(sync.router)
app.include_router(rules.router)
app.include_router(chat.router)
app.include_router(legacy.router)
app.include_router(scan_session.router)


if __name__ == "__main__":
    import uvicorn
    is_dev = ENVIRONMENT in ("development", "dev", "test", "local")
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run("app.main:app", host="0.0.0.0", port=port, reload=is_dev)
