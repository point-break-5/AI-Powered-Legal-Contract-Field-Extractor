# Architecture Design

## 1. System Overview

The system is a full-stack Legal Tabular Review application with three logical tiers:

```
┌─────────────────────────────────────────────────────────────┐
│                        Browser                              │
│  Next.js 16 App Router  ·  TypeScript  ·  Tailwind CSS v4   │
└────────────────────────────┬────────────────────────────────┘
                             │ HTTP (REST, JSON)
                             │ localhost:3000 → localhost:8000
┌────────────────────────────▼────────────────────────────────┐
│                      FastAPI Backend                        │
│  ┌──────────────┐  ┌───────────────┐  ┌──────────────────┐  │
│  │  API Routers │  │   Services    │  │   Data Layer     │  │
│  │  (7 modules) │  │  parser / llm │  │  SQLAlchemy ORM  │  │
│  │              │  │  extraction   │  │  SQLite DB       │  │
│  └──────┬───────┘  └──────┬────────┘  └──────────────────┘  │
└─────────┼─────────────────┼───────────────────────────────-─┘
          │                 │ HTTPS
          │                 ▼
          │        ┌────────────────┐
          │        │  Google Gemini │
          │        │  2.5 Flash API │
          │        └────────────────┘
          │
          ▼ local disk
    backend/uploads/   (raw uploaded files)
    legal_extractor.db (SQLite)
```

---

## 2. Component Boundaries

### 2.1 Frontend (`frontend/`)

| Component | Path | Responsibility |
|---|---|---|
| Project list | `app/page.tsx` | Create / list / delete projects |
| Document upload | `app/projects/[id]/docs/` | Upload files, display parse status |
| Template editor | `app/projects/[id]/template/` | Define / version field schemas |
| Review table | `app/projects/[id]/table/` | Tabular extraction view + review actions |
| Evaluation | `app/projects/[id]/eval/` | Upload labels, view accuracy metrics |
| API client | `app/lib/api.ts` | Typed wrappers for all backend endpoints |
| Sidebar shell | `app/components/ProjectShell.tsx` | Fixed nav sidebar shared across all project pages |

### 2.2 Backend (`backend/`)

| Module | Path | Responsibility |
|---|---|---|
| Entry point | `main.py` | FastAPI app, CORS, lifespan, router registration |
| Projects API | `src/api/projects.py` | Project CRUD |
| Documents API | `src/api/documents.py` | Upload, parse, list, delete |
| Templates API | `src/api/templates.py` | Create/update/get/delete field template; triggers STALE |
| Extraction API | `src/api/extraction.py` | `/extract/all` and `/extract/field` endpoints |
| Review API | `src/api/review.py` | Review update, record list, table matrix |
| Export API | `src/api/export.py` | CSV / Excel download |
| Evaluation API | `src/api/evaluation.py` | Upload human labels, generate accuracy report |
| Parser service | `src/services/parser.py` | PDF→PyMuPDF, DOCX→python-docx, HTML→BS4, TXT |
| LLM service | `src/services/llm.py` | Gemini API client, retry logic, JSON response parsing |
| Extraction service | `src/services/extraction.py` | Orchestrates LLM calls, upserts ExtractionRecord |
| ORM models | `src/models.py` | SQLAlchemy table definitions + enums |
| Schemas | `src/schemas.py` | Pydantic v2 request/response models |
| DB setup | `src/db.py` | Engine, SessionLocal, get_db dependency, create_tables |

---

## 3. Data Flow

### 3.1 Document Ingestion

```
User uploads file (multipart/form-data)
        │
        ▼
documents.py — validate format, check for duplicates
        │
        ├─► Save raw file → backend/uploads/{filename}
        │
        ├─► Create Document row (parse_status = QUEUED)
        │
        ├─► Call parser.py
        │       PDF  → fitz.open() → page.get_text()
        │       DOCX → Document(file) → paragraph.text join
        │       HTML → BeautifulSoup(file, "lxml") → get_text()
        │       TXT  → file.read().decode("utf-8")
        │
        ├─► Store parsed_text in Document row
        │
        └─► Set parse_status = DONE  (or ERROR on failure)
```

### 3.2 AI Field Extraction

```
POST /projects/{id}/extract/all
        │
        ▼
extraction.py (API) — load template fields + DONE documents
        │
        └─► For each (document, field) pair:
                │
                ▼
            extract_single() in services/extraction.py
                │
                ├─► _get_or_create_record() — upsert ExtractionRecord
                │
                ├─► llm.extract_field(document_text, field_key, field_type, field_description)
                │       │
                │       ▼
                │   Build structured prompt with normalization rules
                │   Call genai.Client().models.generate_content()
                │       model: gemini-2.5-flash
                │       temperature: 0.1
                │       response_mime_type: application/json
                │   Retry up to 3× (exponential backoff: 2^n seconds)
                │   Strip markdown fences if present
                │   Parse JSON response
                │       │
                │       └─► { value, raw_text, citations, confidence, normalized_value }
                │
                ├─► Persist to ExtractionRecord
                │
                └─► If value is null OR confidence < 0.3 → status = MISSING_DATA
                    Otherwise → status = PENDING (awaiting human review)
```

### 3.3 Review Workflow

```
User clicks cell in table → side panel opens
        │
        ├─► Confirm  → POST /review  { status: "CONFIRMED" }
        │              AI value + normalized_value unchanged
        │
        ├─► Reject   → POST /review  { status: "REJECTED" }
        │              AI value preserved; record flagged
        │
        └─► Manual   → POST /review  { status: "MANUAL_UPDATED", manual_value: "..." }
                       manual_value stored in separate column
                       AI value + normalized_value NEVER overwritten
```

### 3.4 Export

```
GET /projects/{id}/export?format=csv|xlsx
        │
        ▼
Fetch all ExtractionRecords for project
Build pandas DataFrame with columns:
    document | field_key | ai_value | normalized_value |
    confidence | review_status | manual_value | citations
        │
        ├─► format=csv  → StreamingResponse (text/csv)
        └─► format=xlsx → StreamingResponse (application/vnd.openxmlformats...)
                          openpyxl auto-fits column widths
```

### 3.5 Evaluation

```
POST /projects/{id}/evaluation/upload  (CSV)
        │
        ▼
Parse CSV — columns: document_filename, field_key, expected_value
Delete existing EvaluationLabel rows for this project
Insert new EvaluationLabel rows
        │
        ▼
GET /projects/{id}/evaluation/report
        │
        ▼
Join EvaluationLabel ↔ ExtractionRecord on (document filename, field_key)
Compute:
    overall_accuracy_pct        = matched / total_labels × 100
    overall_coverage_pct        = non-null_ai_values / total_labels × 100
    normalization_validity_pct  = norm_matched / total_labels × 100
    per_field                   = [{ field_key, total, matched, accuracy_pct }]
    side_by_side                = full row comparison list
```

---

## 4. Storage Layout

### 4.1 SQLite Database (`backend/legal_extractor.db`)

```
projects
├── id          INTEGER PK
├── name        TEXT
├── status      ENUM (PENDING | PROCESSING | READY | ERROR)
├── created_at  DATETIME
└── updated_at  DATETIME

documents
├── id            INTEGER PK
├── project_id    FK → projects.id  (CASCADE DELETE)
├── filename      TEXT
├── format        TEXT (pdf | docx | html | txt)
├── parse_status  ENUM (QUEUED | PARSING | DONE | ERROR)
├── parsed_text   TEXT
└── created_at    DATETIME

field_templates
├── id          INTEGER PK
├── project_id  FK → projects.id  (CASCADE DELETE, UNIQUE)
├── fields_json TEXT  (JSON array of FieldDefinition objects)
├── version     INTEGER
└── updated_at  DATETIME

extraction_records
├── id               INTEGER PK
├── document_id      FK → documents.id  (CASCADE DELETE)
├── field_key        TEXT
├── value            TEXT  (AI extracted value)
├── raw_text         TEXT  (verbatim passage from document)
├── citations_json   TEXT  (JSON: [{ page, excerpt }])
├── confidence       FLOAT (0.0–1.0)
├── normalized_value TEXT  (normalised form of value)
├── review_status    ENUM (PENDING | CONFIRMED | REJECTED | MANUAL_UPDATED | MISSING_DATA | STALE)
├── manual_value     TEXT  (human override — never overwrites value)
├── created_at       DATETIME
└── updated_at       DATETIME

evaluation_labels
├── id                  INTEGER PK
├── project_id          FK → projects.id
├── document_filename   TEXT
├── field_key           TEXT
├── expected_value      TEXT
└── created_at          DATETIME
```

### 4.2 File System

```
backend/
└── uploads/
    └── {filename}    ← raw uploaded files (preserved for reprocessing)
```

---

## 5. Status Transition Diagrams

### 5.1 Document Parse Status

```
[QUEUED] → (upload accepted)
    │
    ▼
[PARSING] → (parser service running)
    │                    │
    ▼                    ▼
[DONE]              [ERROR]
(parsed_text stored)  (parse failure logged)
```

### 5.2 ExtractionRecord Review Status

```
                     ┌──────────────────────────────────────┐
                     │                                      │
[STALE] ─────────────┤                                      │
(template versioned) │                                      │
                     ▼                                      │
              [extract/all or extract/field]                │
                     │                                      │
          ┌──────────┴──────────┐                           │
          ▼                     ▼                           │
     [PENDING]           [MISSING_DATA]                     │
  (value found,       (null value OR conf < 0.3)            │
   awaiting review)                                         │
          │                                                 │
    ┌─────┼──────────────┐                                  │
    ▼     ▼              ▼                                  │
[CONFIRMED] [REJECTED] [MANUAL_UPDATED]                     │
                           (manual_value stored)            │
                                                            │
  Template update (version bump) → all above records ───────┘
```

### 5.3 Project Status

```
[PENDING]  → created, no documents
[PROCESSING] → extraction in progress (future async enhancement)
[READY]    → at least one extraction completed successfully
[ERROR]    → all extractions failed
```

---

## 6. Technology Choices

| Decision | Choice | Rationale |
|---|---|---|
| LLM | Gemini 2.5 Flash | Fast, cost-efficient, structured JSON output via `response_mime_type` |
| ORM | SQLAlchemy 2.0 | Robust cascade deletes, clean upsert pattern, no migration tool needed for take-home scope |
| DB | SQLite | Zero-config, single-file, adequate for take-home data volume |
| Frontend framework | Next.js 16 App Router | File-based routing, server components, `redirect()` built-in |
| Styling | Tailwind CSS v4 + CSS variables | Design-token driven, no runtime CSS-in-JS overhead |
| PDF parsing | PyMuPDF (fitz) | Fastest Python PDF text extractor, preserves page structure |
| Excel export | openpyxl via pandas | Auto-fit column widths, xlsx format without external services |
