import re
from decimal import Decimal

from pydantic import BaseModel

from ai import generate_json
from stages import STAGES

BANNED = re.compile(
    r"\b(lawsuit|sue|sued|legal action|lawyer|attorney|court|police|arrest|blacklist)\b", re.I
)
PLACEHOLDER = re.compile(r"\[[^\]]{1,40}\]|\{\{|\}\}")


class DraftOut(BaseModel):
    subject: str
    body: str
    reason: str


class DraftError(Exception):
    def __init__(self, errors):
        super().__init__("; ".join(errors))
        self.errors = errors


def build_facts(inv: dict) -> dict:
    amount = Decimal(inv["amount"])
    num = f"{amount:,.0f}" if amount == amount.to_integral() else f"{amount:,.2f}"
    due = inv["due_date"]
    return {
        "invoice_number": inv["number"],
        "amount_text": f"{inv['currency']} {num}",
        "due_date_text": f"{due.strftime('%B')} {due.day}, {due.year}",
    }


def validate_draft(subject: str, body: str, facts: dict) -> list[str]:
    errors = []
    if not subject.strip() or not body.strip():
        errors.append("subject and body must not be empty")
    for key, label in [
        ("invoice_number", "invoice number"),
        ("amount_text", "amount"),
        ("due_date_text", "due date"),
    ]:
        if facts[key] not in body:
            errors.append(f"the {label} '{facts[key]}' must appear exactly in the body")
    if PLACEHOLDER.search(subject + body):
        errors.append("remove all placeholders like [Name]")
    if BANNED.search(subject + body):
        errors.append("remove any threat or mention of legal action, lawyers, courts or police")
    if len(body) > 1800:
        errors.append("body is too long (max 1800 characters)")
    return errors


def timing_text(days_overdue: int) -> str:
    if days_overdue < 0:
        return f"due in {-days_overdue} days"
    if days_overdue == 0:
        return "due today"
    return f"{days_overdue} days overdue"


def build_prompt(inv, client, business_name, tone_notes, stage, history, facts) -> str:
    name, _tone, instruction = STAGES[stage]
    return f"""You are the accounts receivable assistant for {business_name}. Write ONE email to a client about an unpaid invoice.

Business tone notes: {tone_notes or 'Warm, professional and concise.'}
Client: {client['name']}
Notes about this client: {client.get('notes') or 'none'}
Payment history: {history}

FACTS (use these exact strings, character for character):
- Invoice number: {facts['invoice_number']}
- Amount: {facts['amount_text']}
- Due date: {facts['due_date_text']}
- Timing: {timing_text(inv['days_overdue'])}

Stage: {name}
Tone: {instruction}

Rules:
- Plain text only, 80 to 140 words, greet the client by name, sign off as {business_name}.
- Include all three FACTS exactly as written above.
- Never threaten legal action and never mention lawyers, courts or credit damage.
- No placeholders in brackets; every detail you need is above.
- Tell them they can simply reply to this email with a payment date or any questions.

Return JSON with: subject, body, and reason (one sentence for the business owner explaining why you chose this tone for this client)."""


def create_draft(inv, client, business_name, tone_notes, stage, history) -> dict:
    facts = build_facts(inv)
    prompt = build_prompt(inv, client, business_name, tone_notes, stage, history, facts)
    problems: list[str] = []
    for _ in range(3):
        full = prompt
        if problems:
            full += "\n\nYour previous draft was rejected. Fix these problems:\n- " + "\n- ".join(problems)
        try:
            data, model = generate_json(full, DraftOut)
        except RuntimeError as e:  # every model failed; retrying will not help
            raise DraftError([str(e)])
        except (ValueError, KeyError) as e:  # bad JSON from the model: try again
            problems = [f"invalid JSON ({e})"]
            continue
        problems = validate_draft(data["subject"], data["body"], facts)
        if not problems:
            return {**data, "model": model}
    raise DraftError(problems)