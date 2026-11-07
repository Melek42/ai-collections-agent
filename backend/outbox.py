from datetime import datetime, timezone
from zoneinfo import ZoneInfo

from db import query
from drafting import build_facts, validate_draft
from emailer import EmailError, send_email
from routes_invoices import INVOICE_SELECT, log_event


def ensure_settings(owner: str) -> dict:
    query("insert into settings (owner_id) values (%s) on conflict (owner_id) do nothing", (owner,))
    return query("select * from settings where owner_id = %s", (owner,))[0]


def window_open(settings: dict, now_utc: datetime) -> bool:
    local = now_utc.astimezone(ZoneInfo(settings["timezone"]))
    return settings["quiet_start"] <= local.time() < settings["quiet_end"]


def sent_today(owner: str, tz: ZoneInfo) -> int:
    start = datetime.now(tz).replace(hour=0, minute=0, second=0, microsecond=0)
    rows = query(
        "select count(*) as n from messages where owner_id = %s and direction = 'out' "
        "and status = 'sent' and sent_at >= %s",
        (owner, start.astimezone(timezone.utc)),
    )
    return rows[0]["n"]


def flush_outbox(owner: str, only: list | None = None) -> dict:
    """Send approved emails, if the guardrails allow it right now."""
    settings = ensure_settings(owner)
    result = {"sent": [], "held": None, "failed": []}

    if settings["agent_paused"]:
        result["held"] = "the agent is paused (kill switch is on)"
        return result

    tz = ZoneInfo(settings["timezone"])
    now = datetime.now(timezone.utc)
    if not window_open(settings, now):
        a, b = settings["quiet_start"].strftime("%H:%M"), settings["quiet_end"].strftime("%H:%M")
        result["held"] = f"it is outside your sending window ({a} to {b}, {settings['timezone']})"
        return result

    sql = (
        "select * from messages where owner_id = %s and direction = 'out' and status = 'approved'"
    )
    params: list = [owner]
    if only:
        sql += " and id = any(%s)"
        params.append(list(only))
    sql += " order by created_at asc"
    pending = query(sql, params)

    used = sent_today(owner, tz)
    for m in pending:
        if used >= settings["daily_cap"]:
            result["held"] = f"the daily cap of {settings['daily_cap']} emails was reached"
            break

        inv = query(INVOICE_SELECT + " where i.id = %s", (m["invoice_id"],))[0]

        # Never chase an invoice that was paid or disputed after the draft was written
        if inv["status"] in ("paid", "disputed", "payment_pending"):
            query("update messages set status = 'rejected' where id = %s", (m["id"],))
            log_event(owner, m["invoice_id"], "send_cancelled", {"reason": f"invoice is {inv['status']}"}, "agent")
            result["failed"].append({"invoice": inv["number"], "error": f"cancelled: invoice is {inv['status']}"})
            continue

        problems = validate_draft(m["subject"], m["body"], build_facts(inv))
        if problems:
            result["failed"].append({"invoice": inv["number"], "error": "; ".join(problems)})
            continue

        try:
            info = send_email(
                inv["client_email"], m["subject"], m["body"], str(m["id"]),
                settings["business_name"] or "Collections",
            )
        except EmailError as e:
            log_event(owner, m["invoice_id"], "send_failed", {"error": str(e)}, "agent")
            result["failed"].append({"invoice": inv["number"], "error": str(e)})
            continue

        query("update messages set status = 'sent', sent_at = now() where id = %s", (m["id"],))
        query("update invoices set last_contacted_at = now() where id = %s", (m["invoice_id"],))
        log_event(
            owner, m["invoice_id"], "email_sent",
            {"message_id": str(m["id"]), "intended_for": info["intended_for"],
             "delivered_to": info["delivered_to"], "provider_id": info["provider_id"]},
            "agent",
        )
        used += 1
        result["sent"].append({"invoice": inv["number"], "to": info["delivered_to"], "intended_for": info["intended_for"]})

    return result