import os
import time

from google import genai
from google.genai import errors

_client = None

# Temporary problems worth retrying: rate limit, server error, overloaded
RETRYABLE = {429, 500, 503, 504}


def get_client():
    global _client
    if _client is None:
        _client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))
    return _client


def generate_text(prompt: str, model: str | None = None, retries: int = 3) -> dict:
    """Ask Gemini. Retries on temporary errors, then falls back to a second model."""
    primary = model or os.getenv("GEMINI_MODEL", "gemini-3.8-flash")
    fallback = os.getenv("GEMINI_FALLBACK_MODEL", "gemini-3.5-flash-lite")
    models = [primary] if primary == fallback else [primary, fallback]

    last_error = "unknown error"
    for m in models:
        for attempt in range(retries):
            try:
                response = get_client().models.generate_content(model=m, contents=prompt)
                return {"text": response.text, "model": m}
            except errors.APIError as e:
                last_error = f"{m}: {e.code} {e.message}"
                if e.code in RETRYABLE:
                    time.sleep(2 ** attempt)  # wait 1s, 2s, 4s
                    continue
                break  # not temporary (for example wrong model name): try the next model

    raise RuntimeError(f"All Gemini attempts failed. Last error: {last_error}")