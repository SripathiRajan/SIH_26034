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

    # Auto-migration for newly added columns in SQLite
    if DATABASE_URL.startswith("sqlite"):
        with engine.connect() as conn:
            from sqlalchemy import text
            try:
                conn.execute(text("ALTER TABLE scan_records ADD COLUMN notes TEXT DEFAULT ''"))
                conn.commit()
            except Exception:
                pass

    # Ensure default admin user exists: admin / Praman!2026
    try:
        from core.auth import hash_password
        import uuid
        db = SessionLocal()
        admin_user = db.query(UserDB).filter(UserDB.username == "admin").first()
        if not admin_user:
            db.add(UserDB(
                id=uuid.uuid4().hex,
                username="admin",
                email="admin@praman.gov.in",
                hashed_password=hash_password("Praman!2026"),
                full_name="Administrator",
                role="admin",
            ))
            db.commit()
        else:
            admin_user.hashed_password = hash_password("Praman!2026")
            db.commit()
    except Exception:
        pass
    finally:
        try:
            db.close()
        except Exception:
            pass
