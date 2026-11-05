import json
import os
import time

from google import genai
from google.genai import errors, types

_client = None

# Temporary problems worth retrying: rate limit, server error, overloaded
RETRYABLE = {429, 500, 503, 504}


def get_client():
    global _client
    if _client is None:
        _client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))
    return _client


def _generate(prompt: str, config=None, model: str | None = None, retries: int = 3):
    primary = model or os.getenv("GEMINI_MODEL", "gemini-3.8-flash")
    fallback = os.getenv("GEMINI_FALLBACK_MODEL", "gemini-3.5-flash-lite")
    models = [primary] if primary == fallback else [primary, fallback]

    last_error = "unknown error"
    for m in models:
        for attempt in range(retries):
            try:
                response = get_client().models.generate_content(
                    model=m, contents=prompt, config=config
                )
                return response, m
            except errors.APIError as e:
                last_error = f"{m}: {e.code} {e.message}"
                if e.code in RETRYABLE:
                    time.sleep(2**attempt)  # wait 1s, 2s, 4s
                    continue
                break  # not temporary: try the next model
    raise RuntimeError(f"All Gemini attempts failed. Last error: {last_error}")


def generate_text(prompt: str, model: str | None = None, retries: int = 3) -> dict:
    response, m = _generate(prompt, None, model, retries)
    return {"text": response.text, "model": m}


def generate_json(prompt: str, schema, model: str | None = None, retries: int = 3):
    """Ask Gemini for JSON that matches a pydantic schema. Returns (data, model_used)."""
    config = types.GenerateContentConfig(
        response_mime_type="application/json",
        response_schema=schema,
        temperature=0.4,
    )
    response, m = _generate(prompt, config, model, retries)
    return json.loads(response.text), m