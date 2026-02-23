"""Pydantic request/response schemas for all endpoints."""

from __future__ import annotations

from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel


# ---------------------------------------------------------------------------
# Project
# ---------------------------------------------------------------------------


class ProjectCreate(BaseModel):
    name: str


class ProjectResponse(BaseModel):
    id: int
    name: str
    status: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Document
# ---------------------------------------------------------------------------


class DocumentResponse(BaseModel):
    id: int
    project_id: int
    filename: str
    format: str
    parse_status: str
    created_at: datetime

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Field Template
# ---------------------------------------------------------------------------


class FieldDefinition(BaseModel):
    key: str
    type: str  # e.g. "text", "date", "amount", "entity"
    description: str
    required: bool = False


class TemplateCreate(BaseModel):
    fields: list[FieldDefinition]


class TemplateResponse(BaseModel):
    id: int
    project_id: int
    fields: list[dict[str, Any]]
    version: int
    updated_at: datetime

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Extraction / Review
# ---------------------------------------------------------------------------


class ExtractionRecordResponse(BaseModel):
    id: int
    document_id: int
    field_key: str
    value: Optional[str]
    raw_text: Optional[str]
    citations: list[dict[str, Any]]
    confidence: Optional[float]
    normalized_value: Optional[str]
    review_status: str
    manual_value: Optional[str]
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ReviewUpdate(BaseModel):
    status: str  # CONFIRMED | REJECTED | MANUAL_UPDATED
    manual_value: Optional[str] = None


# ---------------------------------------------------------------------------
# Table (docs × fields matrix)
# ---------------------------------------------------------------------------


class TableCell(BaseModel):
    record_id: Optional[int]
    value: Optional[str]
    normalized_value: Optional[str]
    confidence: Optional[float]
    review_status: str
    citations: list[dict[str, Any]]
    manual_value: Optional[str]


class TableResponse(BaseModel):
    project_id: int
    fields: list[str]
    documents: list[dict[str, Any]]  # [{id, filename}]
    # rows[field_key][document_id] -> TableCell
    rows: dict[str, dict[str, Optional[TableCell]]]
