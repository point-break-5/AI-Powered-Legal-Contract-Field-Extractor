"""Gemini LLM client with retry logic."""

from __future__ import annotations

import json
import os
import time

from google import genai
from google.genai import types
from dotenv import load_dotenv

load_dotenv()

_API_KEY = os.getenv("GEMINI_API_KEY", "")
_MODEL_NAME = "gemini-2.0-flash"
_MAX_RETRIES = 3
_BACKOFF_BASE = 2  # seconds


def _get_client() -> genai.Client:
    return genai.Client(api_key=_API_KEY)


def extract_field(document_text: str, field_key: str, field_type: str, field_description: str) -> dict:
    """
    Ask Gemini to extract a single field from document text.

    Returns a dict:
        {
            "value": str | null,
            "raw_text": str | null,
            "citations": [{"page": str, "excerpt": str}],
            "confidence": float (0–1),
            "normalized_value": str | null
        }
    """
    MAX_CHARS = 28_000
    text_chunk = document_text[:MAX_CHARS]
    if len(document_text) > MAX_CHARS:
        text_chunk += "\n\n[...document truncated for context window...]"

    prompt = f"""You are a legal document analysis assistant. Extract the following field from the contract text below.

FIELD KEY: {field_key}
FIELD TYPE: {field_type}
FIELD DESCRIPTION: {field_description}

NORMALIZATION RULES:
- Dates → ISO 8601 format (YYYY-MM-DD)
- Monetary amounts → numeric value + currency code (e.g. "1500000.00 USD")
- Party/entity names → canonical name, strip suffixes like Inc., Ltd., Corp., punctuation
- Other text → return as-is, cleaned of extra whitespace

INSTRUCTIONS:
1. Find the most relevant passage in the document for this field.
2. Return ONLY a valid JSON object with these exact keys:
   - "value": the extracted value (string), or null if not found
   - "raw_text": the exact original text from the document where you found the value, or null
   - "citations": list of objects with "page" (section/page reference as string) and "excerpt" (short surrounding text)
   - "confidence": a float from 0.0 to 1.0 indicating your confidence in this extraction
   - "normalized_value": the value after applying normalization rules above, or null

Return ONLY the JSON object. No markdown, no explanation.

DOCUMENT TEXT:
{text_chunk}
"""

    last_error = None
    for attempt in range(_MAX_RETRIES):
        try:
            client = _get_client()
            response = client.models.generate_content(
                model=_MODEL_NAME,
                contents=prompt,
                config=types.GenerateContentConfig(
                    temperature=0.1,
                    response_mime_type="application/json",
                ),
            )
            raw = response.text.strip()

            # Strip markdown code fences if present
            if raw.startswith("```"):
                raw = raw.split("```")[1]
                if raw.startswith("json"):
                    raw = raw[4:]
                raw = raw.strip()

            result = json.loads(raw)

            return {
                "value": result.get("value"),
                "raw_text": result.get("raw_text"),
                "citations": result.get("citations") or [],
                "confidence": float(result.get("confidence") or 0.0),
                "normalized_value": result.get("normalized_value"),
            }

        except (json.JSONDecodeError, KeyError, ValueError) as e:
            last_error = e
            break  # Parsing errors won’t be fixed by retrying
        except Exception as e:
            last_error = e
            if attempt < _MAX_RETRIES - 1:
                time.sleep(_BACKOFF_BASE ** attempt)

    raise RuntimeError(f"LLM extraction failed after {_MAX_RETRIES} attempts: {last_error}")

    """
    Ask Gemini to extract a single field from document text.

    Returns a dict:
        {
            "value": str | null,
            "raw_text": str | null,
            "citations": [{"page": str, "excerpt": str}],
            "confidence": float (0–1),
            "normalized_value": str | null
        }
    """
    # Chunk text to stay well within context limits (~28k chars ≈ ~7k tokens safe margin)
    MAX_CHARS = 28_000
    text_chunk = document_text[:MAX_CHARS]
    if len(document_text) > MAX_CHARS:
        text_chunk += "\n\n[...document truncated for context window...]"

    prompt = f"""You are a legal document analysis assistant. Extract the following field from the contract text below.

FIELD KEY: {field_key}
FIELD TYPE: {field_type}
FIELD DESCRIPTION: {field_description}

NORMALIZATION RULES:
- Dates → ISO 8601 format (YYYY-MM-DD)
- Monetary amounts → numeric value + currency code (e.g. "1500000.00 USD")
- Party/entity names → canonical name, strip suffixes like Inc., Ltd., Corp., punctuation
- Other text → return as-is, cleaned of extra whitespace

INSTRUCTIONS:
1. Find the most relevant passage in the document for this field.
2. Return ONLY a valid JSON object with these exact keys:
   - "value": the extracted value (string), or null if not found
   - "raw_text": the exact original text from the document where you found the value, or null
   - "citations": list of objects with "page" (section/page reference as string) and "excerpt" (short surrounding text)
   - "confidence": a float from 0.0 to 1.0 indicating your confidence in this extraction
   - "normalized_value": the value after applying normalization rules above, or null

Return ONLY the JSON object. No markdown, no explanation.

DOCUMENT TEXT:
{text_chunk}
"""

    last_error = None
    for attempt in range(_MAX_RETRIES):
        try:
            model = _get_model()
            response = model.generate_content(prompt)
            raw = response.text.strip()

            # Strip markdown code fences if Gemini wraps in ```json ... ```
            if raw.startswith("```"):
                raw = raw.split("```")[1]
                if raw.startswith("json"):
                    raw = raw[4:]
                raw = raw.strip()

            result = json.loads(raw)

            # Ensure all expected keys exist
            return {
                "value": result.get("value"),
                "raw_text": result.get("raw_text"),
                "citations": result.get("citations") or [],
                "confidence": float(result.get("confidence") or 0.0),
                "normalized_value": result.get("normalized_value"),
            }

        except (json.JSONDecodeError, KeyError, ValueError) as e:
            last_error = e
            break  # Parsing errors won't be fixed by retrying
        except Exception as e:
            last_error = e
            if attempt < _MAX_RETRIES - 1:
                time.sleep(_BACKOFF_BASE ** attempt)

    raise RuntimeError(f"LLM extraction failed after {_MAX_RETRIES} attempts: {last_error}")
