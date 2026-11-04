import os
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from google import genai
from google import genai

# Load the .env file from the project root
load_dotenv(Path(__file__).resolve().parent.parent / ".env")

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
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        return {"ok": False, "error": "GEMINI_API_KEY missing from .env"}
    try:
        client = genai.Client(api_key=api_key)
        response = client.models.generate_content(
            model=os.getenv("GEMINI_MODEL", "gemini-3.8-flash"),
            contents="Write a polite one-sentence payment reminder for an invoice 5 days overdue.",
        )
        return {"ok": True, "reply": response.text}
    except Exception as e:
        return {"ok": False, "error": str(e)}