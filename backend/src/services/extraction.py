"""Extraction service — orchestrates LLM calls and persists ExtractionRecords."""

from __future__ import annotations

from sqlalchemy.orm import Session

from src.models import Document, ExtractionRecord, FieldTemplate, ParseStatus, ReviewStatus
from src.services.llm import extract_field


MISSING_DATA_THRESHOLD = 0.3


def _get_or_create_record(
    db: Session, document_id: int, field_key: str
) -> ExtractionRecord:
    record = (
        db.query(ExtractionRecord)
        .filter(
            ExtractionRecord.document_id == document_id,
            ExtractionRecord.field_key == field_key,
        )
        .first()
    )
    if record is None:
        record = ExtractionRecord(
            document_id=document_id,
            field_key=field_key,
            review_status=ReviewStatus.PENDING,
        )
        db.add(record)
        db.flush()
    return record


def extract_single(
    db: Session,
    document_id: int,
    field_key: str,
    field_type: str,
    field_description: str,
) -> ExtractionRecord:
    """Extract one field from one document and persist the result."""
    doc = db.query(Document).filter(Document.id == document_id).first()
    if not doc:
        raise ValueError(f"Document {document_id} not found")
    if doc.parse_status != ParseStatus.DONE or not doc.parsed_text:
        raise ValueError(f"Document {document_id} has not been parsed yet")

    record = _get_or_create_record(db, document_id, field_key)

    try:
        result = extract_field(
            document_text=doc.parsed_text,
            field_key=field_key,
            field_type=field_type,
            field_description=field_description,
        )
        record.value = result["value"]
        record.raw_text = result["raw_text"]
        record.citations = result["citations"]
        record.confidence = result["confidence"]
        record.normalized_value = result["normalized_value"]

        if result["value"] is None or result["confidence"] < MISSING_DATA_THRESHOLD:
            record.review_status = ReviewStatus.MISSING_DATA
        else:
            record.review_status = ReviewStatus.PENDING

    except Exception as e:
        record.review_status = ReviewStatus.MISSING_DATA
        record.value = None
        record.confidence = 0.0
        record.citations = []
        db.commit()
        raise RuntimeError(f"Extraction failed for field '{field_key}': {e}")

    db.commit()
    db.refresh(record)
    return record


def extract_all(db: Session, project_id: int) -> list[ExtractionRecord]:
    """Extract all fields × all documents for a project. Skips non-DONE documents."""
    template = (
        db.query(FieldTemplate).filter(FieldTemplate.project_id == project_id).first()
    )
    if not template or not template.fields:
        raise ValueError("No field template defined for this project")

    documents = (
        db.query(Document)
        .filter(Document.project_id == project_id, Document.parse_status == ParseStatus.DONE)
        .all()
    )
    if not documents:
        raise ValueError("No parsed documents found in this project")

    results = []
    errors = []

    for doc in documents:
        for field in template.fields:
            try:
                record = extract_single(
                    db=db,
                    document_id=doc.id,
                    field_key=field["key"],
                    field_type=field.get("type", "text"),
                    field_description=field.get("description", ""),
                )
                results.append(record)
            except Exception as e:
                errors.append(f"[doc={doc.id}, field={field['key']}] {e}")

    if errors and not results:
        raise RuntimeError("All extractions failed:\n" + "\n".join(errors))

    return results
