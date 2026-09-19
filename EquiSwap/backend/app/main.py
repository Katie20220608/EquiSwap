import asyncio
import contextlib
import logging
import os
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.database import Base, SessionLocal, engine, get_db
from app.routers import admin, auth, items, notifications, preferences, swaps, users, wishlists
from app.routers.swaps import process_expirations

_EXPIRATION_SWEEP_INTERVAL_SECONDS = 300
_UPLOAD_DIR = Path(__file__).resolve().parent.parent / "uploads"
_logger = logging.getLogger("uvicorn.error")

_raw_upload_dir = os.getenv("UPLOAD_DIR")
if _raw_upload_dir:
    _UPLOAD_DIR = Path(_raw_upload_dir).expanduser().resolve()


async def _expiration_sweep_loop() -> None:
    """Periodically expire overdue proposals and warn about ones expiring soon."""
    while True:
        await asyncio.sleep(_EXPIRATION_SWEEP_INTERVAL_SECONDS)
        db = SessionLocal()
        try:
            process_expirations(db)
        except Exception:
            _logger.exception("Swap expiration sweep failed")
        finally:
            db.close()


@asynccontextmanager
async def lifespan(_app: FastAPI):
    # Keep setup simple for initial milestone by creating tables on startup.
    Base.metadata.create_all(bind=engine)
    task = asyncio.create_task(_expiration_sweep_loop())
    yield
    task.cancel()
    with contextlib.suppress(asyncio.CancelledError):
        await task


app = FastAPI(title="EquiSwap API", lifespan=lifespan)

# Allow local dev server and deployed frontend origins to call the API.
raw_origins = os.getenv("ALLOWED_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173")
allowed_origins = [origin.strip() for origin in raw_origins.split(",") if origin.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins if allowed_origins else ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/auth", tags=["auth"])
app.include_router(users.router, prefix="/users", tags=["users"])
app.include_router(items.router, prefix="/items", tags=["items"])
app.include_router(wishlists.router, prefix="/wishlists", tags=["wishlists"])
app.include_router(swaps.router, prefix="/swaps", tags=["swaps"])
app.include_router(notifications.router, prefix="/notifications", tags=["notifications"])
app.include_router(preferences.router, prefix="/preferences", tags=["preferences"])
app.include_router(admin.router, prefix="/admin", tags=["admin"])

_UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=_UPLOAD_DIR), name="uploads")


@app.get("/health")
def healthcheck(db: Session = Depends(get_db)) -> dict[str, str]:
    db.execute(text("SELECT 1"))
    return {"status": "ok"}
