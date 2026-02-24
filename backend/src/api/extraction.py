from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from src.db import get_db
from src.models import Document, ExtractionRecord, FieldTemplate, Project
from src.schemas import ExtractionRecordResponse
from src.services.extraction import extract_all, extract_single
from src.api.logs import write_log

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
        write_log(db, project_id, "ERROR", "EXTRACTION_FAILED", str(e))
        raise HTTPException(status_code=400, detail=str(e))
    except RuntimeError as e:
        write_log(db, project_id, "ERROR", "EXTRACTION_FAILED", str(e))
        raise HTTPException(status_code=502, detail=str(e))

    doc_count = len({r.document_id for r in records})
    write_log(
        db, project_id, "INFO", "EXTRACTION_COMPLETED",
        f"Extracted {len(records)} record(s) across {doc_count} document(s) using {provider}",
    )
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
        write_log(
            db, project_id, "ERROR", "FIELD_EXTRACTION_FAILED",
            f"Field '{payload.field_key}' on doc #{payload.document_id}: {str(e)}",
        )
        raise HTTPException(status_code=400, detail=str(e))
    except RuntimeError as e:
        write_log(
            db, project_id, "ERROR", "FIELD_EXTRACTION_FAILED",
            f"Field '{payload.field_key}' on doc #{payload.document_id}: {str(e)}",
        )
        raise HTTPException(status_code=502, detail=str(e))

    write_log(
        db, project_id, "INFO", "FIELD_EXTRACTED",
        f"Re-extracted field '{payload.field_key}' on doc #{payload.document_id} using {payload.provider}",
    )
    return _to_response(record)


@router.delete("/{project_id}/extract/all", status_code=204)
def clear_all_extractions(
    project_id: int,
    db: Session = Depends(get_db),
):
    """Delete all extraction records for a project. Keeps documents and template."""
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    doc_ids = [
        d.id for d in db.query(Document.id).filter(Document.project_id == project_id).all()
    ]
    if doc_ids:
        db.query(ExtractionRecord).filter(
            ExtractionRecord.document_id.in_(doc_ids)
        ).delete(synchronize_session="fetch")
        db.commit()
    write_log(db, project_id, "WARNING", "EXTRACTION_CLEARED", "All extraction records cleared")
    return None


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
