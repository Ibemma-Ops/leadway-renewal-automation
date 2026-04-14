from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.responses import JSONResponse
import time
import logging
from loguru import logger

from app.core.config import settings
from app.core.database import Base, engine
from app.api.routes.auth import router as auth_router
from app.api.routes.policies import router as policies_router
from app.api.routes.upload import router as upload_router
from app.api.routes.approvals import router as approvals_router
from app.api.routes.dashboard import router as dashboard_router
from app.api.routes.audit_users import audit_router, users_router

# Create tables on startup
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Leadway MRAS API",
    description="Monthly Renewal Automation System — Leadway Health Insurance",
    version=settings.APP_VERSION,
    docs_url="/api/docs",
    redoc_url="/api/redoc",
)

# ── CORS ────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.FRONTEND_URL, "http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Request timing middleware ────────────────────────────────────────────────
@app.middleware("http")
async def add_process_time_header(request: Request, call_next):
    start = time.time()
    response = await call_next(request)
    response.headers["X-Process-Time"] = str(round(time.time() - start, 4))
    return response

# ── Global error handler ─────────────────────────────────────────────────────
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled error: {exc} | path={request.url.path}")
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error. Please contact support."},
    )

# ── Routers ──────────────────────────────────────────────────────────────────
PREFIX = "/api/v1"

app.include_router(auth_router,      prefix=PREFIX)
app.include_router(upload_router,    prefix=PREFIX)
app.include_router(policies_router,  prefix=PREFIX)
app.include_router(approvals_router, prefix=PREFIX)
app.include_router(dashboard_router, prefix=PREFIX)
app.include_router(audit_router,     prefix=PREFIX)
app.include_router(users_router,     prefix=PREFIX)

# ── Health check ─────────────────────────────────────────────────────────────
@app.get("/health")
async def health():
    return {"status": "ok", "app": settings.APP_NAME, "version": settings.APP_VERSION}

@app.get("/")
async def root():
    return {"message": "Leadway MRAS API", "docs": "/api/docs"}
