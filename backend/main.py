from contextlib import asynccontextmanager
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware


# Load .env BEFORE importing our own modules
load_dotenv(Path(__file__).resolve().parent.parent / ".env")

from ai import generate_text  # noqa: E402
from db import close_pool, query  # noqa: E402
from routes_invoices import router as invoices_router  # noqa: E402
from routes_drafts import router as drafts_router  # noqa: E402
from routes_settings import router as settings_router  # noqa: E402
from routes_jobs import router as jobs_router  # noqa: E402


@asynccontextmanager
async def lifespan(app: FastAPI):
    yield
    close_pool()


app = FastAPI(title="AI Collections Agent", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(invoices_router)
app.include_router(drafts_router)
app.include_router(settings_router)
app.include_router(jobs_router)


@app.get("/health")
def health():
    return {"status": "ok", "service": "ai-collections-agent"}


@app.get("/health/db")
def health_db():
    try:
        rows = query("select count(*) as invoices from invoices")
        return {"ok": True, **rows[0]}
    except Exception as e:
        return {"ok": False, "error": str(e)}


@app.get("/ai-test")
def ai_test():
    try:
        result = generate_text(
            "Write a polite one-sentence payment reminder for an invoice 5 days overdue."
        )
        return {"ok": True, "reply": result["text"], "model_used": result["model"]}
    except Exception as e:
        return {"ok": False, "error": str(e)}