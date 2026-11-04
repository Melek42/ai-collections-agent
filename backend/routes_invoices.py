import csv
import io
from datetime import date
from decimal import Decimal, InvalidOperation
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, UploadFile
from psycopg.errors import UniqueViolation
from psycopg.types.json import Jsonb
from pydantic import BaseModel, Field

from auth import current_owner
from db import query

router = APIRouter()

ALLOWED_STATUS = {
    "upcoming", "overdue", "promised", "payment_pending",
    "paid", "disputed", "plan_active", "escalated",
}

# An unpaid invoice is 'overdue' or 'upcoming' depending on today's date.
EFFECTIVE_STATUS = """
  case when i.status in ('upcoming','overdue')
       then case when i.due_date < current_date then 'overdue' else 'upcoming' end
       else i.status end
"""

INVOICE_SELECT = f"""
  select i.id, i.number, i.amount, i.currency, i.issue_date, i.due_date,
         i.stage, i.promised_date, i.last_contacted_at, i.paid_at,
         i.client_id, c.name as client_name, c.email as client_email,
         {EFFECTIVE_STATUS} as status,
         (current_date - i.due_date) as days_overdue
  from invoices i
  join clients c on c.id = i.client_id
"""


# ---------- helpers ----------
def bucket(days_overdue: int, status: str) -> str:
    if status == "paid":
        return "paid"
    if days_overdue <= 0:
        return "current"
    if days_overdue <= 30:
        return "1-30"
    if days_overdue <= 60:
        return "31-60"
    if days_overdue <= 90:
        return "61-90"
    return "90+"


def log_event(owner_id, invoice_id, type_, detail=None, actor="owner"):
    query(
        "insert into events (owner_id, invoice_id, type, detail, actor) values (%s,%s,%s,%s,%s)",
        (owner_id, invoice_id, type_, Jsonb(detail or {}), actor),
    )


# ---------- request models ----------
class ClientIn(BaseModel):
    name: str = Field(min_length=1)
    email: str = Field(pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
    currency: str = "USD"
    notes: str | None = None


class InvoiceIn(BaseModel):
    client_id: UUID
    number: str = Field(min_length=1)
    amount: Decimal = Field(gt=0)
    currency: str = "USD"
    issue_date: date
    due_date: date


class InvoiceUpdate(BaseModel):
    due_date: date | None = None
    amount: Decimal | None = Field(default=None, gt=0)
    status: str | None = None


# ---------- clients ----------
@router.get("/clients")
def list_clients(owner: str = Depends(current_owner)):
    return query("select * from clients where owner_id = %s order by name", (owner,))


@router.post("/clients", status_code=201)
def create_client(body: ClientIn, owner: str = Depends(current_owner)):
    rows = query(
        "insert into clients (owner_id, name, email, currency, notes) "
        "values (%s,%s,%s,%s,%s) returning *",
        (owner, body.name, body.email, body.currency, body.notes),
    )
    return rows[0]


# ---------- invoices ----------
@router.get("/invoices")
def list_invoices(
    status: str | None = None,
    client_id: UUID | None = None,
    owner: str = Depends(current_owner),
):
    sql = INVOICE_SELECT + " where i.owner_id = %s"
    params: list = [owner]
    if client_id:
        sql += " and i.client_id = %s"
        params.append(client_id)
    sql += " order by i.due_date asc"
    rows = query(sql, params)
    for r in rows:
        r["aging_bucket"] = bucket(r["days_overdue"], r["status"])
    if status:
        rows = [r for r in rows if r["status"] == status]
    return rows


@router.post("/invoices", status_code=201)
def create_invoice(body: InvoiceIn, owner: str = Depends(current_owner)):
    if body.due_date < body.issue_date:
        raise HTTPException(422, "due_date cannot be before issue_date")
    if not query("select 1 from clients where id = %s and owner_id = %s", (body.client_id, owner)):
        raise HTTPException(404, "Client not found")
    try:
        rows = query(
            "insert into invoices (owner_id, client_id, number, amount, currency, issue_date, due_date) "
            "values (%s,%s,%s,%s,%s,%s,%s) returning id",
            (owner, body.client_id, body.number, body.amount, body.currency, body.issue_date, body.due_date),
        )
    except UniqueViolation:
        raise HTTPException(409, f"Invoice number {body.number} already exists")
    log_event(owner, rows[0]["id"], "invoice_created", {"number": body.number})
    return rows[0]


@router.patch("/invoices/{invoice_id}")
def update_invoice(invoice_id: UUID, body: InvoiceUpdate, owner: str = Depends(current_owner)):
    changes = body.model_dump(exclude_none=True)
    if not changes:
        raise HTTPException(422, "Nothing to update")
    if "status" in changes and changes["status"] not in ALLOWED_STATUS:
        raise HTTPException(422, "Invalid status")
    # Column names come from our own model, never from user input.
    sets = ", ".join(f"{col} = %s" for col in changes)
    rows = query(
        f"update invoices set {sets} where id = %s and owner_id = %s returning id",
        [*changes.values(), invoice_id, owner],
    )
    if not rows:
        raise HTTPException(404, "Invoice not found")
    log_event(owner, invoice_id, "invoice_updated", {k: str(v) for k, v in changes.items()})
    return {"ok": True}


@router.post("/invoices/{invoice_id}/mark-paid")
def mark_paid(invoice_id: UUID, owner: str = Depends(current_owner)):
    rows = query(
        "update invoices set status = 'paid', paid_at = now() "
        "where id = %s and owner_id = %s and status <> 'paid' returning id",
        (invoice_id, owner),
    )
    if not rows:
        raise HTTPException(404, "Invoice not found or already paid")
    log_event(owner, invoice_id, "marked_paid", {}, actor="owner")
    return {"ok": True}


# ---------- CSV import ----------
REQUIRED_COLUMNS = ["client_name", "client_email", "invoice_number", "amount", "issue_date", "due_date"]


@router.post("/invoices/import")
def import_invoices(file: UploadFile, owner: str = Depends(current_owner)):
    text = file.file.read().decode("utf-8-sig")
    reader = csv.DictReader(io.StringIO(text))
    missing = [c for c in REQUIRED_COLUMNS if c not in (reader.fieldnames or [])]
    if missing:
        raise HTTPException(422, f"Missing columns: {', '.join(missing)}")

    created, errors = 0, []
    for line, row in enumerate(reader, start=2):
        try:
            email = row["client_email"].strip().lower()
            currency = (row.get("currency") or "USD").strip().upper()
            amount = Decimal(row["amount"].strip())
            issue = date.fromisoformat(row["issue_date"].strip())
            due = date.fromisoformat(row["due_date"].strip())
            if amount <= 0 or due < issue:
                raise ValueError("amount must be positive and due_date not before issue_date")

            found = query(
                "select id from clients where owner_id = %s and lower(email) = %s", (owner, email)
            )
            if found:
                client_id = found[0]["id"]
            else:
                client_id = query(
                    "insert into clients (owner_id, name, email, currency) values (%s,%s,%s,%s) returning id",
                    (owner, row["client_name"].strip(), email, currency),
                )[0]["id"]

            inv = query(
                "insert into invoices (owner_id, client_id, number, amount, currency, issue_date, due_date) "
                "values (%s,%s,%s,%s,%s,%s,%s) returning id",
                (owner, client_id, row["invoice_number"].strip(), amount, currency, issue, due),
            )
            log_event(owner, inv[0]["id"], "invoice_imported", {"line": line})
            created += 1
        except UniqueViolation:
            errors.append({"line": line, "error": "invoice number already exists"})
        except (ValueError, InvalidOperation, KeyError) as e:
            errors.append({"line": line, "error": str(e)})
    return {"created": created, "failed": len(errors), "errors": errors}


# ---------- dashboard ----------
@router.get("/dashboard/summary")
def dashboard_summary(owner: str = Depends(current_owner)):
    rows = query(INVOICE_SELECT + " where i.owner_id = %s", (owner,))
    unpaid = [r for r in rows if r["status"] != "paid"]

    by_currency: dict = {}
    aging: dict = {}
    for r in unpaid:
        cur = r["currency"]
        t = by_currency.setdefault(
            cur, {"outstanding": Decimal(0), "overdue": Decimal(0), "count": 0, "overdue_count": 0}
        )
        t["outstanding"] += r["amount"]
        t["count"] += 1
        if r["days_overdue"] > 0:
            t["overdue"] += r["amount"]
            t["overdue_count"] += 1
        b = bucket(r["days_overdue"], r["status"])
        aging.setdefault(cur, {}).setdefault(b, Decimal(0))
        aging[cur][b] += r["amount"]

    collected = query(
        "select currency, sum(amount) as amount from invoices "
        "where owner_id = %s and status = 'paid' and paid_at >= now() - interval '30 days' "
        "group by currency",
        (owner,),
    )
    return {"by_currency": by_currency, "aging": aging, "collected_30d": collected}