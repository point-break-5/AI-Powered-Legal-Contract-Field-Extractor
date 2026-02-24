# ── Stage 1: dependencies & runtime ──────────────────────────────────────────
FROM python:3.11-slim AS base

# System packages:
#   tesseract-ocr + eng pack  → pytesseract OCR for image-only PDF pages
#   libgl1 + libglib2.0-0     → runtime libs required by PyMuPDF
#   curl                      → used by Docker health check
RUN apt-get update && apt-get install -y --no-install-recommends \
        tesseract-ocr \
        tesseract-ocr-eng \
        libgl1 \
        libglib2.0-0 \
        curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python deps first — takes advantage of layer caching
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application source
COPY . .

# Create directories that will be bind-mounted as named volumes
RUN mkdir -p uploads data

# Run as a non-root user for security
RUN addgroup --system appgroup && adduser --system --ingroup appgroup appuser
RUN chown -R appuser:appgroup /app
USER appuser

EXPOSE 8000

# Use 2 workers so the app stays responsive during long LLM calls.
# $WEB_CONCURRENCY can override this at runtime.
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port 8000 --workers ${WEB_CONCURRENCY:-2}"]
