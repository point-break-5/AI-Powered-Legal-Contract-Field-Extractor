# Testing & Evaluation

## 1. Extraction Accuracy Methodology

### 1.1 What Is Measured

Extraction accuracy is evaluated by comparing the AI-extracted value against a human-labeled ground truth for the same (document, field) pair.

**Three metrics are reported:**

| Metric | Formula | Threshold |
|---|---|---|
| **Overall Accuracy** | `matched / total_labels × 100` | Good ≥ 70% |
| **Coverage** | `non-null ai_values / total_labels × 100` | Good ≥ 80% |
| **Normalization Validity** | `norm_matched / total_labels × 100` | Good ≥ 70% |

- **matched** — labels where `ai_value` matches `expected_value` (case-insensitive, stripped)
- **norm_matched** — labels where `normalized_value` matches `expected_value`
- **total_labels** — count of rows in the uploaded human-label CSV

### 1.2 Per-field Accuracy

Each field is broken out individually:

```
field_key        | matched | total | accuracy_pct
-----------------+---------+-------+-------------
party_a          |   4     |   5   |   80.0%
effective_date   |   5     |   5   |  100.0%
governing_law    |   3     |   5   |   60.0%
```

### 1.3 Side-by-Side Comparison

The evaluation report includes a full row-by-row comparison:

```
document         | field_key      | expected        | ai_value        | normalized     | match
-----------------+----------------+-----------------+-----------------+----------------+------
contract_a.pdf   | effective_date | 2024-01-15      | January 15 2024 | 2024-01-15     |  ✓
contract_b.pdf   | governing_law  | New York        | New York State  | New York State |  ✗
```

---

## 2. Field Coverage Definition

**Coverage** measures whether the AI successfully extracted a non-null value for a given label, regardless of whether it is correct.

- A field with `value = null` or `review_status = MISSING_DATA` counts as **not covered**.
- Coverage < 80% typically indicates either:
  - The field key description is too vague → update the template description
  - The documents genuinely do not contain that field
  - The document text was truncated (> 28,000 characters)

---

## 3. Normalization Validity Checks

The LLM is instructed to normalize values according to these rules (baked into the system prompt):

| Field Type | Normalization Rule | Expected Output |
|---|---|---|
| `date` | ISO 8601 (YYYY-MM-DD) | `2024-01-15` |
| `amount` | Float + currency code | `1500000.00 USD` |
| `entity` | Canonical name, strip suffixes | `Tesla` |
| `text` | Cleaned whitespace | `Force Majeure clause applies` |

**Normalization validity** checks that `normalized_value` matches the `expected_value` in the ground truth CSV. This is independent of raw `value` — it measures whether the normalization step itself is working correctly.

---

## 4. How to Run the Smoke Test

The smoke test exercises the full extraction pipeline against the 6 sample documents in `data/`, using 5 common legal fields. It does **not** persist data (rolls back the DB at the end).

### Prerequisites

```bash
# Activate the venv
source .venv/bin/activate         # Windows: .venv\Scripts\activate

# Ensure GEMINI_API_KEY is set
cat backend/.env                  # should contain GEMINI_API_KEY=...
```

### Run

```bash
cd backend
python smoke_test.py
```

### Expected Output

```
========================================================================
  SMOKE TEST — AI Legal Field Extractor
========================================================================

Parsing 6 document(s) from data/ ...
  ✓ Supply Agreement.pdf          (pdf,  text length: 18432)
  ✓ EX-10.2.html                  (html, text length: 41209)
  ✓ tsla-ex102_486.htm.pdf        (pdf,  text length: 6341)
  ✓ tsla-ex103_198.htm.pdf        (pdf,  text length: 5892)
  ✓ tsla-ex103_462.htm.pdf        (pdf,  text length: 7104)
  ✓ Tesla, Inc. (...).html        (html, text length: 93847)

Running extraction (5 fields × 6 documents = 30 calls) ...

========================================================================
  RESULTS
========================================================================

field_key       | doc                          | value                    | norm                  | conf | status
----------------+------------------------------+--------------------------+-----------------------+------+-------
party_a         | Supply Agreement.pdf         | Acme Corp                | Acme                  | 0.95 | PENDING
effective_date  | Supply Agreement.pdf         | January 1, 2024          | 2024-01-01            | 0.93 | PENDING
governing_law   | Supply Agreement.pdf         | New York                 | New York              | 0.91 | PENDING
contract_value  | Supply Agreement.pdf         | —                        | —                     | —    | MISSING_DATA
...

========================================================================
  SUMMARY
========================================================================
  Documents:  6
  Fields:     5
  Records:    30
  Coverage:   86.7%  (26/30 non-null)
  Avg conf:   0.82

  Rolling back test data...  ✓
```

---

## 5. Manual End-to-End QA Checklist

Use this checklist after starting the backend and frontend (see README.md quick-start).

### 5.1 Upload Workflow

- [ ] Create a new project with a unique name
- [ ] Upload a PDF document — verify `ParseStatus = DONE`
- [ ] Upload a DOCX document — verify `ParseStatus = DONE`
- [ ] Upload an HTML document — verify `ParseStatus = DONE`
- [ ] Attempt to upload a duplicate filename — expect `409 Conflict` message
- [ ] Attempt to upload an unsupported format (e.g. `.zip`) — expect `400` error message

### 5.2 Template Configuration

- [ ] Open Template page — verify empty state (no existing template)
- [ ] Add 3 fields: `effective_date (date)`, `party_a (entity)`, `governing_law (text)`
- [ ] Save — verify no stale warning appears (version 1)
- [ ] Add a 4th field `contract_value (amount)` — save again
- [ ] Verify stale confirmation dialog appears
- [ ] Confirm save — verify version increments to 2

### 5.3 Extraction

- [ ] Go to Review Table — click "Re-extract All"
- [ ] Wait for extraction to complete (button re-enables)
- [ ] Verify table shows cells for all (field, document) pairs
- [ ] Verify at least one cell has a confidence dot (teal/amber/coral)
- [ ] Click a cell — verify side panel opens with AI Value, Normalized Value, Citations, Confidence %

### 5.4 Review Actions

- [ ] Click a PENDING cell → Confirm → verify badge turns "CONFIRMED"
- [ ] Click a PENDING cell → Reject → verify badge turns "REJECTED"
- [ ] Click a PENDING cell → Edit Manually → type a value → Save → verify badge turns "MANUAL_UPDATED"
- [ ] Re-open the manually edited cell → verify `Manual Override` field shows the typed value
- [ ] Verify AI Value is unchanged after manual edit

### 5.5 Review Status Transitions

- [ ] Confirm, then Reject the same cell — both transitions should succeed
- [ ] Set MANUAL_UPDATED → confirm `manual_value` is visible in side panel
- [ ] Update template (add new field) → verify all records show STALE badge
- [ ] Re-extract All → verify STALE records are refreshed to PENDING

### 5.6 Export

- [ ] Click "Export CSV" — file should download and open in a spreadsheet app
- [ ] Verify columns: document, field_key, ai_value, normalized_value, confidence, review_status, manual_value, citations
- [ ] Click "Export Excel" — `.xlsx` file should download and open correctly
- [ ] Verify auto-fitted column widths in Excel

### 5.7 Evaluation

- [ ] Prepare a labels CSV with known correct values for at least 2 documents × 3 fields
- [ ] Upload the CSV on the Evaluate page
- [ ] Verify Overall Accuracy, Coverage, Normalization % cards appear
- [ ] Verify Per-field table shows accuracy per field
- [ ] Verify Side-by-side table shows expected vs AI with ✓/✗ match icons
- [ ] Mismatched rows should have a coral/red background

### 5.8 Edge Cases

- [ ] Navigate directly to `/projects/{id}` — should redirect to `/projects/{id}/docs`
- [ ] Access a project that does not exist — expect 404 from API, graceful error in UI
- [ ] Go to Review Table with no template saved → API returns 404, UI shows appropriate message
- [ ] Go to Review Table before any extraction → cells show `—` (null)

---

## 6. Evaluation Against Sample Data

### 6.1 Preparing Ground-Truth Labels

1. Open `data/Supply Agreement.pdf` and manually read the following fields:
   - `party_a`: first named party
   - `party_b`: second named party
   - `effective_date`: the date the agreement takes effect
   - `governing_law`: jurisdiction
   - `contract_value`: total value if stated

2. Create a CSV file (`labels.csv`):

```csv
document_filename,field_key,expected_value
Supply Agreement.pdf,party_a,<your answer>
Supply Agreement.pdf,effective_date,<YYYY-MM-DD>
Supply Agreement.pdf,governing_law,<state or jurisdiction>
```

3. Upload `labels.csv` via the Evaluate page of the project.

4. Check the accuracy report — compare AI extractions against your ground truth.

### 6.2 Interpreting Results

| Score | Interpretation |
|---|---|
| Accuracy ≥ 70% | Extraction is reliable for this field |
| Accuracy 40–70% | Field description may need to be more specific |
| Accuracy < 40% | Field may not be present in these documents, or prompt needs refinement |
| Coverage < 80% | Gemini cannot locate the field — try a more descriptive field description |
| Norm. Validity < Accuracy | Normalization rule is applying incorrectly — check field type |

---

## 7. Known Limitations

| Limitation | Description |
|---|---|
| 28k character truncation | Documents longer than ~28,000 characters are truncated before being sent to Gemini. For very long contracts, late-page clauses may be missed. |
| Scanned PDFs | PyMuPDF cannot extract text from image-only (scanned) PDFs. Parse status will be DONE but `parsed_text` will be empty or near-empty, resulting in MISSING_DATA for all fields. |
| Multi-page citation accuracy | Page references in citations are best-effort; Gemini may not always identify the exact page number. |
| Currency detection | Amounts without explicit currency symbols may be normalized without a currency code. |
| Rate limiting | Gemini API free tier has low RPM limits. Extracting many (documents × fields) pairs may hit rate limits; the 3× retry with backoff mitigates this but does not eliminate it. |
