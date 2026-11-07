from datetime import time
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from auth import current_owner
from db import query
from outbox import ensure_settings

router = APIRouter()


class SettingsIn(BaseModel):
    mode: Literal["approval", "autopilot"] | None = None
    quiet_start: time | None = None
    quiet_end: time | None = None
    daily_cap: int | None = Field(default=None, ge=1, le=200)
    business_name: str | None = None
    tone_notes: str | None = None
    agent_paused: bool | None = None


@router.get("/settings")
def get_settings(owner: str = Depends(current_owner)):
    return ensure_settings(owner)


@router.put("/settings")
def update_settings(body: SettingsIn, owner: str = Depends(current_owner)):
    current = ensure_settings(owner)
    changes = body.model_dump(exclude_none=True)
    if not changes:
        return current
    start = changes.get("quiet_start", current["quiet_start"])
    end = changes.get("quiet_end", current["quiet_end"])
    if start >= end:
        raise HTTPException(422, "The sending window must start before it ends")
    # Column names come from our own model, never from user input.
    sets = ", ".join(f"{col} = %s" for col in changes)
    query(f"update settings set {sets} where owner_id = %s", [*changes.values(), owner])
    return ensure_settings(owner)