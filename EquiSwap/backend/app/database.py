import logging
import os
from pathlib import Path

from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

BACKEND_ROOT = Path(__file__).resolve().parents[1]
load_dotenv(BACKEND_ROOT / ".env")

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./equiswap.db")

# Render uses postgres:// which SQLAlchemy 2.0+ requires as postgresql://
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

# Force the psycopg (v3) driver since psycopg2 is not installed
if DATABASE_URL.startswith("postgresql://"):
    DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+psycopg://", 1)

connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}
engine_options = {"pool_pre_ping": True} if not DATABASE_URL.startswith("sqlite") else {}
engine = create_engine(DATABASE_URL, connect_args=connect_args, **engine_options)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

logger = logging.getLogger("uvicorn.error")

if engine.url.drivername.startswith("sqlite"):
    logger.info("Database configured: driver=%s database=%s", engine.url.drivername, engine.url.database)
else:
    logger.info(
        "Database configured: driver=%s host=%s port=%s database=%s",
        engine.url.drivername,
        engine.url.host,
        engine.url.port,
        engine.url.database,
    )

Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
