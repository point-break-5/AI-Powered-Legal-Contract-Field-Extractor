"""Evaluation routes: upload human labels and generate accuracy reports."""

from __future__ import annotations

import io
from collections import defaultdict

import pandas as pd
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy.orm import Session

from src.db import get_db
from src.models import Document, EvaluationLabel, ExtractionRecord, Project
from src.schemas import EvaluationReport, FieldAccuracy, SideBySideRow

router = APIRouter(prefix="/projects", tags=["evaluation"])

_REQUIRED_COLUMNS = {"document_filename", "field_key", "expected_value"}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _values_match(ai: str | None, expected: str) -> bool:
    """Case-insensitive, whitespace-stripped equality check."""
    if ai is None:
        return False
    return ai.strip().lower() == expected.strip().lower()


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------


@router.post("/{project_id}/evaluation/upload", status_code=201)
def upload_labels(
    project_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    """Upload a CSV of human-labeled ground truth.

    Required columns: document_filename, field_key, expected_value

    Replaces all existing labels for this project on each upload.
    """
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    if not file.filename or not file.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only CSV files are accepted")

    try:
        content = file.file.read()
        df = pd.read_csv(io.BytesIO(content))
    except Exception as exc:
        raise HTTPException(status_code=422, detail=f"Could not parse CSV: {exc}") from exc

    # Normalise column names (strip + lowercase)
    df.columns = [c.strip().lower() for c in df.columns]

    missing = _REQUIRED_COLUMNS - set(df.columns)
    if missing:
        raise HTTPException(
            status_code=422,
            detail=f"CSV missing required columns: {', '.join(sorted(missing))}",
        )

    # Drop rows where any required field is null
    df = df.dropna(subset=list(_REQUIRED_COLUMNS))
    if df.empty:
        raise HTTPException(status_code=422, detail="CSV contains no valid rows after cleaning")

    # Replace existing labels for this project
    db.query(EvaluationLabel).filter(EvaluationLabel.project_id == project_id).delete()

    labels = [
        EvaluationLabel(
            project_id=project_id,
            document_filename=str(row["document_filename"]).strip(),
            field_key=str(row["field_key"]).strip(),
            expected_value=str(row["expected_value"]).strip(),
        )
        for _, row in df.iterrows()
    ]
    db.add_all(labels)
    db.commit()

    return {"project_id": project_id, "labels_uploaded": len(labels)}


@router.get("/{project_id}/evaluation/report", response_model=EvaluationReport)
def get_evaluation_report(project_id: int, db: Session = Depends(get_db)):
    """Compare AI extraction results against uploaded human labels.

    Metrics:
    - overall_accuracy_pct  : % labels where AI value matches expected (case-insensitive)
    - overall_coverage_pct  : % labels that have a non-null AI extraction
    - normalization_validity_pct : % labels where normalized_value matches expected
    - per_field             : accuracy breakdown by field key
    - side_by_side          : full row-by-row comparison table
    """
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    labels = (
        db.query(EvaluationLabel)
        .filter(EvaluationLabel.project_id == project_id)
        .all()
    )
    if not labels:
        raise HTTPException(
            status_code=404,
            detail="No evaluation labels found. Upload a CSV first via POST /evaluation/upload",
        )

    # Build fast lookup: (filename, field_key) -> ExtractionRecord
    # Join through Document so we can match by filename
    records_q = (
        db.query(ExtractionRecord, Document.filename)
        .join(Document, ExtractionRecord.document_id == Document.id)
        .filter(Document.project_id == project_id)
        .all()
    )
    record_map: dict[tuple[str, str], ExtractionRecord] = {
        (filename.strip(), rec.field_key.strip()): rec
        for rec, filename in records_q
    }

    side_by_side: list[SideBySideRow] = []
    total = len(labels)
    matched_ai = 0
    covered = 0
    norm_matched = 0
    norm_total = 0  # labels that have a normalized_value to compare

    per_field_total: dict[str, int] = defaultdict(int)
    per_field_matched: dict[str, int] = defaultdict(int)

    for lbl in labels:
        key = (lbl.document_filename, lbl.field_key)
        rec = record_map.get(key)

        ai_val = rec.value if rec else None
        norm_val = rec.normalized_value if rec else None

        is_covered = ai_val is not None
        is_match = _values_match(ai_val, lbl.expected_value)
        is_norm_match = _values_match(norm_val, lbl.expected_value)

        if is_covered:
            covered += 1
        if is_match:
            matched_ai += 1
        if norm_val is not None:
            norm_total += 1
            if is_norm_match:
                norm_matched += 1

        per_field_total[lbl.field_key] += 1
        if is_match:
            per_field_matched[lbl.field_key] += 1

        side_by_side.append(
            SideBySideRow(
                document=lbl.document_filename,
                field_key=lbl.field_key,
                expected_value=lbl.expected_value,
                ai_value=ai_val,
                normalized_value=norm_val,
                match=is_match,
            )
        )

    per_field = [
        FieldAccuracy(
            field_key=fk,
            total=per_field_total[fk],
            matched=per_field_matched[fk],
            accuracy_pct=round(per_field_matched[fk] / per_field_total[fk] * 100, 2),
        )
        for fk in sorted(per_field_total)
    ]

    return EvaluationReport(
        project_id=project_id,
        total_labels=total,
        total_matched=matched_ai,
        overall_accuracy_pct=round(matched_ai / total * 100, 2) if total else 0.0,
        overall_coverage_pct=round(covered / total * 100, 2) if total else 0.0,
        normalization_validity_pct=round(norm_matched / norm_total * 100, 2) if norm_total else 0.0,
        per_field=per_field,
        side_by_side=side_by_side,
    )
