from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from src.db import get_db
from src.models import Document, ExtractionRecord, Project, ReviewStatus
from src.schemas import ExtractionRecordResponse, ReviewUpdate

router = APIRouter(prefix="/projects", tags=["review"])

_ALLOWED_REVIEW_STATUSES = {
    ReviewStatus.CONFIRMED,
    ReviewStatus.REJECTED,
    ReviewStatus.MANUAL_UPDATED,
}


@router.post(
    "/{project_id}/records/{record_id}/review",
    response_model=ExtractionRecordResponse,
)
def review_record(
    project_id: int,
    record_id: int,
    payload: ReviewUpdate,
    db: Session = Depends(get_db),
):
    """Update the review status of an extraction record.

    - CONFIRMED / REJECTED: just update status, AI value untouched.
    - MANUAL_UPDATED: requires manual_value; stored alongside AI result,
      never overwrites value or normalized_value.
    """
    # Validate project
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    # Validate record belongs to this project
    record = (
        db.query(ExtractionRecord)
        .join(Document, ExtractionRecord.document_id == Document.id)
        .filter(
            ExtractionRecord.id == record_id,
            Document.project_id == project_id,
        )
        .first()
    )
    if not record:
        raise HTTPException(status_code=404, detail="Extraction record not found")

    # Validate status value
    try:
        new_status = ReviewStatus(payload.status.upper())
    except ValueError:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid status '{payload.status}'. Allowed: "
            + ", ".join(s.value for s in _ALLOWED_REVIEW_STATUSES),
        )

    if new_status not in _ALLOWED_REVIEW_STATUSES:
        raise HTTPException(
            status_code=400,
            detail=f"Status '{payload.status}' cannot be set via review. Allowed: "
            + ", ".join(s.value for s in _ALLOWED_REVIEW_STATUSES),
        )

    if new_status == ReviewStatus.MANUAL_UPDATED:
        if not payload.manual_value:
            raise HTTPException(
                status_code=400,
                detail="manual_value is required when status is MANUAL_UPDATED",
            )
        # Store alongside AI result — never overwrite value / normalized_value
        record.manual_value = payload.manual_value

    record.review_status = new_status
    db.commit()
    db.refresh(record)

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


@router.get(
    "/{project_id}/records",
    response_model=list[ExtractionRecordResponse],
)
def list_records(
    project_id: int,
    status: str | None = None,
    db: Session = Depends(get_db),
):
    """List all extraction records for a project, optionally filtered by review status."""
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    query = (
        db.query(ExtractionRecord)
        .join(Document, ExtractionRecord.document_id == Document.id)
        .filter(Document.project_id == project_id)
    )

    if status:
        try:
            filter_status = ReviewStatus(status.upper())
            query = query.filter(ExtractionRecord.review_status == filter_status)
        except ValueError:
            raise HTTPException(status_code=400, detail=f"Invalid status filter: {status}")

    records = query.order_by(ExtractionRecord.document_id, ExtractionRecord.field_key).all()

    return [
        ExtractionRecordResponse(
            id=r.id,
            document_id=r.document_id,
            field_key=r.field_key,
            value=r.value,
            raw_text=r.raw_text,
            citations=r.citations,
            confidence=r.confidence,
            normalized_value=r.normalized_value,
            review_status=r.review_status.value,
            manual_value=r.manual_value,
            created_at=r.created_at,
            updated_at=r.updated_at,
        )
        for r in records
    ]
