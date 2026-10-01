import logging
import uuid
from pathlib import Path
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, HTTPException, status
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware

from app.config import settings
from app.database import init_db
from app.api.v1.auth import router as auth_router
from app.api.v1.profile import router as profile_router
from app.api.v1.preferences import router as preferences_router
from app.api.v1.jobs import router as jobs_router
from app.api.v1.tailor import router as tailor_router
from app.api.v1.apply import router as apply_router
from app.api.v1.analytics import router as analytics_router
from app.api.v1.resumes import router as resumes_router
from app.api.v1.onboarding import router as onboarding_router
from app.api.v1.ws import router as ws_router

# Configure file and stream logging
LOGS_DIR = Path(__file__).resolve().parent.parent.parent / "logs"
LOGS_DIR.mkdir(parents=True, exist_ok=True)
api_log_file = LOGS_DIR / "api.log"

file_handler = logging.FileHandler(api_log_file, encoding="utf-8")
file_handler.setLevel(logging.DEBUG)
file_formatter = logging.Formatter("%(asctime)s [%(levelname)s] [%(name)s] %(message)s")
file_handler.setFormatter(file_formatter)

logging.basicConfig(
    level=logging.DEBUG if settings.DEBUG else logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    handlers=[
        logging.StreamHandler(),
        file_handler
    ]
)
logger = logging.getLogger("jobpilot")


class RequestIDMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        # Normalize accidental duplicate /api/v1/ prefix
        if request.scope.get("path", "").startswith("/api/v1/api/v1/"):
            request.scope["path"] = request.scope["path"].replace("/api/v1/api/v1/", "/api/v1/", 1)

        request_id = request.headers.get("X-Request-ID") or uuid.uuid4().hex[:12]
        request.state.request_id = request_id
        # Safe logging: log path without PII query params or body
        logger.debug(f"[{request_id}] {request.method} {request.url.path}")
        try:
            response = await call_next(request)
            response.headers["X-Request-ID"] = request_id
            return response
        except Exception as exc:
            logger.error(f"[{request_id}] Unhandled error in request {request.method} {request.url.path}: {exc}", exc_info=True)
            return JSONResponse(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                content={
                    "code": "INTERNAL_SERVER_ERROR",
                    "message": "An internal server error occurred. Please try again.",
                    "request_id": request_id
                },
                headers={"X-Request-ID": request_id}
            )


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Initializing JobPilot backend...")
    # Initialize database tables
    try:
        await init_db()
        logger.info("Database schemas verified.")
    except Exception as e:
        logger.error(f"Error during database initialization: {e}")
    yield
    logger.info("Shutting down JobPilot backend...")


app = FastAPI(
    title=settings.APP_NAME,
    description="JobPilot - AI-Powered Job Search Automation & Tailoring Platform",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

# Request ID Middleware
app.add_middleware(RequestIDMiddleware)

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-Request-ID"]
)


@app.exception_handler(HTTPException)
async def custom_http_exception_handler(request: Request, exc: HTTPException):
    request_id = getattr(request.state, "request_id", None) or uuid.uuid4().hex[:12]
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "code": f"HTTP_{exc.status_code}",
            "message": exc.detail if isinstance(exc.detail, str) else "Request failed",
            "detail": exc.detail,
            "request_id": request_id
        },
        headers={"X-Request-ID": request_id}
    )


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    request_id = getattr(request.state, "request_id", None) or uuid.uuid4().hex[:12]
    logger.error(f"[{request_id}] Global exception handler caught: {exc}", exc_info=True)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "code": "INTERNAL_SERVER_ERROR",
            "message": "An unexpected error occurred. Please try again.",
            "request_id": request_id
        },
        headers={"X-Request-ID": request_id}
    )

# Include API v1 Routers
app.include_router(auth_router, prefix=settings.API_V1_STR)
app.include_router(profile_router, prefix=settings.API_V1_STR)
app.include_router(preferences_router, prefix=settings.API_V1_STR)
app.include_router(jobs_router, prefix=settings.API_V1_STR)
app.include_router(tailor_router, prefix=settings.API_V1_STR)
app.include_router(apply_router, prefix=settings.API_V1_STR)
app.include_router(analytics_router, prefix=settings.API_V1_STR)
app.include_router(resumes_router, prefix=settings.API_V1_STR)
app.include_router(resumes_router)  # Allow direct /resumes/* endpoints as well
app.include_router(onboarding_router, prefix=settings.API_V1_STR)
app.include_router(onboarding_router)  # Allow direct /onboarding/* endpoints as well
app.include_router(ws_router, prefix=settings.API_V1_STR)


@app.get("/health", tags=["Health"])
async def health_check():
    return {
        "status": "healthy",
        "app": settings.APP_NAME,
        "environment": settings.ENVIRONMENT,
        "database": "connected"
    }


@app.get("/", tags=["Root"])
async def root():
    return {
        "message": "Welcome to JobPilot API. Visit /docs for OpenAPI documentation.",
        "version": "1.0.0"
    }
