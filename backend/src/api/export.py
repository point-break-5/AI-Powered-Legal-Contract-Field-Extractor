"""Export project extraction results as CSV or Excel."""

from __future__ import annotations

import io

import pandas as pd
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from src.db import get_db
from src.models import Document, ExtractionRecord, FieldTemplate, ParseStatus, Project

router = APIRouter(prefix="/projects", tags=["export"])

_MEDIA_TYPES = {
    "csv": "text/csv",
    "xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
}


def _build_matrix(rows, field_order: list[str], doc_names: list[str]) -> pd.DataFrame:
    """Build a matrix DataFrame: rows=fields, columns=documents."""
    from collections import defaultdict
    cell_data: dict[str, dict[str, str]] = defaultdict(dict)
    for rec, fname in rows:
        display = rec.manual_value or rec.normalized_value or rec.value or ""
        status = rec.review_status.value
        cell_data[rec.field_key][fname] = display if display else f"[{status}]"
    matrix_rows = []
    for fkey in field_order:
        row: dict[str, str] = {"field": fkey}
        for doc in doc_names:
            row[doc] = cell_data[fkey].get(doc, "")
        matrix_rows.append(row)
    return pd.DataFrame(matrix_rows, columns=["field"] + doc_names)


def _auto_width(ws) -> None:
    """Auto-fit Excel column widths."""
    for col_cells in ws.columns:
        max_len = max(
            (len(str(cell.value)) if cell.value is not None else 0)
            for cell in col_cells
        )
        ws.column_dimensions[col_cells[0].column_letter].width = min(max_len + 4, 80)


@router.get("/{project_id}/export")
def export_table(
    project_id: int,
    format: str = Query(default="csv", description="csv or xlsx"),
    db: Session = Depends(get_db),
):
    """Export the extraction matrix as CSV or Excel.

    Columns: document | field_key | ai_value | normalized_value |
             confidence | review_status | manual_value | citations
    """
    fmt = format.lower()
    if fmt not in _MEDIA_TYPES:
        raise HTTPException(status_code=400, detail=f"Unsupported format '{format}'. Use csv or xlsx.")

    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    template = db.query(FieldTemplate).filter(FieldTemplate.project_id == project_id).first()
    if not template:
        raise HTTPException(status_code=404, detail="No field template found for this project")

    # Fetch all extraction records joined with document info
    rows = (
        db.query(ExtractionRecord, Document.filename)
        .join(Document, ExtractionRecord.document_id == Document.id)
        .filter(Document.project_id == project_id)
        .order_by(Document.filename, ExtractionRecord.field_key)
        .all()
    )

    if not rows:
        # Return empty-but-valid file rather than 404
        data = []
    else:
        data = [
            {
                "document": filename,
                "field_key": rec.field_key,
                "ai_value": rec.value,
                "normalized_value": rec.normalized_value,
                "confidence": rec.confidence,
                "review_status": rec.review_status.value,
                "manual_value": rec.manual_value,
                # Flatten citations to a readable string for tabular export
                "citations": "; ".join(
                    f"p{c.get('page','?')}: {c.get('excerpt','')}"
                    for c in rec.citations
                ),
            }
            for rec, filename in rows
        ]

    df = pd.DataFrame(
        data,
        columns=[
            "document",
            "field_key",
            "ai_value",
            "normalized_value",
            "confidence",
            "review_status",
            "manual_value",
            "citations",
        ],
    )

    safe_name = "".join(c if c.isalnum() or c in "-_" else "_" for c in project.name)
    filename = f"{safe_name}_extraction.{fmt}"

    if fmt == "csv":
        content = df.to_csv(index=False).encode("utf-8")
        return StreamingResponse(
            io.BytesIO(content),
            media_type=_MEDIA_TYPES["csv"],
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )

    # xlsx
    buf = io.BytesIO()
    with pd.ExcelWriter(buf, engine="openpyxl") as writer:
        df.to_excel(writer, index=False, sheet_name="Extractions")

        # Auto-fit column widths
        ws = writer.sheets["Extractions"]
        for col_cells in ws.columns:
            max_len = max(
                (len(str(cell.value)) if cell.value is not None else 0)
                for cell in col_cells
            )
            ws.column_dimensions[col_cells[0].column_letter].width = min(max_len + 4, 80)

    buf.seek(0)
    return StreamingResponse(
        buf,
        media_type=_MEDIA_TYPES["xlsx"],
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
