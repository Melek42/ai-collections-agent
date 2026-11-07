import hmac
import os

from fastapi import APIRouter, Depends, Header, HTTPException

from auth import current_owner
from outbox import flush_outbox
from routes_drafts import run_now

router = APIRouter(prefix="/jobs")


def require_secret(x_job_secret: str = Header(default="")):
    expected = os.getenv("JOB_SECRET", "")
    if not expected or not hmac.compare_digest(x_job_secret.encode(), expected.encode()):
        raise HTTPException(401, "Invalid job secret")


@router.post("/daily-run", dependencies=[Depends(require_secret)])
def daily_run():
    return run_now(max_drafts=20, owner=current_owner())


@router.post("/flush-outbox", dependencies=[Depends(require_secret)])
def flush_job():
    return flush_outbox(current_owner())