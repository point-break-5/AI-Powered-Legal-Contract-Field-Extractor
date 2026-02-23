# AI-Powered Legal Contract Field Extractor

A full-stack Legal Tabular Review system that ingests multiple legal documents (PDF, DOCX, HTML, TXT), extracts key fields using Google Gemini AI, and presents results in a structured table for side-by-side comparison and review.

---

## Features

- **Multi-format document ingestion** — PDF (PyMuPDF), DOCX (python-docx), HTML (BeautifulSoup), TXT
- **AI field extraction** — Gemini 2.5 Flash with citations, confidence scores, and normalization
- **Custom field templates** — define any fields; template updates automatically mark stale records
- **Tabular review** — sticky matrix (fields × documents), click-to-review side panel
- **Review workflow** — Confirm / Reject / Manual Edit with full auditability
- **Export** — CSV and Excel download of all extracted + reviewed fields
- **Evaluation** — upload human-labeled CSV, get accuracy %, coverage %, normalization validity %
- **Modern frontend** — Next.js 16 App Router, Tailwind CSS v4, ShobyoShachi design system

---

## Project Structure

```
.
├── backend/                  # FastAPI backend
│   ├── main.py               # App entry point + routers
│   ├── src/
│   │   ├── models.py         # SQLAlchemy ORM models
│   │   ├── schemas.py        # Pydantic request/response schemas
│   │   ├── db.py             # Database session + table creation
│   │   ├── utils.py          # File format helpers
│   │   ├── api/              # Route handlers (projects, documents, templates, extraction, review, export, evaluation)
│   │   └── services/         # LLM client, extraction engine, document parser
│   ├── smoke_test.py         # End-to-end smoke test against data/ samples
│   ├── requirements.txt
│   ├── .env.example
│   └── Documentation.txt     # Full API reference (789 lines)
├── frontend/                 # Next.js 16 App Router frontend
│   ├── app/
│   │   ├── page.tsx          # Project list (home)
│   │   ├── projects/[id]/
│   │   │   ├── docs/         # Document upload & status
│   │   │   ├── template/     # Field template editor
│   │   │   ├── table/        # Review table (core screen)
│   │   │   └── eval/         # Evaluation report
│   │   ├── components/       # ProjectShell sidebar, Button, Badge, Spinner
│   │   └── lib/              # api.ts (typed client), utils.ts
│   └── tsconfig.json
├── data/                     # Sample legal documents for smoke testing
└── docs/                     # Architecture, functional design, testing docs
```

---

## Quick Start

### Prerequisites

- Python 3.11+
- Node.js 20+
- A [Google AI Studio](https://aistudio.google.com/) API key (Gemini)

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
# Edit backend/.env and set GEMINI_API_KEY=your_key_here

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
cp .env.example .env.local      # or create manually
# NEXT_PUBLIC_API_URL=http://localhost:8000

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
Create Project
    → Upload Documents (PDF / DOCX / HTML / TXT)
    → Define Field Template (key, type, description, required)
    → Extract All Fields  (Gemini AI — citations + confidence + normalization)
    → Review Table        (Confirm / Reject / Manual Edit per cell)
    → Export CSV or Excel
    → Evaluate Accuracy   (upload human labels → accuracy / coverage / normalization %)
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 16, TypeScript, Tailwind CSS v4, lucide-react |
| Backend | FastAPI 0.115, Python 3.11, Uvicorn |
| ORM / DB | SQLAlchemy 2.0, SQLite |
| AI | Google Gemini 2.5 Flash (`google-genai >= 1.0.0`) |
| Parsing | PyMuPDF, python-docx, BeautifulSoup4 |
| Export | pandas, openpyxl |

---

## Documentation

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — System design, data flow, status transitions
- [docs/FUNCTIONAL_DESIGN.md](docs/FUNCTIONAL_DESIGN.md) — User flows, API behaviors, edge cases
- [docs/TESTING.md](docs/TESTING.md) — Extraction accuracy, QA checklist, smoke test guide
- [backend/Documentation.txt](backend/Documentation.txt) — Full API endpoint reference

---

## API Overview

| Method | Path | Description |
|---|---|---|
| POST | `/projects` | Create project |
| GET | `/projects` | List all projects |
| POST | `/projects/{id}/documents` | Upload document |
| GET | `/projects/{id}/documents` | List documents |
| POST | `/projects/{id}/template` | Save field template |
| POST | `/projects/{id}/extract/all` | Extract all fields × all docs |
| GET | `/projects/{id}/table` | Tabular review matrix |
| POST | `/projects/{id}/records/{rid}/review` | Confirm/reject/edit a cell |
| GET | `/projects/{id}/export?format=csv` | Export CSV |
| GET | `/projects/{id}/export?format=xlsx` | Export Excel |
| POST | `/projects/{id}/evaluation/upload` | Upload human labels |
| GET | `/projects/{id}/evaluation/report` | Get accuracy report |

Full reference: [backend/Documentation.txt](backend/Documentation.txt)
