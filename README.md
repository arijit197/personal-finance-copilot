# Personal Finance Copilot (AI-Powered)

An end-to-end **full-stack personal finance assistant** that helps users upload bank data, analyze spending, detect anomalies, forecast savings, chat with AI, and download professional reports.

---

## Resume / Job Portfolio Summary

### Project Overview
Built a production-style, multi-user finance analytics platform with:
- **Secure authentication** (JWT, user-specific data isolation)
- **CSV + raw statement text ingestion**
- **Rule-based financial analytics engine**
- **AI finance assistant** (local LLM via Ollama)
- **Forecasting + target-based savings planner**
- **Downloadable reports** (CSV + styled PDF)
- **Modern React dashboard** with Home + AI chat experience

### Key Engineering Highlights
- Designed modular backend architecture (`finance_engine`, `auth`, `user_api`, `llm_ollama`, `mcp_server`)
- Implemented resilient parsing pipeline for messy statement text input
- Built analytics stack: category breakdown, monthly trends, top expenses, anomaly alerts
- Added clean UX patterns: auth validation, period filtering (month/year or all-time), file upload workflows
- Generated polished PDF reports including user identity and Unicode-safe `₹` rendering

### Tech Stack
- **Frontend:** React (Vite), CSS
- **Backend:** FastAPI, SQLAlchemy, Pydantic
- **Database:** SQLite (default, via SQLAlchemy models)
- **AI:** Ollama (`llama3.2:3b` default)
- **Reporting:** ReportLab (PDF), CSV export
- **Tooling/Integration:** MCP server support

---

## Architecture (High Level)

```
React UI (frontend/src)
    ↓ REST API
FastAPI (src/api.py + src/user_api.py)
    ├─ Auth + User settings + History
    ├─ Ingestion (CSV/Text)
    ├─ Analytics (src/finance_engine.py)
    ├─ AI insights/Q&A (src/llm_ollama.py)
    └─ Reports (CSV + PDF)
         ↓
SQLAlchemy Models (src/models.py) + DB (src/db.py)
```

---

## Step-by-Step: How This Project Was Built

### Step 1 — Setup & Base Analysis
- Created Python virtual environment and dependency setup.
- Added sample transaction CSV and first analyzer script.
- Computed:
  - total credit
  - total debit
  - net savings
  - top expenses

### Step 2 — Transaction Categorization Engine
- Added keyword-based category mapping (Food, Transport, Utilities, etc.).
- Integrated category-wise spending breakdown.

### Step 3 — Trend & Risk Signals
- Added monthly summary generation.
- Added anomaly detection (median-based high expense detection).

### Step 4 — FastAPI Service Layer
- Converted analytics logic into reusable backend endpoints:
  - `/summary`, `/categories`, `/monthly`, `/top-expenses`, `/anomalies`, etc.

### Step 5 — MCP Tooling Integration
- Created `src/mcp_server.py` exposing analytics tools for AI tool-calling workflows.

### Step 6 — LLM Integration (Ollama)
- Integrated local AI advice generation and Q&A endpoints:
  - `/ai-insight`
  - `/ai-ask?question=...`

### Step 7 — Forecast & Savings Planner
- Added predictive endpoint for next-month finances.
- Added target savings plan with category-wise reduction suggestions.

### Step 8 — User Auth + Data Isolation
- Implemented register/login with JWT.
- Added user-scoped transactions/settings endpoints.
- Ensured each user sees only their own data.

### Step 9 — Data Ingestion Workflows
- Added CSV upload endpoint.
- Added text statement ingestion with parser and fallback tips.

### Step 10 — Report Generation
- Added downloadable:
  - transactions CSV
  - full PDF summary report
- Included user name/email and improved report formatting.

### Step 11 — React Dashboard
- Built login/register UI.
- Added Home dashboard with:
  - month/year or all-time filters
  - upload sections
  - analytics cards/charts
  - report download actions
- Added AI chat page.

### Step 12 — UX Refinements
- Strong auth input validation + friendly error messages.
- Professional upload UI and visual polish.
- Improved PDF typography + robust rupee symbol rendering.

---

## How to Run the Project (Local)

### 1) Backend
```bash
cd /Users/arijidas/Documents/Project/some
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python -m uvicorn src.api:app --reload
```

### 2) Frontend
```bash
cd /Users/arijidas/Documents/Project/some/frontend
npm install
npm run dev
```

Open Vite URL shown in terminal (usually `http://localhost:5173`).

### 3) Optional AI (Ollama)
```bash
ollama serve
ollama pull llama3.2:3b
```

---

## Quick Demo Flow

1. Register a user and login.
2. Upload CSV: `data/demo_upload_transactions.csv`
3. Paste text from: `data/demo_upload_statement_text.txt`
4. Select month/year filter in Home dashboard.
5. Review metrics, trends, anomalies, forecasts, and savings plan.
6. Ask finance questions in AI Feature tab.
7. Download CSV and PDF reports.

---

## Important API Groups

### Auth
- `POST /auth/register`
- `POST /auth/login`

### User Data + Analytics
- `GET /user/transactions`
- `POST /user/upload-csv`
- `POST /user/upload-text`
- `GET /user/summary`
- `GET /user/categories`
- `GET /user/monthly`
- `GET /user/top-expenses`
- `GET /user/anomalies`
- `GET /user/forecast`
- `GET /user/savings-plan`

### AI + Reports
- `GET /user/ai-insight`
- `GET /user/ai-ask`
- `GET /user/reports/transactions.csv`
- `GET /user/reports/summary.pdf`

---

## Resume Bullet Points (Copy-Ready)

- Built a full-stack AI-powered personal finance platform using **React + FastAPI + SQLAlchemy** with secure JWT authentication and user-scoped data isolation.
- Engineered CSV/text ingestion pipelines and a rule-based analytics engine delivering category insights, monthly trends, anomaly detection, and savings forecasts.
- Integrated local LLM workflows using **Ollama** for personalized finance Q&A and automated advisory generation.
- Developed professional reporting features with downloadable CSV/PDF outputs, including styled layouts and Unicode-safe currency rendering.

---

## Repository Structure

```
src/
  analyze_csv.py
  api.py
  auth.py
  db.py
  finance_engine.py
  llm_ollama.py
  mcp_server.py
  models.py
  user_api.py

frontend/
  src/
    App.jsx
    main.jsx
    styles.css
```
