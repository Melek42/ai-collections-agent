from datetime import datetime, timedelta, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from psycopg.types.json import Jsonb
from pydantic import BaseModel, Field

from auth import current_owner
from db import query
from drafting import DraftError, build_facts, create_draft, validate_draft
from routes_invoices import INVOICE_SELECT, log_event
from stages import STAGES, stage_for

router = APIRouter()


def ensure_settings(owner: str) -> dict:
    query("insert into settings (owner_id) values (%s) on conflict (owner_id) do nothing", (owner,))
    return query("select * from settings where owner_id = %s", (owner,))[0]


def payment_history(owner: str, client_id) -> str:
    r = query(
        "select count(*) as n, avg(paid_at::date - due_date) as avg_days from invoices "
        "where owner_id = %s and client_id = %s and status = 'paid' and paid_at is not null",
        (owner, client_id),
    )[0]
    if not r["n"]:
        return "No payment history yet."
    avg = float(r["avg_days"])
    if avg <= 0:
        return f"Paid {r['n']} earlier invoice(s) on time or early."
    return f"Paid {r['n']} earlier invoice(s), on average {avg:.0f} days after the due date."


def contact_block(msgs: list, stage: int, now: datetime):
    """Guardrail: returns a reason string if we must NOT contact this invoice now."""
    if any(m["status"] == "draft" for m in msgs):
        return "a draft is already waiting for review"
    sent = [m for m in msgs if m["status"] in ("sent", "approved")]
    if sent:
        when = lambda m: m["sent_at"] or m["created_at"]  # noqa: E731
        if now - max(when(m) for m in sent) < timedelta(days=3):
            return "contacted less than 3 days ago"
        if any(m["stage"] == stage and now - when(m) < timedelta(days=7) for m in sent):
            return "already reminded at this stage this week"
    return None


@router.post("/agent/run-now")
def run_now(max_drafts: int = 5, owner: str = Depends(current_owner)):
    settings = ensure_settings(owner)
    if settings["agent_paused"]:
        raise HTTPException(409, "The agent is paused (kill switch is on).")

    now = datetime.now(timezone.utc)
    clients = {c["id"]: c for c in query("select * from clients where owner_id = %s", (owner,))}
    msgs_by_invoice: dict = {}
    for m in query(
        "select invoice_id, status, stage, created_at, sent_at from messages "
        "where owner_id = %s and direction = 'out'",
        (owner,),
    ):
        msgs_by_invoice.setdefault(m["invoice_id"], []).append(m)

    invoices = query(
        INVOICE_SELECT + " where i.owner_id = %s and i.status in ('upcoming','overdue') order by i.due_date asc",
        (owner,),
    )

    drafted, escalated, skipped, failed = [], [], [], []
    for inv in invoices:
        label = f"{inv['number']} ({inv['client_name']})"
        client = clients[inv["client_id"]]
        stage = stage_for(inv["days_overdue"])

        def skip(reason):
            skipped.append({"invoice": label, "reason": reason})

        if client["paused"]:
            skip("client is paused")
            continue
        if stage is None:
            skip("not due soon enough")
            continue
        if inv["promised_date"] and inv["promised_date"] >= now.date():
            skip(f"client promised to pay on {inv['promised_date']}")
            continue

        if stage == 4:
            query("update invoices set status = 'escalated', stage = 4 where id = %s", (inv["id"],))
            reason = f"{inv['days_overdue']} days overdue: past the point where automated emails help."
            query(
                "insert into agent_decisions (owner_id, invoice_id, tool, arguments, reason, outcome) "
                "values (%s,%s,'escalate_to_owner',%s,%s,'escalated')",
                (owner, inv["id"], Jsonb({"stage": 4}), reason),
            )
            log_event(owner, inv["id"], "escalated_to_owner", {"days_overdue": inv["days_overdue"]}, "agent")
            escalated.append(label)
            continue

        blocked = contact_block(msgs_by_invoice.get(inv["id"], []), stage, now)
        if blocked:
            skip(blocked)
            continue
        if len(drafted) >= max_drafts:
            skip("per-run draft limit reached (run again for more)")
            continue

        try:
            draft = create_draft(
                inv,
                client,
                settings["business_name"] or "our company",
                settings["tone_notes"],
                stage,
                payment_history(owner, inv["client_id"]),
            )
        except DraftError as e:
            failed.append({"invoice": label, "reason": str(e)})
            log_event(owner, inv["id"], "draft_failed", {"error": str(e)}, "agent")
            continue

        key = f"{inv['id']}:{stage}:{now.date()}"
        rows = query(
            "insert into messages (owner_id, invoice_id, direction, subject, body, status, stage, tone, idempotency_key) "
            "values (%s,%s,'out',%s,%s,'draft',%s,%s,%s) on conflict (idempotency_key) do nothing returning id",
            (owner, inv["id"], draft["subject"], draft["body"], stage, STAGES[stage][1], key),
        )
        if not rows:
            skip("already drafted today")
            continue

        query("update invoices set stage = %s where id = %s", (stage, inv["id"]))
        query(
            "insert into agent_decisions (owner_id, invoice_id, tool, arguments, reason, outcome) "
            "values (%s,%s,'send_reminder',%s,%s,'drafted')",
            (
                owner,
                inv["id"],
                Jsonb({"stage": stage, "tone": STAGES[stage][1], "message_id": str(rows[0]["id"]), "model": draft["model"]}),
                draft["reason"],
            ),
        )
        log_event(owner, inv["id"], "draft_created", {"stage": stage}, "agent")
        drafted.append(label)

    return {"drafted": drafted, "escalated": escalated, "skipped": skipped, "failed": failed}


# ---------- review queue ----------
@router.get("/drafts")
def list_drafts(status: str = "draft", owner: str = Depends(current_owner)):
    sql = """
      select m.id, m.subject, m.body, m.status, m.stage, m.tone, m.created_at,
             i.id as invoice_id, i.number, i.amount, i.currency, i.due_date,
             (current_date - i.due_date) as days_overdue,
             c.name as client_name, c.email as client_email,
             d.reason, d.arguments->>'model' as model
      from messages m
      join invoices i on i.id = m.invoice_id
      join clients c on c.id = i.client_id
      left join lateral (
        select reason, arguments from agent_decisions d
        where d.invoice_id = m.invoice_id and d.arguments->>'message_id' = m.id::text
        order by created_at desc limit 1
      ) d on true
      where m.owner_id = %s and m.direction = 'out'
    """
    params: list = [owner]
    if status != "all":
        sql += " and m.status = %s"
        params.append(status)
    sql += " order by m.created_at desc"
    return query(sql, params)


class DraftEdit(BaseModel):
    subject: str = Field(min_length=1)
    body: str = Field(min_length=1)


def _get_draft(draft_id, owner):
    rows = query("select * from messages where id = %s and owner_id = %s", (draft_id, owner))
    if not rows:
        raise HTTPException(404, "Draft not found")
    return rows[0]


@router.patch("/drafts/{draft_id}")
def edit_draft(draft_id: UUID, body: DraftEdit, owner: str = Depends(current_owner)):
    d = _get_draft(draft_id, owner)
    if d["status"] != "draft":
        raise HTTPException(409, "Only drafts waiting for review can be edited")
    query("update messages set subject = %s, body = %s where id = %s", (body.subject, body.body, draft_id))
    log_event(owner, d["invoice_id"], "draft_edited", {"message_id": str(draft_id)}, "owner")
    return {"ok": True}


@router.post("/drafts/{draft_id}/approve")
def approve_draft(draft_id: UUID, owner: str = Depends(current_owner)):
    d = _get_draft(draft_id, owner)
    if d["status"] != "draft":
        raise HTTPException(409, "This draft was already handled")
    inv = query(INVOICE_SELECT + " where i.id = %s and i.owner_id = %s", (d["invoice_id"], owner))[0]
    problems = validate_draft(d["subject"], d["body"], build_facts(inv))
    if problems:
        raise HTTPException(422, "This email can't be approved yet: " + "; ".join(problems))
    query("update messages set status = 'approved' where id = %s", (draft_id,))
    log_event(owner, d["invoice_id"], "draft_approved", {"message_id": str(draft_id)}, "owner")
    return {"ok": True}


@router.post("/drafts/{draft_id}/reject")
def reject_draft(draft_id: UUID, owner: str = Depends(current_owner)):
    d = _get_draft(draft_id, owner)
    if d["status"] != "draft":
        raise HTTPException(409, "This draft was already handled")
    query("update messages set status = 'rejected' where id = %s", (draft_id,))
    log_event(owner, d["invoice_id"], "draft_rejected", {"message_id": str(draft_id)}, "owner")
    return {"ok": True}