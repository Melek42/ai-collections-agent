from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Load .env BEFORE importing our own modules
load_dotenv(Path(__file__).resolve().parent.parent / ".env")

from ai import generate_text  # noqa: E402

app = FastAPI(title="AI Collections Agent")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    return {"status": "ok", "service": "ai-collections-agent"}


@app.get("/ai-test")
def ai_test():
    try:
        result = generate_text(
            "Write a polite one-sentence payment reminder for an invoice 5 days overdue."
        )
        return {"ok": True, "reply": result["text"], "model_used": result["model"]}
    except Exception as e:
        return {"ok": False, "error": str(e)}