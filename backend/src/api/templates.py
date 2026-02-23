from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from src.db import get_db
from src.models import Document, ExtractionRecord, FieldTemplate, Project, ReviewStatus
from src.schemas import TemplateCreate, TemplateResponse

router = APIRouter(prefix="/projects", tags=["templates"])


def _mark_records_stale(project_id: int, db: Session) -> int:
    """Mark all extraction records in the project as STALE after a template update."""
    doc_ids = [d.id for d in db.query(Document.id).filter(Document.project_id == project_id)]
    if not doc_ids:
        return 0
    updated = (
        db.query(ExtractionRecord)
        .filter(ExtractionRecord.document_id.in_(doc_ids))
        .update({"review_status": ReviewStatus.STALE}, synchronize_session=False)
    )
    return updated


@router.post("/{project_id}/template", response_model=TemplateResponse, status_code=200)
def upsert_template(project_id: int, payload: TemplateCreate, db: Session = Depends(get_db)):
    """Create or update the field template for a project.
    On update, bumps the version and marks all existing extraction records as STALE.
    """
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    template = db.query(FieldTemplate).filter(FieldTemplate.project_id == project_id).first()

    if template is None:
        # First time creating the template
        template = FieldTemplate(project_id=project_id, version=1)
        template.fields = [f.model_dump() for f in payload.fields]
        db.add(template)
        db.commit()
        db.refresh(template)
    else:
        # Updating existing template — bump version and mark records stale
        template.fields = [f.model_dump() for f in payload.fields]
        template.version += 1
        stale_count = _mark_records_stale(project_id, db)
        db.commit()
        db.refresh(template)

    return _to_response(template)


@router.get("/{project_id}/template", response_model=TemplateResponse)
def get_template(project_id: int, db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    template = db.query(FieldTemplate).filter(FieldTemplate.project_id == project_id).first()
    if not template:
        raise HTTPException(status_code=404, detail="No template defined for this project yet")

    return _to_response(template)


@router.delete("/{project_id}/template", status_code=204)
def delete_template(project_id: int, db: Session = Depends(get_db)):
    template = db.query(FieldTemplate).filter(FieldTemplate.project_id == project_id).first()
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    db.delete(template)
    db.commit()


# ---------------------------------------------------------------------------
# Helper
# ---------------------------------------------------------------------------

def _to_response(template: FieldTemplate) -> TemplateResponse:
    return TemplateResponse(
        id=template.id,
        project_id=template.project_id,
        fields=template.fields,
        version=template.version,
        updated_at=template.updated_at,
    )
