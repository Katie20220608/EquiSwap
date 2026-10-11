import logging
import os
import time
import uuid

from fastapi import APIRouter, FastAPI, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from starlette.middleware.base import BaseHTTPMiddleware

logger = logging.getLogger("equiswap")
SLOW_REQUEST_SECONDS = 2.0


def release_info() -> dict[str, str]:
    return {
        "version": os.getenv("RENDER_GIT_COMMIT") or os.getenv("APP_VERSION") or "dev",
        "environment": os.getenv("ENVIRONMENT") or ("production" if os.getenv("RENDER") else "development"),
    }


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        request_id = request.headers.get("x-request-id") or uuid.uuid4().hex[:12]
        started = time.perf_counter()
        try:
            response = await call_next(request)
        except Exception:
            elapsed_ms = (time.perf_counter() - started) * 1000
            logger.exception(
                "request_failed id=%s method=%s path=%s duration_ms=%.0f",
                request_id,
                request.method,
                request.url.path,
                elapsed_ms,
            )
            return JSONResponse(
                {"detail": "Internal server error", "request_id": request_id},
                status_code=500,
                headers={"X-Request-ID": request_id},
            )

        elapsed = time.perf_counter() - started
        response.headers["X-Request-ID"] = request_id
        if request.url.path != "/health":
            level = (
                logging.WARNING
                if response.status_code >= 500 or elapsed > SLOW_REQUEST_SECONDS
                else logging.INFO
            )
            logger.log(
                level,
                "request id=%s method=%s path=%s status=%s duration_ms=%.0f",
                request_id,
                request.method,
                request.url.path,
                response.status_code,
                elapsed * 1000,
            )
        return response


class ClientErrorReport(BaseModel):
    message: str = Field(max_length=500)
    stack: str | None = Field(default=None, max_length=4000)
    url: str | None = Field(default=None, max_length=500)
    user_agent: str | None = Field(default=None, max_length=300)
    context: dict[str, str] = Field(default_factory=dict, max_length=10)


router = APIRouter()


@router.post("/client-errors", status_code=204)
def report_client_error(report: ClientErrorReport) -> None:
    logger.error(
        "client_error message=%r url=%s ua=%s context=%s stack=%s",
        report.message,
        report.url,
        report.user_agent,
        {k[:50]: v[:500] for k, v in report.context.items()},
        report.stack,
    )


def setup_monitoring(app: FastAPI) -> None:
    app.add_middleware(RequestLoggingMiddleware)
    app.include_router(router, tags=["monitoring"])
