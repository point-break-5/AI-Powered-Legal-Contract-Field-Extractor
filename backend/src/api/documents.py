import os
import shutil

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy.orm import Session

from src.db import get_db
from src.models import Document, ParseStatus, Project
from src.schemas import DocumentResponse
from src.services.parser import parse_document
from src.utils import is_supported_format

router = APIRouter(prefix="/projects", tags=["documents"])

UPLOAD_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)


@router.post("/{project_id}/documents", response_model=DocumentResponse, status_code=201)
async def upload_document(
    project_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    # Validate project exists
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    # Validate file format
    if not is_supported_format(file.filename):
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file format. Allowed: pdf, docx, html, htm, txt",
        )

    # Check for duplicate filename in the same project
    existing = (
        db.query(Document)
        .filter(Document.project_id == project_id, Document.filename == file.filename)
        .first()
    )
    if existing:
        raise HTTPException(
            status_code=409,
            detail=f"A document named '{file.filename}' already exists in this project.",
        )

    content = await file.read()
    ext = file.filename.rsplit(".", 1)[-1].lower()

    # Save raw file to disk
    save_path = os.path.join(UPLOAD_DIR, f"{project_id}_{file.filename}")
    with open(save_path, "wb") as f:
        f.write(content)

    # Create DB record with PARSING status
    doc = Document(
        project_id=project_id,
        filename=file.filename,
        format=ext,
        parse_status=ParseStatus.PARSING,
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)

    # Parse the document
    try:
        parsed_text = parse_document(file.filename, content)
        doc.parsed_text = parsed_text
        doc.parse_status = ParseStatus.DONE
    except Exception as e:
        doc.parse_status = ParseStatus.ERROR
        db.commit()
        raise HTTPException(status_code=422, detail=f"Failed to parse document: {str(e)}")

    db.commit()
    db.refresh(doc)
    return doc


@router.get("/{project_id}/documents", response_model=list[DocumentResponse])
def list_documents(project_id: int, db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return (
        db.query(Document)
        .filter(Document.project_id == project_id)
        .order_by(Document.created_at.asc())
        .all()
    )


@router.get("/{project_id}/documents/{document_id}", response_model=DocumentResponse)
def get_document(project_id: int, document_id: int, db: Session = Depends(get_db)):
    doc = (
        db.query(Document)
        .filter(Document.id == document_id, Document.project_id == project_id)
        .first()
    )
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    return doc


@router.delete("/{project_id}/documents/{document_id}", status_code=204)
def delete_document(project_id: int, document_id: int, db: Session = Depends(get_db)):
    doc = (
        db.query(Document)
        .filter(Document.id == document_id, Document.project_id == project_id)
        .first()
    )
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    # Remove saved file from disk if it exists
    save_path = os.path.join(UPLOAD_DIR, f"{project_id}_{doc.filename}")
    if os.path.exists(save_path):
        os.remove(save_path)

    db.delete(doc)
    db.commit()
