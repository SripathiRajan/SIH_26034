# core/database.py
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


def create_tables():
    """Called once at server startup. Safe to call multiple times (idempotent)."""
    # Import here to avoid circular imports at module load time
    from core.db_models import ScanRecordDB, UserDB, ProductMasterDB  # noqa
    Base.metadata.create_all(bind=engine)
