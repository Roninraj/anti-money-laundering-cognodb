from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import logging

from app.config import settings
from app.database import db_manager
from app.routes import overview, graph, detectors, accounts, copilot

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("aml_app")

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting up AML Graph Intelligence Console Backend...")
    yield
    logger.info("Shutting down backend and releasing CognoDB driver connection...")
    db_manager.close()

app = FastAPI(
    title=settings.app_title,
    version=settings.app_version,
    description="Backend API for Anti-Money Laundering (AML) Graph Application backed by CognoDB",
    lifespan=lifespan
)

# Enable CORS for frontend web application
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Exception Handler
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Global exception handled on {request.url}: {exc}")
    return JSONResponse(
        status_code=500,
        content={
            "error": "Internal Server Error",
            "message": str(exc),
            "path": str(request.url)
        }
    )

# Register API Routers
app.include_router(overview.router)
app.include_router(graph.router)
app.include_router(detectors.router)
app.include_router(accounts.router)
app.include_router(copilot.router)

@app.get("/")
def root():
    return {
        "title": settings.app_title,
        "version": settings.app_version,
        "database": db_manager.check_connection(),
        "docs": "/docs"
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
