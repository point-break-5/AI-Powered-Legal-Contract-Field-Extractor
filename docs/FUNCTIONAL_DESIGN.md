# Functional Design

## 1. User Flows

### 1.1 End-to-End Workflow

```
Create Project
    ↓
Upload Documents  (PDF / DOCX / HTML / TXT)
    ↓
Wait for Parse (QUEUED → PARSING → DONE)
    ↓
Define Field Template  (key, type, description, required)
    ↓
Extract All Fields  (Gemini AI → value + citations + confidence + normalized_value)
    ↓
Review Table  (Confirm / Reject / Manual Edit per cell)
    ↓
Export CSV or Excel
    ↓
Evaluate Accuracy  (upload human labels → accuracy / coverage / normalization %)
```

---

### 1.2 Project Management

| Action | UI Trigger | API Call | Outcome |
|---|---|---|---|
| Create project | "New Project" form on home page | `POST /projects` | Project row created, status = PENDING |
| View project list | Home page load | `GET /projects` | Sorted descending by created_at |
| Delete project | Hover → trash icon on project card | `DELETE /projects/{id}` | Project + all documents + all records deleted via CASCADE |

---

### 1.3 Document Upload

| Action | UI Trigger | API Call | Outcome |
|---|---|---|---|
| Upload file | Drag-drop or click-to-browse | `POST /projects/{id}/documents` (multipart) | File saved to `uploads/`; parse runs synchronously; DONE or ERROR |
| View documents | Docs page load | `GET /projects/{id}/documents` | List with filename, format, parse_status, created_at |
| Delete document | Hover → trash icon | `DELETE /projects/{id}/documents/{d_id}` | DB row deleted; file removed from disk; cascade deletes ExtractionRecords |

**Accepted formats:** `.pdf`, `.docx`, `.doc`, `.html`, `.htm`, `.txt`

**Error conditions:**
- `400` — unsupported file extension
- `409` — filename already exists in this project
- `422` — parsing failed (corrupt or password-protected file)

---

### 1.4 Field Template Management

| Action | UI Trigger | API Call | Outcome |
|---|---|---|---|
| Create/update template | "Save Template" button | `POST /projects/{id}/template` | Upserts template; if version > 1 → all records marked STALE |
| Load existing template | Template page load | `GET /projects/{id}/template` | Populates field editor; 404 if none exists yet |
| Delete template | (not exposed in UI) | `DELETE /projects/{id}/template` | Template row deleted |

**Field Definition Schema:**

```json
{
  "key":         "party_a",          // snake_case identifier, unique per template
  "type":        "entity",           // "text" | "date" | "amount" | "entity"
  "description": "The first party (counterparty A) named in the contract",
  "required":    true
}
```

**Field Types and Their Normalization:**

| Type | Normalization Rule | Example Output |
|---|---|---|
| `text` | Cleaned of extra whitespace | `"Force Majeure clause applies"` |
| `date` | ISO 8601 (YYYY-MM-DD) | `"2024-01-15"` |
| `amount` | Float + currency code | `"1500000.00 USD"` |
| `entity` | Canonical name, strip suffixes | `"Tesla"` (not `"Tesla, Inc."`) |

**STALE Trigger:**
On every template save after version 1, all `ExtractionRecord` rows belonging to this project have their `review_status` set to `STALE`. This signals that the AI result is outdated and must be refreshed via Re-extract All.

---

### 1.5 Field Extraction

| Action | UI Trigger | API Call | Outcome |
|---|---|---|---|
| Extract all | "Re-extract All" button on Review Table | `POST /projects/{id}/extract/all` | Runs extraction for every (DONE document × template field) pair |
| Extract one field | (programmatic) | `POST /projects/{id}/extract/field` body: `{ document_id, field_key }` | Runs one extraction, returns one record |

**Extraction Record Output:**

```json
{
  "id":               42,
  "document_id":      7,
  "field_key":        "effective_date",
  "value":            "January 15, 2024",
  "raw_text":         "This Agreement shall become effective on January 15, 2024.",
  "citations":        [{ "page": "1", "excerpt": "effective on January 15, 2024" }],
  "confidence":       0.95,
  "normalized_value": "2024-01-15",
  "review_status":    "PENDING",
  "manual_value":     null
}
```

**Fallback Behavior:**

| Condition | Behavior |
|---|---|
| Field not found in document | `value = null`, `review_status = MISSING_DATA` |
| Confidence < 0.3 | `review_status = MISSING_DATA` |
| LLM returns malformed JSON | Retry up to 3× with exponential backoff (2^n seconds) |
| All retries exhausted | `review_status = MISSING_DATA`, commit, raise RuntimeError |
| Document not yet parsed | Skip; return 400 if no parsed documents at all |
| No template defined | Return 400 |

**Upsert behavior:** If an `ExtractionRecord` already exists for a (document, field_key) pair, it is overwritten in-place. This means re-extraction preserves the record ID and history of manual_value.

---

### 1.6 Tabular Review (Core Screen)

The review table is the primary user interface for inspecting and acting on extracted data.

**Table Structure:**
- Rows = template fields (field_key)
- Columns = documents (filename)
- Each cell = extracted value for that (field, document) combination

**Cell Contents:**
- Confidence dot — teal (≥ 0.8), amber (≥ 0.5), coral (< 0.5)
- Truncated value (normalized_value if available, else AI value, else manual override)
- ReviewStatus badge

**Cell Click → Side Panel:**
- AI Value (raw extracted text)
- Normalised Value
- Manual Override (if set — shown in blue)
- Confidence %
- Review Status badge
- Citations list (page reference + excerpt)
- Review action buttons:
  - **Confirm** → `POST /review` `{ status: "CONFIRMED" }`
  - **Reject** → `POST /review` `{ status: "REJECTED" }`
  - **Edit Manually** → reveals textarea → `POST /review` `{ status: "MANUAL_UPDATED", manual_value: "..." }`

**Auditability guarantee:** `manual_value` is stored in a separate column. The AI's `value` and `normalized_value` are never modified by a review action.

**Table API Response:**

```json
{
  "project_id": 3,
  "fields":     ["party_a", "effective_date", "governing_law"],
  "documents":  [{ "id": 7, "filename": "contract_a.pdf" }, { "id": 8, "filename": "contract_b.pdf" }],
  "rows": {
    "party_a": {
      "7": { "record_id": 42, "value": "Acme Corp", "normalized_value": "Acme", "confidence": 0.95, "review_status": "PENDING", "citations": [...], "manual_value": null },
      "8": { "record_id": 43, "value": "BridgeCo Ltd", "normalized_value": "BridgeCo", "confidence": 0.88, "review_status": "CONFIRMED", "citations": [...], "manual_value": null }
    },
    "effective_date": { "7": null, "8": { ... } }
  }
}
```

A `null` cell means no extraction record exists yet for that (document, field) pair — extraction has not been run, or the document was not yet parsed.

---

### 1.7 Export

| Format | Endpoint | Response |
|---|---|---|
| CSV | `GET /projects/{id}/export?format=csv` | `StreamingResponse` (text/csv) |
| Excel | `GET /projects/{id}/export?format=xlsx` | `StreamingResponse` (.xlsx, auto-fit columns) |

**Export Columns:**

| Column | Source |
|---|---|
| `document` | `Document.filename` |
| `field_key` | `ExtractionRecord.field_key` |
| `ai_value` | `ExtractionRecord.value` |
| `normalized_value` | `ExtractionRecord.normalized_value` |
| `confidence` | `ExtractionRecord.confidence` |
| `review_status` | `ExtractionRecord.review_status` |
| `manual_value` | `ExtractionRecord.manual_value` |
| `citations` | Flattened string: `"p.1: excerpt | p.2: excerpt"` |

An empty-but-valid file is returned if no records exist yet.

---

### 1.8 Evaluation

| Action | UI Trigger | API Call | Outcome |
|---|---|---|---|
| Upload labels | "Upload Labels CSV" button | `POST /projects/{id}/evaluation/upload` | Replaces all existing labels for this project |
| View report | Page load or Refresh button | `GET /projects/{id}/evaluation/report` | Returns accuracy metrics + side-by-side table |

**CSV Format:**

```
document_filename,field_key,expected_value
contract_a.pdf,effective_date,2024-01-15
contract_a.pdf,governing_law,New York
contract_b.pdf,party_a,BridgeCo
```

**Evaluation Report Fields:**

| Metric | Definition |
|---|---|
| `overall_accuracy_pct` | % of labels where `ai_value` matches `expected_value` (case-insensitive strip) |
| `overall_coverage_pct` | % of labels with a non-null `ai_value` |
| `normalization_validity_pct` | % of labels where `normalized_value` matches `expected_value` |
| `per_field` | Per-field breakdown: `{ field_key, total, matched, accuracy_pct }` |
| `side_by_side` | Row-by-row: `{ document, field_key, expected_value, ai_value, normalized_value, match }` |

---

## 2. API Endpoint Reference

### Projects

| Method | Path | Body | Response | Description |
|---|---|---|---|---|
| POST | `/projects` | `{ "name": "str" }` | `ProjectResponse` | Create project |
| GET | `/projects` | — | `list[ProjectResponse]` | List all projects (desc) |
| GET | `/projects/{id}` | — | `ProjectResponse` | Get single project |
| DELETE | `/projects/{id}` | — | 204 | Delete + cascade |

### Documents

| Method | Path | Body | Response | Description |
|---|---|---|---|---|
| POST | `/projects/{id}/documents` | multipart file | `DocumentResponse` | Upload + parse |
| GET | `/projects/{id}/documents` | — | `list[DocumentResponse]` | List docs |
| GET | `/projects/{id}/documents/{d_id}` | — | `DocumentResponse` | Get single doc |
| DELETE | `/projects/{id}/documents/{d_id}` | — | 204 | Delete doc + file |

### Templates

| Method | Path | Body | Response | Description |
|---|---|---|---|---|
| POST | `/projects/{id}/template` | `{ "fields": [...] }` | `TemplateResponse` | Create or update template |
| GET | `/projects/{id}/template` | — | `TemplateResponse` | Get template |
| DELETE | `/projects/{id}/template` | — | 204 | Delete template |

### Extraction

| Method | Path | Body | Response | Description |
|---|---|---|---|---|
| POST | `/projects/{id}/extract/all` | — | `list[ExtractionRecordResponse]` | Extract all fields × all docs |
| POST | `/projects/{id}/extract/field` | `{ "document_id": int, "field_key": "str" }` | `ExtractionRecordResponse` | Extract one field |

### Review

| Method | Path | Body | Response | Description |
|---|---|---|---|---|
| POST | `/projects/{id}/records/{rid}/review` | `{ "status": "str", "manual_value"?: "str" }` | `ExtractionRecordResponse` | Update review status |
| GET | `/projects/{id}/records` | `?status=PENDING` (optional) | `list[ExtractionRecordResponse]` | List records |
| GET | `/projects/{id}/table` | — | `TableResponse` | Get review matrix |

### Export

| Method | Path | Body | Response | Description |
|---|---|---|---|---|
| GET | `/projects/{id}/export` | `?format=csv\|xlsx` | StreamingResponse | Download export |

### Evaluation

| Method | Path | Body | Response | Description |
|---|---|---|---|---|
| POST | `/projects/{id}/evaluation/upload` | multipart CSV | `{ "message": "str", "count": int }` | Upload labels |
| GET | `/projects/{id}/evaluation/report` | — | `EvaluationReport` | Get accuracy report |

---

## 3. Review Status Machine

All valid transitions are listed below. Status is stored in `ExtractionRecord.review_status`.

```
STALE ────────────────────────────────────────────────────────────┐
  ↑                                                               │
  │ (template version bumped)                                     │
  │                                                               ▼
  │                                             extract_single() / extract_all()
  │                                                               │
  │                                          ┌────────────────────┤
  │                                          ▼                    ▼
  │                                       PENDING           MISSING_DATA
  │                                          │              (null or conf < 0.3)
  │                                          │
  │                              ┌───────────┼───────────┐
  │                              ▼           ▼           ▼
  │                          CONFIRMED   REJECTED   MANUAL_UPDATED
  │                                                  (manual_value set)
  │
  └──────── (any of the above can be re-marked STALE by a template update)
```

**Allowed transitions via `POST /review`:**
- `PENDING` → `CONFIRMED`
- `PENDING` → `REJECTED`
- `PENDING` → `MANUAL_UPDATED` (requires `manual_value`)
- `MISSING_DATA` → `MANUAL_UPDATED` (requires `manual_value`)
- `CONFIRMED` → `REJECTED` (and vice versa, for corrections)
- Any → `MANUAL_UPDATED` (requires `manual_value`)

**Disallowed via review API:**
- Setting `STALE`, `MISSING_DATA`, or `PENDING` directly via `/review` (returns 400)

---

## 4. Template Versioning and Re-extraction Rules

1. The first `POST /projects/{id}/template` creates the template at version 1 with no side effects.
2. Every subsequent save increments `version` by 1.
3. On version increment, **all** `ExtractionRecord` rows across all documents in the project have `review_status` set to `STALE`.
4. The frontend shows a confirmation dialog before saving: *"Saving a new version will mark existing records as STALE."*
5. The user then clicks **Re-extract All** on the Review Table, which calls `POST /extract/all`.
6. `extract_single()` uses an **upsert** pattern: the existing record is overwritten with fresh AI output, preserving the record ID. The previous `manual_value` is also overwritten only on `MANUAL_UPDATED` review actions, not by re-extraction.

---

## 5. Edge Case Handling

| Scenario | Handling |
|---|---|
| Field not found in document | `value = null`, `confidence = 0.0`, `review_status = MISSING_DATA` |
| Gemini returns malformed JSON | Strip markdown fences, retry. After 3 failures → `MISSING_DATA` |
| Gemini rate limit / timeout | Exponential backoff (2s, 4s, 8s). `RuntimeError` raised if all retries fail |
| Document exceeds 28,000 characters | Text truncated to 28k chars; `[...document truncated...]` appended |
| Duplicate filename upload | `409 Conflict` — user must rename or delete the existing file first |
| Corrupt / password-protected file | `422 Unprocessable Entity` with parse error message |
| No template saved yet | `400 Bad Request` on `/extract/all` |
| No DONE documents | `400 Bad Request` on `/extract/all` |
| Evaluation CSV missing required columns | `422` with column names listed |
| Evaluation CSV uploaded for project with no extractions | Report returns 0% accuracy, 0% coverage |
| Export with no records | Returns empty-but-valid CSV/xlsx (header row only) |
| Template deleted while records exist | Records remain; next `/table` returns 404 (no template) |

---

## 6. Frontend Screen Descriptions

### 6.1 Home (`/`)
- Header: Scale icon + "Legal Contract Extractor" + "New Project" button
- Inline create form: name input + submit (slides in on button click)
- Project cards: name, created date, status badge, hover-reveal delete button
- Empty state: FolderOpen icon + "No projects yet" message

### 6.2 Document Upload (`/projects/[id]/docs`)
- Drag-and-drop zone with dashed border; changes to blue on hover/drag
- Hidden `<input type="file">` triggered by zone click
- Document list: FileText icon, filename, format, date, ParseStatus badge
- Spinner animation on documents with status = PARSING
- Hover-reveal delete per document

### 6.3 Field Template Editor (`/projects/[id]/template`)
- Field rows: key (snake_case auto-format), type dropdown, description, required checkbox
- Add Field button below list
- Save Template button (top right) with stale-warning confirm dialog if version > 0
- Version number shown in subtitle
- Duplicate key validation before save

### 6.4 Review Table (`/projects/[id]/table`)
- Toolbar: "Re-extract All" button + CSV download link + Excel download link
- Sticky header row (document filenames)
- Sticky first column (field keys)
- Cell: confidence dot (teal/amber/coral) + truncated value + status badge
- Click cell → slide-in side panel (288px wide):
  - AI Value, Normalised Value, Manual Override (if set)
  - Confidence %, Status badge
  - Citations list (page + excerpt)
  - Confirm / Reject / Edit Manually action buttons
  - Manual edit textarea + Save/Cancel
- Side panel patches table in-place (no full reload)

### 6.5 Evaluation Report (`/projects/[id]/eval`)
- Upload Labels CSV button (top right)
- CSV format hint box (monospace)
- Three metric cards: Overall Accuracy, Coverage, Normalisation (color-coded by threshold)
- Per-field accuracy table with color-coded percentages
- Side-by-side comparison table: expected vs AI vs normalized, match icon (✓/✗)
- Error rows highlighted in coral background
