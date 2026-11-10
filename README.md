# AI Collections Agent

An AI agent that automates accounts receivable for small businesses: it tracks invoices, decides who to chase and how firmly, drafts the emails, understands client replies, and keeps the owner in control.

- Live app: [VERCEL URL]
- Demo video: [VIDEO URL]
- Design document: v2, approved by the reviewer (see the PDF in this repo)

## What is built

- Invoice tracking with aging, CSV import, and a dashboard (USD and ETB)
- An escalating agent: friendly, polite, firm and final-notice stages, then human escalation after 45 days
- Guardrails enforced in code: 3-day contact limit, sending window, daily cap, paused clients, respect for promised dates, kill switch
- Gemini email drafting with code-side fact checks (exact invoice number, amount and due date; no placeholders; no threats), plus retries and a fallback model
- Approval queue showing the agent's reasoning, and an Autopilot mode
- Email sending through Resend (demo mode redirects all mail to the owner)
- Reply understanding: Gemini classifies replies into 7 categories, extracts real dates, and the agent acts (pause reminders, flag disputes, request payment confirmation); resistant to prompt injection
- Scheduled daily run through GitHub Actions calling secured job endpoints
- Automated tests (pytest)

## Not built yet (planned in the design doc)

Gmail inbox polling and Calendar follow-ups (replies are simulated in the UI), client payment portal, AI receipt verification, client risk scoring, Copilot chat, ROI analytics, and Supabase Auth login (the demo runs as one fixed owner with synthetic data).

## Stack

React (Vite) and Tailwind, Python FastAPI, Gemini API, Supabase Postgres, Resend, GitHub Actions, Render, Vercel.

## Run locally

1. Copy `.env.example` to `.env` in the project root and fill it in.
2. Backend: `cd backend`, create a venv, `pip install -r requirements.txt`, `uvicorn main:app --reload --port 8000`
3. Seed demo data: `python seed.py`
4. Frontend: `cd frontend`, `npm install`, `npm run dev`
5. Tests: `cd backend` then `python -m pytest -q`

## Notes

The free hosting tier sleeps when idle, so the first request after a pause can take about a minute.