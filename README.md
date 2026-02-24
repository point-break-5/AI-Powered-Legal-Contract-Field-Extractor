# AI-Powered Legal Contract Field Extractor

A full-stack Legal Tabular Review system that ingests multiple legal documents (PDF, DOCX, HTML, TXT), extracts structured fields using a multi-model AI pipeline, and presents results in an interactive table for side-by-side comparison, review, and export.

---

## Features

### Document Processing
- **Multi-format ingestion** — PDF (PyMuPDF), DOCX (python-docx), HTML (BeautifulSoup4), TXT
- **OCR for scanned PDFs** — image-only pages are automatically detected and processed via Tesseract; text-layer pages use the fast native extractor

### AI Extraction
- **Multi-model pipeline** — Gemini 2.5 Flash (primary), Grok (xAI), DeepSeek Chat as automatic fallbacks
- **Auto-fallback chain** — on quota/rate-limit (429), the system silently retries with the next available provider
- **Structured output** — each extracted value carries a citation, confidence score (0–1), and normalized form

### Field Templates
- **Custom field templates** — define any fields (key, type, description, required flag) per project
- **Built-in presets** — Common Clauses, Financial Terms, Parties & Dates, and more
- **Save as preset** — save any template as a named custom preset; rename or delete presets at any time
- **Stale detection** — editing the template automatically marks all affected extraction records as STALE

### Review Table
- **Sticky matrix** — fields as rows, documents as columns; click any cell to open a side review panel
- **Drag-and-drop column reordering** — reorder document columns by dragging with animated drop indicators
- **Inline cell editing** — edit extracted values directly in the table
- **Review workflow** — Confirm / Reject / Manual Edit per cell, with full status tracking
- **Re-extract** — re-run extraction on individual cells or the entire project; cancel mid-run at any time

### Export & Evaluation
- **Export** — download the full review matrix as CSV or Excel (one click)
- **Evaluation** — upload a CSV of human-labeled ground truth; get accuracy %, coverage %, and normalization validity % per field

### Activity & Observability
- **Activity Logs** — full per-project audit trail of uploads, deletions, extraction runs, and errors
- **Log levels** — INFO / WARNING / ERROR with filter pills; auto-refreshes every 15 seconds
- **Toast notifications** — concise in-app alerts for quota errors, network failures, and success events

---

## Project Structure

```
.
├── docker-compose.yml              # One-command Docker setup
├── backend/
│   ├── Dockerfile                  # Python 3.11-slim + Tesseract + PyMuPDF
│   ├── .dockerignore
│   ├── main.py                     # App entry point, CORS, router registration
│   ├── src/
│   │   ├── models.py               # SQLAlchemy ORM models + enums
│   │   ├── schemas.py              # Pydantic request/response schemas
│   │   ├── db.py                   # SQLite session + auto table creation
│   │   ├── utils.py                # File format detection helpers
│   │   ├── api/
│   │   │   ├── projects.py         # CRUD for projects
│   │   │   ├── documents.py        # Upload, parse, delete documents
│   │   │   ├── templates.py        # Field template save/load
│   │   │   ├── extraction.py       # Extract all / extract single / clear
│   │   │   ├── review.py           # Confirm / reject / manual edit cells
│   │   │   ├── export.py           # CSV and Excel export
│   │   │   ├── evaluation.py       # Ground-truth upload + accuracy report
│   │   │   └── logs.py             # Activity log read/clear + write_log()
│   │   └── services/
│   │       ├── llm.py              # Gemini / Grok / DeepSeek client + fallback chain
│   │       ├── extraction.py       # Orchestration: LLM calls → ExtractionRecord persistence
│   │       └── parser.py           # PDF/DOCX/HTML/TXT parsing + OCR fallback
│   ├── smoke_test.py               # End-to-end smoke test against data/ samples
│   ├── requirements.txt
│   ├── .env.example
│   └── Documentation.txt           # Full API reference
├── frontend/
│   ├── Dockerfile                  # 3-stage Node.js build (deps → builder → runner)
│   ├── .dockerignore
│   ├── app/
│   │   ├── page.tsx                # Landing page
│   │   ├── projects/
│   │   │   ├── page.tsx            # Project list
│   │   │   └── [id]/
│   │   │       ├── docs/           # Document upload & parse status
│   │   │       ├── template/       # Field template editor + custom presets
│   │   │       ├── table/          # Review table (core screen)
│   │   │       ├── eval/           # Evaluation accuracy report
│   │   │       └── logs/           # Activity log viewer
│   │   ├── components/
│   │   │   ├── ProjectShell.tsx    # Sidebar navigation shell
│   │   │   └── ui/                 # Button, Badge, Spinner primitives
│   │   └── lib/
│   │       ├── api.ts              # Fully-typed API client
│   │       └── utils.ts            # Date formatting, helpers
│   ├── .env.example
│   └── tsconfig.json
├── data/                           # Sample legal documents for smoke testing
└── docs/                           # Architecture, functional design, testing docs
```

---

## Quick Start

Choose **Docker** (recommended — one command) or **manual** setup.

---

## 🐳 Docker (Recommended)

### Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (or Docker Engine + Compose v2)
- A [Google AI Studio](https://aistudio.google.com/) API key (Gemini 2.5 Flash)

### Steps

```bash
# 1. Clone the repo
git clone https://github.com/point-break-5/AI-Powered-Legal-Contract-Field-Extractor.git
cd AI-Powered-Legal-Contract-Field-Extractor

# 2. Create the backend .env with your API key(s)
cp backend/.env.example backend/.env
# Edit backend/.env and set GEMINI_API_KEY=your_key_here

# 3. Build and start both services
docker compose up --build
```

| Service  | URL                              |
|----------|----------------------------------|
| Frontend | http://localhost:3000            |
| Backend  | http://localhost:8000            |
| API docs | http://localhost:8000/docs       |

The SQLite database and uploaded files are stored in named Docker volumes (`backend_db`, `backend_uploads`) — they survive container restarts and rebuilds.

**Stop and clean up:**
```bash
docker compose down          # stop containers, keep volumes
docker compose down -v       # stop containers AND delete all data volumes
```

**Rebuild after code changes:**
```bash
docker compose up --build
```

---

## Manual Setup

### Prerequisites

- Python 3.11+
- Node.js 20+
- Tesseract OCR installed system-wide (`sudo apt install tesseract-ocr` / `brew install tesseract`)
- A [Google AI Studio](https://aistudio.google.com/) API key (Gemini 2.5 Flash)

---

### 1 — Backend

```bash
# Clone and enter the repo
git clone https://github.com/point-break-5/AI-Powered-Legal-Contract-Field-Extractor.git
cd AI-Powered-Legal-Contract-Field-Extractor

# Create and activate a virtual environment
python -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate

# Install dependencies
pip install -r backend/requirements.txt

# Configure environment
cp backend/.env.example backend/.env
# Edit backend/.env — at minimum set GEMINI_API_KEY

# Run the server
cd backend
uvicorn main:app --reload --port 8000
```

The API will be available at **http://localhost:8000**.  
Interactive docs: **http://localhost:8000/docs**

---

### 2 — Frontend

```bash
cd frontend
npm install

# Configure environment
cp .env.example .env.local
# .env.local already contains: NEXT_PUBLIC_API_URL=http://localhost:8000

npm run dev
```

The frontend will be available at **http://localhost:3000**.

---

### 3 — Smoke Test (optional)

Runs extraction against the sample documents in `data/` without persisting data.

```bash
cd backend
source ../.venv/bin/activate
python smoke_test.py
```

---

## Workflow

```
Landing Page
    → Projects List          (create / delete projects)
    → Upload Documents       (PDF / DOCX / HTML / TXT — OCR handled automatically)
    → Define Field Template  (key, type, description, required — or pick a preset)
    → Extract All Fields     (multi-model AI — citations + confidence + normalization)
    → Review Table           (drag columns, confirm / reject / edit per cell, cancel mid-run)
    → Export CSV or Excel
    → Evaluate Accuracy      (upload human labels → accuracy / coverage / normalization %)
    → Activity Logs          (full audit trail with INFO / WARNING / ERROR filter)
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 16.1, React 19, TypeScript, Tailwind CSS v4, lucide-react |
| Backend | FastAPI 0.115, Python 3.11, Uvicorn |
| ORM / DB | SQLAlchemy 2.0, SQLite |
| AI — Primary | Google Gemini 2.5 Flash (`google-genai >= 1.0.0`) |
| AI — Fallbacks | Grok (xAI), DeepSeek Chat (`openai >= 1.0.0` SDK) |
| OCR | Tesseract via `pytesseract`, page rendering via `Pillow` + PyMuPDF |
| Parsing | PyMuPDF, python-docx, BeautifulSoup4 |
| Export | pandas, openpyxl |

---

## API Overview

| Method | Path | Description |
|---|---|---|
| POST | `/projects` | Create project |
| GET | `/projects` | List all projects |
| POST | `/projects/{id}/documents` | Upload document (PDF/DOCX/HTML/TXT) |
| GET | `/projects/{id}/documents` | List documents with parse status |
| DELETE | `/projects/{id}/documents/{doc_id}` | Delete document |
| POST | `/projects/{id}/template` | Save field template |
| GET | `/projects/{id}/template` | Load field template |
| POST | `/projects/{id}/extract/all` | Extract all fields × all docs |
| POST | `/projects/{id}/extract/single` | Extract one field from one doc |
| DELETE | `/projects/{id}/extract/all` | Clear all extraction records |
| GET | `/projects/{id}/table` | Tabular review matrix |
| POST | `/projects/{id}/records/{rid}/review` | Confirm / reject / manually edit a cell |
| GET | `/projects/{id}/export?format=csv` | Export CSV |
| GET | `/projects/{id}/export?format=xlsx` | Export Excel |
| POST | `/projects/{id}/evaluation/upload` | Upload human-labeled ground truth CSV |
| GET | `/projects/{id}/evaluation/report` | Get accuracy / coverage report |
| GET | `/projects/{id}/logs` | List activity logs (filterable by level) |
| DELETE | `/projects/{id}/logs` | Clear all logs for a project |

Full reference: [backend/Documentation.txt](backend/Documentation.txt)

---

## Documentation

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — System design, data flow, status transitions
- [docs/FUNCTIONAL_DESIGN.md](docs/FUNCTIONAL_DESIGN.md) — User flows, API behaviors, edge cases
- [docs/TESTING.md](docs/TESTING.md) — Extraction accuracy, QA checklist, smoke test guide
- [backend/Documentation.txt](backend/Documentation.txt) — Full API endpoint reference
