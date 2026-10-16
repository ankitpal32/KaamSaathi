import logging
from fastapi import FastAPI, status
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.schemas import HealthResponse
from app.routes.jobs import router as jobs_router
from app.routes.payments import router as payments_router
from app.routes.reminders import router as reminders_router
from app.routes.dashboard import router as dashboard_router
from app.routes.bolna import router as bolna_router, mint_bolna_session

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("kaamsaathi.backend")

# Initialize FastAPI application
app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="FastAPI Backend for KaamSaathi - Multilingual Voice Ledger for Indian Blue-Collar Technicians",
    docs_url="/docs",
    redoc_url="/redoc"
)

# Configure CORS for local frontend dev and Vercel domains
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Root endpoint
@app.get(
    "/",
    status_code=status.HTTP_200_OK,
    summary="Root Welcome & Health Message",
    tags=["System"]
)
def root():
    return {
        "message": "Welcome to KaamSaathi API",
        "version": settings.APP_VERSION,
        "docs_url": "/docs",
        "health_url": "/health",
        "status": "running"
    }

# Health Check endpoint
@app.get(
    "/health",
    response_model=HealthResponse,
    status_code=status.HTTP_200_OK,
    summary="System Health & Configuration Status",
    tags=["System"]
)
def health_check():
    """
    Returns application status and indicates whether Supabase is configured,
    strictly without leaking any secret keys, credentials, or URLs.
    """
    return HealthResponse(
        status="healthy",
        app_name=settings.APP_NAME,
        version=settings.APP_VERSION,
        database_configured=settings.is_supabase_configured,
        environment=settings.ENVIRONMENT
    )

@app.get(
    "/api/health",
    response_model=HealthResponse,
    status_code=status.HTTP_200_OK,
    summary="System Health & Configuration Status (API prefix alias)",
    tags=["System"],
    include_in_schema=False
)
def api_health_check():
    return health_check()

# Mount Routes
app.include_router(jobs_router)
app.include_router(payments_router)
app.include_router(reminders_router)
app.include_router(dashboard_router)
app.include_router(bolna_router)

# Favicon handler to prevent browser 404s when inspecting backend/docs
@app.get("/favicon.ico", include_in_schema=False)
def backend_favicon():
    from fastapi.responses import Response
    return Response(status_code=status.HTTP_204_NO_CONTENT)

# Resilient alias for /bolna-session without /api prefix
app.add_api_route("/bolna-session", mint_bolna_session, methods=["POST"], include_in_schema=False)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=True
    )
