from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from src.db import get_db
from src.models import FieldTemplate, Project
from src.schemas import ExtractionRecordResponse
from src.services.extraction import extract_all, extract_single

router = APIRouter(prefix="/projects", tags=["extraction"])


class SingleExtractionRequest(BaseModel):
    document_id: int
    field_key: str
    provider: str = "gemini"


@router.post("/{project_id}/extract/all", response_model=list[ExtractionRecordResponse])
def trigger_extract_all(
    project_id: int,
    provider: str = Query(default="gemini", description="LLM provider: gemini | grok | deepseek"),
    db: Session = Depends(get_db),
):
    """Extract all fields × all parsed documents in the project."""
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    try:
        records = extract_all(db=db, project_id=project_id, provider=provider)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e))

    return [_to_response(r) for r in records]


@router.post("/{project_id}/extract/field", response_model=ExtractionRecordResponse)
def trigger_extract_single(
    project_id: int,
    payload: SingleExtractionRequest,
    db: Session = Depends(get_db),
):
    """Extract a single field for a single document."""
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    template = (
        db.query(FieldTemplate).filter(FieldTemplate.project_id == project_id).first()
    )
    if not template:
        raise HTTPException(status_code=400, detail="No template defined for this project")

    field_def = next(
        (f for f in template.fields if f["key"] == payload.field_key), None
    )
    if not field_def:
        raise HTTPException(
            status_code=404, detail=f"Field '{payload.field_key}' not found in template"
        )

    try:
        record = extract_single(
            db=db,
            document_id=payload.document_id,
            field_key=payload.field_key,
            field_type=field_def.get("type", "text"),
            field_description=field_def.get("description", ""),
            provider=payload.provider,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e))

    return _to_response(record)


def _to_response(record) -> ExtractionRecordResponse:
    return ExtractionRecordResponse(
        id=record.id,
        document_id=record.document_id,
        field_key=record.field_key,
        value=record.value,
        raw_text=record.raw_text,
        citations=record.citations,
        confidence=record.confidence,
        normalized_value=record.normalized_value,
        review_status=record.review_status.value,
        manual_value=record.manual_value,
        created_at=record.created_at,
        updated_at=record.updated_at,
    )
