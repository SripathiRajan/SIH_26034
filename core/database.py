# core/database.py
import os

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from core.config import DATABASE_URL

# SQLite: check_same_thread=False required for FastAPI concurrent requests
# PostgreSQL: remove connect_args when switching to Postgres in prod
connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}

engine = create_engine(DATABASE_URL, connect_args=connect_args, pool_pre_ping=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    """FastAPI dependency: yields a scoped DB session, closed after each request."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def _seed_first_admin():
    """
    Seed an initial admin account exactly once, only when the users table is
    empty. The password comes from PRAMAN_ADMIN_PASSWORD; in non-production a
    documented default keeps local development frictionless. Existing admin
    passwords are never overwritten at boot.
    """
    from core.config import ENVIRONMENT
    from core.auth import hash_password
    from core.db_models import UserDB
    import logging
    import uuid

    logger = logging.getLogger("praman.database")
    db = SessionLocal()
    try:
        if db.query(UserDB).first() is not None:
            return
        password = os.environ.get("PRAMAN_ADMIN_PASSWORD")
        if not password:
            if ENVIRONMENT in ("production", "prod", "staging"):
                logger.warning(
                    "PRAMAN_ADMIN_PASSWORD is not set; skipping admin seed. "
                    "Set it and restart to create the initial admin account."
                )
                return
            password = "Praman!2026"
            logger.warning(
                "Seeding default admin (admin / Praman!2026) in %s environment — "
                "change this password immediately after first login.", ENVIRONMENT
            )
        db.add(UserDB(
            id=uuid.uuid4().hex,
            username="admin",
            email="admin@praman.gov.in",
            hashed_password=hash_password(password),
            full_name="Administrator",
            role="admin",
        ))
        db.commit()
        logger.info("Initial admin account created.")
    finally:
        db.close()


def create_tables():
    """Called once at server startup. Safe to call multiple times (idempotent)."""
    import logging

    logger = logging.getLogger("praman.database")

    # Import here to avoid circular imports at module load time
    from core.db_models import ScanRecordDB, UserDB, ProductMasterDB  # noqa
    Base.metadata.create_all(bind=engine)

    # Auto-migration for newly added columns in SQLite
    if DATABASE_URL.startswith("sqlite"):
        from sqlalchemy import text
        with engine.connect() as conn:
            for stmt in (
                "ALTER TABLE scan_records ADD COLUMN notes TEXT DEFAULT ''",
            ):
                try:
                    conn.execute(text(stmt))
                    conn.commit()
                except Exception:
                    pass  # column already exists

    _seed_first_admin()
