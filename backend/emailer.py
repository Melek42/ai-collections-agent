import os
import re

import httpx


class EmailError(Exception):
    pass


def send_email(to: str, subject: str, body: str, idempotency_key: str, business_name: str = "Collections") -> dict:
    api_key = os.getenv("RESEND_API_KEY")
    if not api_key:
        raise EmailError("RESEND_API_KEY is missing from .env")

    sender = os.getenv("RESEND_FROM", "onboarding@resend.dev")
    name = re.sub(r'[<>",]', "", business_name or "Collections").strip() or "Collections"
    redirect = os.getenv("EMAIL_REDIRECT_TO")
    reply_to = os.getenv("OWNER_EMAIL") or redirect

    intended = to
    if redirect:  # demo safety: never email real clients while testing
        to = redirect
        body = f"[DEMO MODE: this email would have been sent to {intended}]\n\n{body}"

    payload = {"from": f"{name} <{sender}>", "to": [to], "subject": subject, "text": body}
    if reply_to:
        payload["reply_to"] = reply_to

    try:
        r = httpx.post(
            "https://api.resend.com/emails",
            json=payload,
            headers={"Authorization": f"Bearer {api_key}", "Idempotency-Key": idempotency_key},
            timeout=20,
        )
    except httpx.HTTPError as e:
        raise EmailError(f"Could not reach Resend: {e}")

    if r.status_code >= 400:
        try:
            msg = r.json().get("message", r.text)
        except Exception:
            msg = r.text
        raise EmailError(f"Resend {r.status_code}: {msg}")

    return {"provider_id": r.json().get("id"), "delivered_to": to, "intended_for": intended}