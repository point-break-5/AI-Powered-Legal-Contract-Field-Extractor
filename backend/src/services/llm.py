"""LLM client with support for Gemini, Grok (xAI), and DeepSeek.

Auto-fallback: if the requested provider hits a quota/rate-limit (429),
the call is automatically retried with the next available provider in the
chain: gemini -> grok -> deepseek.
"""

from __future__ import annotations

import json
import os
import time

from dotenv import load_dotenv

_MAX_RETRIES = 3
_BACKOFF_BASE = 2  # seconds

SUPPORTED_PROVIDERS = ["gemini", "grok", "deepseek"]

_PROVIDER_LABELS = {
    "gemini": "Gemini 2.5 Flash",
    "grok": "Grok (xAI)",
    "deepseek": "DeepSeek Chat",
}


# ---------------------------------------------------------------------------
# Quota-error detection
# ---------------------------------------------------------------------------

def _is_quota_error(exc: Exception) -> bool:
    """Return True if the exception is a rate-limit / quota-exhausted error."""
    msg = str(exc).lower()
    return "429" in msg or "resource_exhausted" in msg or "rate limit" in msg or "quota" in msg


def _fallback_chain(preferred: str) -> list[str]:
    """Return providers starting from preferred, cycling through the rest."""
    idx = SUPPORTED_PROVIDERS.index(preferred) if preferred in SUPPORTED_PROVIDERS else 0
    return SUPPORTED_PROVIDERS[idx:] + SUPPORTED_PROVIDERS[:idx]


# ---------------------------------------------------------------------------
# Prompt builders
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


def _build_batch_prompt(document_text: str, fields: list[dict]) -> str:
    """Build a single prompt that extracts ALL fields at once."""
    MAX_CHARS = 28_000
    text_chunk = document_text[:MAX_CHARS]
    if len(document_text) > MAX_CHARS:
        text_chunk += "\n\n[...document truncated for context window...]"

    fields_spec = json.dumps(
        [{"key": f["key"], "type": f["type"], "description": f["description"]} for f in fields],
        indent=2,
    )

    return f"""You are a legal document analysis assistant. Extract ALL of the following fields from the contract text below in a SINGLE response.

FIELDS TO EXTRACT:
{fields_spec}

NORMALIZATION RULES:
- Dates -> ISO 8601 format (YYYY-MM-DD)
- Monetary amounts -> numeric value + currency code (e.g. "1500000.00 USD")
- Party/entity names -> canonical name, strip suffixes like Inc., Ltd., Corp., punctuation
- Other text -> return as-is, cleaned of extra whitespace

INSTRUCTIONS:
Return ONLY a valid JSON object where each key is a field key from the list above, and each value is an object with:
  - "value": the extracted value (string), or null if not found
  - "raw_text": the exact original text from the document, or null
  - "citations": list of objects with "page" (string) and "excerpt" (short surrounding text)
  - "confidence": float 0.0-1.0
  - "normalized_value": value after normalization rules, or null

Example shape:
{{"party_a": {{"value": "Acme", "raw_text": "...", "citations": [], "confidence": 0.95, "normalized_value": "Acme"}}, ...}}

Return ONLY the JSON object. No markdown, no explanation.

DOCUMENT TEXT:
{text_chunk}
"""


# ---------------------------------------------------------------------------
# Response parsers
# ---------------------------------------------------------------------------

def _strip_fences(raw: str) -> str:
    raw = raw.strip()
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
    return raw.strip()


def _parse_llm_response(raw: str) -> dict:
    result = json.loads(_strip_fences(raw))
    return {
        "value": result.get("value"),
        "raw_text": result.get("raw_text"),
        "citations": result.get("citations") or [],
        "confidence": float(result.get("confidence") or 0.0),
        "normalized_value": result.get("normalized_value"),
    }


def _parse_batch_response(raw: str, field_keys: list[str]) -> dict[str, dict]:
    data = json.loads(_strip_fences(raw))
    result = {}
    for key in field_keys:
        entry = data.get(key) or {}
        result[key] = {
            "value": entry.get("value"),
            "raw_text": entry.get("raw_text"),
            "citations": entry.get("citations") or [],
            "confidence": float(entry.get("confidence") or 0.0),
            "normalized_value": entry.get("normalized_value"),
        }
    return result


# ---------------------------------------------------------------------------
# Per-provider single-field callers
# ---------------------------------------------------------------------------

def _call_gemini(prompt: str, api_key: str) -> str:
    from google import genai
    from google.genai import types

    client = genai.Client(api_key=api_key)
    response = client.models.generate_content(
        model="gemini-2.5-flash",
        contents=prompt,
        config=types.GenerateContentConfig(
            temperature=0.1,
            response_mime_type="application/json",
        ),
    )
    return response.text


def _call_openai_compat(prompt: str, base_url: str, api_key: str, model: str) -> str:
    import openai

    client = openai.OpenAI(api_key=api_key, base_url=base_url)
    response = client.chat.completions.create(
        model=model,
        messages=[{"role": "user", "content": prompt}],
        temperature=0.1,
        response_format={"type": "json_object"},
    )
    return response.choices[0].message.content or ""


def _call_provider(provider: str, prompt: str) -> str:
    """Call a specific provider and return the raw text response."""
    # Reload .env on every call so key changes take effect without a restart
    load_dotenv(override=True)
    gemini_key = os.getenv("GEMINI_API_KEY", "")
    grok_key = os.getenv("GROK_API_KEY", "")
    deepseek_key = os.getenv("DEEPSEEK_API_KEY", "")

    if provider == "gemini":
        if not gemini_key:
            raise RuntimeError("GEMINI_API_KEY is not set")
        return _call_gemini(prompt, gemini_key)
    if provider == "grok":
        if not grok_key:
            raise RuntimeError("GROK_API_KEY is not set")
        return _call_openai_compat(prompt, "https://api.x.ai/v1", grok_key, "grok-beta")
    if provider == "deepseek":
        if not deepseek_key:
            raise RuntimeError("DEEPSEEK_API_KEY is not set")
        return _call_openai_compat(prompt, "https://api.deepseek.com/v1", deepseek_key, "deepseek-chat")
    raise ValueError(f"Unknown provider: {provider}")


# ---------------------------------------------------------------------------
# Core runner with retry + quota-aware fallback
# ---------------------------------------------------------------------------

def _run_with_fallback(prompt: str, preferred: str) -> tuple[str, str]:
    """
    Try preferred provider first, fall back on quota errors.
    Returns (raw_text, provider_used).
    """
    chain = _fallback_chain(preferred)
    last_errors: list[str] = []

    for provider in chain:
        last_error = None
        for attempt in range(_MAX_RETRIES):
            try:
                raw = _call_provider(provider, prompt)
                if provider != preferred:
                    import logging
                    logging.getLogger(__name__).warning(
                        "Provider '%s' quota exhausted, fell back to '%s'", preferred, provider
                    )
                return raw, provider
            except (json.JSONDecodeError, KeyError, ValueError) as e:
                # Parse errors — no point retrying this provider or any other
                raise
            except Exception as e:
                last_error = e
                if _is_quota_error(e):
                    break  # quota exhausted — skip retries, try next provider
                if attempt < _MAX_RETRIES - 1:
                    time.sleep(_BACKOFF_BASE ** attempt)

        last_errors.append(f"{provider}: {last_error}")

    raise RuntimeError("All providers failed:\n" + "\n".join(last_errors))


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
    Extract a single field using the specified provider (with auto-fallback on quota errors).

    provider: "gemini" | "grok" | "deepseek"
    """
    if provider not in SUPPORTED_PROVIDERS:
        raise ValueError(f"Unsupported provider '{provider}'. Choose from: {SUPPORTED_PROVIDERS}")

    prompt = _build_prompt(document_text, field_key, field_type, field_description)
    raw, _ = _run_with_fallback(prompt, provider)
    return _parse_llm_response(raw)


def extract_fields_batch(
    document_text: str,
    fields: list[dict],
    provider: str = "gemini",
) -> dict[str, dict]:
    """
    Extract ALL fields from a document in a single LLM call (with auto-fallback on quota errors).

    fields: list of {"key": str, "type": str, "description": str}
    """
    if provider not in SUPPORTED_PROVIDERS:
        raise ValueError(f"Unsupported provider '{provider}'. Choose from: {SUPPORTED_PROVIDERS}")

    field_keys = [f["key"] for f in fields]
    prompt = _build_batch_prompt(document_text, fields)
    raw, _ = _run_with_fallback(prompt, provider)
    return _parse_batch_response(raw, field_keys)
