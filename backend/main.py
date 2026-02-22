from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from src.db import create_tables
from src.api import projects, documents, templates, extraction, review, export


@asynccontextmanager
async def lifespan(app: FastAPI):
    create_tables()
    yield


app = FastAPI(
    title="AI-Powered Legal Contract Field Extractor",
    description="Backend API for extracting fields from legal contracts using AI.",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers
app.include_router(projects.router)
app.include_router(documents.router)
app.include_router(templates.router)
app.include_router(extraction.router)
app.include_router(review.router)
app.include_router(export.router)


@app.get("/")
def read_root():
    return {"message": "Welcome to the Legal Contract Field Extractor API"}


@app.get("/health")
def health_check():
    return {"status": "ok"}
