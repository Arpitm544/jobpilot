import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

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
from app.api.v1.ws import router as ws_router

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("jobpilot")


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

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
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
