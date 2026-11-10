from typing import Literal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from auth import current_owner
from db import query
from replies import apply_reply
from routes_invoices import INVOICE_SELECT, log_event

router = APIRouter()


class SimulateIn(BaseModel):
    invoice_id: UUID
    text: str = Field(min_length=2, max_length=4000)


@router.post("/replies/simulate")
def simulate(body: SimulateIn, owner: str = Depends(current_owner)):
    rows = query(INVOICE_SELECT + " where i.id = %s and i.owner_id = %s", (body.invoice_id, owner))
    if not rows:
        raise HTTPException(404, "Invoice not found")
    try:
        return apply_reply(owner, rows[0], body.text.strip(), "simulated")
    except RuntimeError as e:
        raise HTTPException(503, f"The AI is unavailable right now. Try again in a minute. ({e})")


@router.get("/replies")
def list_replies(owner: str = Depends(current_owner)):
    return query(
        """
        select c.id, c.category, c.promised_date, c.confidence, c.summary, c.resolved,
               c.action_taken, c.created_at, m.body,
               i.id as invoice_id, i.number, i.amount, i.currency, i.status as invoice_status,
               cl.name as client_name
        from classifications c
        join messages m on m.id = c.message_id
        join invoices i on i.id = m.invoice_id
        join clients cl on cl.id = i.client_id
        where c.owner_id = %s
        order by c.resolved asc, c.created_at desc
        limit 100
        """,
        (owner,),
    )


class ResolveIn(BaseModel):
    action: Literal["handled", "confirm_paid", "not_received", "resume"]


LABELS = {
    "handled": "marked as handled",
    "confirm_paid": "confirmed payment received",
    "not_received": "payment not received, reminders resume",
    "resume": "reminders resumed",
}


@router.post("/replies/{reply_id}/resolve")
def resolve(reply_id: UUID, body: ResolveIn, owner: str = Depends(current_owner)):
    rows = query(
        "select c.id, m.invoice_id from classifications c join messages m on m.id = c.message_id "
        "where c.id = %s and c.owner_id = %s",
        (reply_id, owner),
    )
    if not rows:
        raise HTTPException(404, "Reply not found")
    invoice_id = rows[0]["invoice_id"]

    if body.action == "confirm_paid":
        query(
            "update invoices set status = 'paid', paid_at = now() where id = %s and owner_id = %s and status <> 'paid'",
            (invoice_id, owner),
        )
    elif body.action in ("not_received", "resume"):
        query(
            "update invoices set status = 'overdue', promised_date = null "
            "where id = %s and owner_id = %s and status in ('payment_pending','disputed','promised')",
            (invoice_id, owner),
        )

    query(
        "update classifications set resolved = true, "
        "action_taken = coalesce(action_taken, '') || ' > Owner: ' || %s where id = %s",
        (LABELS[body.action], reply_id),
    )
    log_event(owner, invoice_id, "reply_resolved", {"action": body.action}, "owner")
    return {"ok": True}