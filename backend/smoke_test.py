"""Smoke test: upload all data/ sample files, extract common fields, print results.

Run from backend/ directory with the venv active:
    python smoke_test.py

Requires GEMINI_API_KEY in backend/.env
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

# Make src importable
sys.path.insert(0, str(Path(__file__).parent))

from dotenv import load_dotenv

load_dotenv()

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from src.db import create_tables
from src.models import Document, ExtractionRecord, FieldTemplate, ParseStatus, Project, ReviewStatus
from src.services.extraction import extract_all
from src.services.parser import parse_document

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./smoke_test.db")
DATA_DIR = Path(__file__).parent.parent / "data"

SAMPLE_FILES = [
    "Supply Agreement.pdf",
    "EX-10.2.html",
    "tsla-ex102_486.htm.pdf",
    "tsla-ex103_198.htm.pdf",
    "tsla-ex103_462.htm.pdf",
    "Tesla, Inc. (Form_ PRE 14A, Received_ 09_05_2025 06_21_37).html",
]

TEST_FIELDS = [
    {"key": "party_a", "type": "entity", "description": "First named party / counterparty in the contract", "required": True},
    {"key": "party_b", "type": "entity", "description": "Second named party in the contract", "required": True},
    {"key": "effective_date", "type": "date", "description": "The date the agreement comes into effect", "required": True},
    {"key": "governing_law", "type": "text", "description": "Jurisdiction and governing law of the agreement", "required": False},
    {"key": "contract_value", "type": "amount", "description": "Total contract value or payment amount if stated", "required": False},
]

# ---------------------------------------------------------------------------
# Setup
# ---------------------------------------------------------------------------

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
create_tables()
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
db = SessionLocal()


def _divider(title: str = "") -> None:
    print("\n" + "=" * 72)
    if title:
        print(f"  {title}")
        print("=" * 72)


# ---------------------------------------------------------------------------
# Run
# ---------------------------------------------------------------------------

def run() -> None:
    _divider("SMOKE TEST — AI Legal Field Extractor")

    # Create a test project
    project = Project(name="__smoke_test__")
    db.add(project)
    db.flush()
    print(f"\n✓ Created project id={project.id}")

    # Upload and parse each sample file
    parsed_docs: list[Document] = []
    for fname in SAMPLE_FILES:
        fpath = DATA_DIR / fname
        if not fpath.exists():
            print(f"  ⚠ SKIP (not found): {fname}")
            continue

        raw_bytes = fpath.read_bytes()
        ext = fpath.suffix.lstrip(".").lower()
        if ext == "htm":
            ext = "html"

        try:
            text = parse_document(raw_bytes, ext)
            parse_ok = True
        except Exception as e:
            print(f"  ✗ PARSE ERROR {fname}: {e}")
            parse_ok = False
            text = ""

        doc = Document(
            project_id=project.id,
            filename=fname,
            format=ext,
            parse_status=ParseStatus.DONE if parse_ok else ParseStatus.ERROR,
            parsed_text=text,
        )
        db.add(doc)
        db.flush()

        status = "✓" if parse_ok else "✗"
        chars = len(text) if text else 0
        print(f"  {status} Parsed: {fname} ({chars:,} chars)")
        if parse_ok:
            parsed_docs.append(doc)

    if not parsed_docs:
        print("\n✗ No files parsed — aborting extraction.")
        db.rollback()
        return

    # Create field template
    tpl = FieldTemplate(project_id=project.id)
    tpl.fields = TEST_FIELDS
    db.add(tpl)
    db.flush()
    print(f"\n✓ Template created with {len(TEST_FIELDS)} fields")

    db.commit()

    # Run extraction
    _divider("Extraction")
    print(f"  Extracting {len(TEST_FIELDS)} fields × {len(parsed_docs)} documents …\n")

    try:
        records = extract_all(db, project.id)
    except RuntimeError as e:
        print(f"✗ extract_all failed: {e}")
        db.rollback()
        return

    # Print results table
    _divider("Results")
    col_w = 28
    header = f"{'Document':<{col_w}} {'Field':<20} {'Value':<30} {'Norm':<25} {'Conf':>5}  Status"
    print(header)
    print("-" * len(header))

    for rec in records:
        doc = db.query(Document).filter(Document.id == rec.document_id).first()
        dname = (doc.filename[:col_w - 1] + "…") if doc and len(doc.filename) > col_w else (doc.filename if doc else "?")
        val = str(rec.value or "—")[:30]
        norm = str(rec.normalized_value or "—")[:25]
        conf = f"{rec.confidence:.2f}" if rec.confidence is not None else "  — "
        status_icon = {
            ReviewStatus.PENDING: "⏳",
            ReviewStatus.MISSING_DATA: "❌",
            ReviewStatus.CONFIRMED: "✅",
        }.get(rec.review_status, str(rec.review_status.value))

        print(f"{dname:<{col_w}} {rec.field_key:<20} {val:<30} {norm:<25} {conf:>5}  {status_icon}")

    # Summary
    total = len(records)
    missing = sum(1 for r in records if r.review_status == ReviewStatus.MISSING_DATA)
    coverage = (total - missing) / total * 100 if total else 0
    avg_conf = sum(r.confidence or 0.0 for r in records) / total if total else 0.0
    _divider("Summary")
    print(f"  Total records : {total}")
    print(f"  Coverage      : {coverage:.1f}%  ({total - missing}/{total} non-missing)")
    print(f"  Avg confidence: {avg_conf:.2f}")
    print()

    # Cleanup
    db.rollback()  # Don't persist smoke test data
    db.close()
    print("  (smoke test data not persisted — rolled back)")


if __name__ == "__main__":
    run()
