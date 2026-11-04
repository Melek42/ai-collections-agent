import os

# Temporary: every request acts as this demo owner.
# Later this function will read the Supabase login token instead.
DEMO_OWNER_ID = "00000000-0000-0000-0000-000000000001"


def current_owner() -> str:
    return os.getenv("DEMO_OWNER_ID", DEMO_OWNER_ID)