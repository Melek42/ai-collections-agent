import os
from datetime import date, datetime, time, timedelta, timezone
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent.parent / ".env")

from auth import current_owner  # noqa: E402
from db import close_pool, query  # noqa: E402

OWNER = current_owner()
BASE = os.getenv("DEMO_CLIENT_EMAIL", "demo@example.com")


def tagged(tag: str) -> str:
    """you@gmail.com -> you+acme@gmail.com (still delivers to your inbox)."""
    local, domain = BASE.split("@", 1)
    return f"{local}+{tag}@{domain}"


# key: (name, currency, notes)
CLIENTS = {
    "acme": ("Acme Trading PLC", "USD", "Reliable payer"),
    "bluenile": ("Blue Nile Logistics", "USD", "Always pays late; needs firm reminders"),
    "addis": ("Addis Design Studio", "ETB", "Promises dates, then slips"),
    "habesha": ("Habesha Foods", "USD", "Often disputes invoices"),
    "summit": ("Summit Consulting", "USD", "New client"),
    "eagle": ("Eagle Printing", "ETB", "Small invoices, slow to reply"),
}

# (client, number, amount, due in N days [negative = overdue], paid N days after due [None = unpaid])
INVOICES = [
    ("acme", "INV-1001", 4200, -75, -2),
    ("acme", "INV-1002", 3600, -45, 0),
    ("acme", "INV-1007", 5200, 3, None),
    ("bluenile", "INV-1003", 8800, -120, 28),
    ("bluenile", "INV-1004", 7600, -80, 35),
    ("bluenile", "INV-1008", 9400, -12, None),
    ("bluenile", "INV-1012", 6100, -33, None),
    ("addis", "INV-1005", 150000, -90, 14),
    ("addis", "INV-1009", 180000, -6, None),
    ("addis", "INV-1013", 95000, -21, None),
    ("habesha", "INV-1006", 3100, -60, 10),
    ("habesha", "INV-1010", 4700, -18, None),
    ("habesha", "INV-1014", 2900, -52, None),
    ("summit", "INV-1011", 2500, 7, None),
    ("summit", "INV-1015", 12000, -2, None),
    ("eagle", "INV-1016", 48000, -30, 20),
    ("eagle", "INV-1017", 36000, -9, None),
]


def main():
    today = date.today()

    # Start clean (deleting clients also deletes their invoices and related rows)
    query("delete from clients where owner_id = %s", (OWNER,))
    query("delete from events where owner_id = %s", (OWNER,))
    query(
        "insert into settings (owner_id, business_name, tone_notes) values (%s,%s,%s) "
        "on conflict (owner_id) do nothing",
        (OWNER, "Demo Creative Studio",
         "Warm, professional and concise. We value long-term relationships."),
    )

    ids = {}
    for key, (name, currency, notes) in CLIENTS.items():
        row = query(
            "insert into clients (owner_id, name, email, currency, notes) "
            "values (%s,%s,%s,%s,%s) returning id",
            (OWNER, name, tagged(key), currency, notes),
        )
        ids[key] = row[0]["id"]

    for key, number, amount, due_offset, paid_delay in INVOICES:
        due = today + timedelta(days=due_offset)
        issue = due - timedelta(days=30)
        currency = CLIENTS[key][1]
        if paid_delay is None:
            status = "overdue" if due < today else "upcoming"
            paid_at = None
        else:
            status = "paid"
            paid_at = datetime.combine(due + timedelta(days=paid_delay), time(12, 0), tzinfo=timezone.utc)
        query(
            "insert into invoices (owner_id, client_id, number, amount, currency, issue_date, due_date, status, paid_at) "
            "values (%s,%s,%s,%s,%s,%s,%s,%s,%s)",
            (OWNER, ids[key], number, amount, currency, issue, due, status, paid_at),
        )

    print(f"Seeded {len(CLIENTS)} clients and {len(INVOICES)} invoices.")
    print(f"Client emails look like: {tagged('acme')}")
    close_pool()


if __name__ == "__main__":
    main()