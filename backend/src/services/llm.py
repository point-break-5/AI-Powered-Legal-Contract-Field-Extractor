"""LLM client with support for Gemini, Grok (xAI), and DeepSeek."""

from __future__ import annotations

import json
import os
import time

from dotenv import load_dotenv

load_dotenv()

_GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
_GROK_API_KEY = os.getenv("GROK_API_KEY", "")
_DEEPSEEK_API_KEY = os.getenv("DEEPSEEK_API_KEY", "")

_MAX_RETRIES = 3
_BACKOFF_BASE = 2  # seconds

SUPPORTED_PROVIDERS = ["gemini", "grok", "deepseek"]

_PROVIDER_LABELS = {
    "gemini": "Gemini 2.5 Flash",
    "grok": "Grok (xAI)",
    "deepseek": "DeepSeek Chat",
}


# ---------------------------------------------------------------------------
# Shared prompt builder
# ---------------------------------------------------------------------------

def _build_prompt(
    document_text: str,
    field_key: str,
    field_type: str,
    field_description: str,
) -> str:
    MAX_CHARS = 28_000
    text_chunk = document_text[:MAX_CHARS]
    if len(document_text) > MAX_CHARS:
        text_chunk += "\n\n[...document truncated for context window...]"

    return f"""You are a legal document analysis assistant. Extract the following field from the contract text below.

FIELD KEY: {field_key}
FIELD TYPE: {field_type}
FIELD DESCRIPTION: {field_description}

NORMALIZATION RULES:
- Dates -> ISO 8601 format (YYYY-MM-DD)
- Monetary amounts -> numeric value + currency code (e.g. "1500000.00 USD")
- Party/entity names -> canonical name, strip suffixes like Inc., Ltd., Corp., punctuation
- Other text -> return as-is, cleaned of extra whitespace

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


# ---------------------------------------------------------------------------
# Shared response parser
# ---------------------------------------------------------------------------

def _parse_llm_response(raw: str) -> dict:
    raw = raw.strip()
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


# ---------------------------------------------------------------------------
# Provider implementations
# ---------------------------------------------------------------------------

def _extract_gemini(prompt: str) -> dict:
    from google import genai
    from google.genai import types

    last_error = None
    for attempt in range(_MAX_RETRIES):
        try:
            client = genai.Client(api_key=_GEMINI_API_KEY)
            response = client.models.generate_content(
                model="gemini-2.5-flash",
                contents=prompt,
                config=types.GenerateContentConfig(
                    temperature=0.1,
                    response_mime_type="application/json",
                ),
            )
            return _parse_llm_response(response.text)
        except (json.JSONDecodeError, KeyError, ValueError) as e:
            last_error = e
            break  # Parsing errors won't be fixed by retrying
        except Exception as e:
            last_error = e
            if attempt < _MAX_RETRIES - 1:
                time.sleep(_BACKOFF_BASE ** attempt)

    raise RuntimeError(f"LLM extraction failed after {_MAX_RETRIES} attempts: {last_error}")


def _extract_openai_compat(prompt: str, base_url: str, api_key: str, model: str) -> dict:
    """Shared handler for OpenAI-compatible APIs (Grok, DeepSeek)."""
    import openai

    last_error = None
    for attempt in range(_MAX_RETRIES):
        try:
            client = openai.OpenAI(api_key=api_key, base_url=base_url)
            response = client.chat.completions.create(
                model=model,
                messages=[{"role": "user", "content": prompt}],
                temperature=0.1,
                response_format={"type": "json_object"},
            )
            raw = response.choices[0].message.content or ""
            return _parse_llm_response(raw)
        except (json.JSONDecodeError, KeyError, ValueError) as e:
            last_error = e
            break  # Parsing errors won't be fixed by retrying
        except Exception as e:
            last_error = e
            if attempt < _MAX_RETRIES - 1:
                time.sleep(_BACKOFF_BASE ** attempt)

    raise RuntimeError(f"LLM extraction failed after {_MAX_RETRIES} attempts: {last_error}")


# ---------------------------------------------------------------------------
# Public interface
# ---------------------------------------------------------------------------

def extract_field(
    document_text: str,
    field_key: str,
    field_type: str,
    field_description: str,
    provider: str = "gemini",
) -> dict:
    """
    Extract a single field from document text using the specified LLM provider.

    provider: "gemini" | "grok" | "deepseek"

    Returns:
        {
            "value": str | null,
            "raw_text": str | null,
            "citations": [{"page": str, "excerpt": str}],
            "confidence": float (0-1),
            "normalized_value": str | null
        }
    """
    if provider not in SUPPORTED_PROVIDERS:
        raise ValueError(
            f"Unsupported provider '{provider}'. Choose from: {SUPPORTED_PROVIDERS}"
        )

    prompt = _build_prompt(document_text, field_key, field_type, field_description)

    if provider == "gemini":
        if not _GEMINI_API_KEY:
            raise RuntimeError("GEMINI_API_KEY is not set in environment")
        return _extract_gemini(prompt)

    if provider == "grok":
        if not _GROK_API_KEY:
            raise RuntimeError("GROK_API_KEY is not set in environment")
        return _extract_openai_compat(
            prompt,
            base_url="https://api.x.ai/v1",
            api_key=_GROK_API_KEY,
            model="grok-beta",
        )

    if provider == "deepseek":
        if not _DEEPSEEK_API_KEY:
            raise RuntimeError("DEEPSEEK_API_KEY is not set in environment")
        return _extract_openai_compat(
            prompt,
            base_url="https://api.deepseek.com/v1",
            api_key=_DEEPSEEK_API_KEY,
            model="deepseek-chat",
        )
