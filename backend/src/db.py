import os
import urllib.parse

from dotenv import load_dotenv
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import sessionmaker

from src.models import Base

load_dotenv()


# ---------------------------------------------------------------------------
# Build database URL
# ---------------------------------------------------------------------------

def _build_database_url() -> str:
    """
    Build the DATABASE_URL with this priority:
      1. SUPABASE_URL + SUPABASE_DB_PASSWORD  →  PostgreSQL (Supabase)
      2. DATABASE_URL env var                 →  whatever is set (fallback)
      3. Default                              →  SQLite (local dev)
    """
    supabase_url = os.getenv("SUPABASE_URL", "").strip().rstrip("/")
    supabase_password = os.getenv("SUPABASE_DB_PASSWORD", "").strip()

    if supabase_url and supabase_password:
        # Extract project ref from  https://PROJECT_REF.supabase.co
        project_ref = supabase_url.split("//")[-1].split(".")[0]
        encoded_pw = urllib.parse.quote_plus(supabase_password)
        return (
            f"postgresql://postgres:{encoded_pw}"
            f"@db.{project_ref}.supabase.co:5432/postgres"
            f"?sslmode=require"
        )

    return os.getenv("DATABASE_URL", "sqlite:///./legal_extractor.db")


DATABASE_URL = _build_database_url()
_is_postgres = DATABASE_URL.startswith("postgresql")


# ---------------------------------------------------------------------------
# Engine
# ---------------------------------------------------------------------------

if _is_postgres:
    engine = create_engine(
        DATABASE_URL,
        # Connection pool tuned for Supabase free-tier limits
        pool_size=5,
        max_overflow=10,
        pool_timeout=30,
        pool_recycle=1800,      # discard connections idle > 30 min
        pool_pre_ping=True,     # verify liveness before handing out a connection
    )
else:
    # SQLite: check_same_thread=False required for FastAPI threaded requests
    engine = create_engine(
        DATABASE_URL,
        connect_args={"check_same_thread": False},
    )

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


# ---------------------------------------------------------------------------
# Table management
# ---------------------------------------------------------------------------

def create_tables() -> None:
    """
    Create every table that does not yet exist in the database.

    SQLAlchemy's create_all uses IF NOT EXISTS semantics — tables that already
    exist are left completely untouched, so this is safe to call on every
    startup without risk of data loss.
    """
    inspector = inspect(engine)
    existing = set(inspector.get_table_names())
    defined  = set(Base.metadata.tables.keys())
    missing  = defined - existing

    if missing:
        print(f"[db] Creating missing tables: {', '.join(sorted(missing))}")
    else:
        print("[db] All tables already exist — nothing to create.")

    Base.metadata.create_all(bind=engine)


def get_db():
    """FastAPI dependency that provides a database session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
