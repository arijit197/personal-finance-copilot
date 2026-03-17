# Personal Finance Copilot (AI-Powered Full-Stack Project)

An end-to-end personal finance platform built with **React + FastAPI + SQLAlchemy + Ollama**.

It allows users to:
- securely register/login,
- upload bank transactions (CSV or raw text),
- analyze spending patterns,
- generate savings plans,
- chat with an AI finance assistant,
- download professional reports (CSV + PDF with charts).

---

## 1) Portfolio / Resume Summary

### Project Highlights
- Built a multi-user finance analytics product with **JWT authentication** and user-level data isolation.
- Implemented robust **transaction ingestion pipeline** for CSV and unstructured statement text.
- Developed a reusable **analytics engine** for summary, categories, monthly trends, anomalies, forecast, and target-based savings planning.
- Integrated **local LLM inference using Ollama** for AI finance Q&A.
- Added downloadable **PDF reports** with styled sections, monthly performance table, and expense pie chart.
- Added full-stack validation scripts for backend API testing + frontend production build checks.

### Tech Stack
- **Frontend:** React (Vite), plain CSS
- **Backend:** FastAPI, Pydantic, SQLAlchemy
- **Database:** SQLite
- **AI:** Ollama (`llama3.2:3b` default)
- **Reporting:** ReportLab (PDF), CSV export
- **Testing:** Python `unittest` + FastAPI `TestClient`

---

## 2) Product Features

### Authentication & User Management
- User registration and login
- JWT-based secured APIs
- User-scoped transactions and settings

### Data Ingestion
- Upload bank CSV files
- Upload raw statement text (parser with fallback handling)

### Finance Analytics
- Total In / Total Out / Net Savings
- Category-wise spending
- Top expenses
- Monthly performance summary
- Anomaly detection
- Next-month forecast
- Savings target planner (with category cut suggestions)

### AI Assistant
- Ask finance questions on personal transaction context
- Local model usage via Ollama (no paid API required)

### Reports
- Transactions CSV export
- Full finance PDF report including:
  - summary table,
  - monthly performance,
  - category breakdown,
  - expense pie chart,
  - top expenses,
  - anomaly alerts,
  - forecast,
  - savings plans,
  - practical advice.

---

## 3) Architecture Overview

```text
React UI (frontend/src)
   └── calls REST APIs

FastAPI Service (src/api.py, src/user_api.py)
   ├── Auth + user settings
   ├── Upload (CSV/Text)
   ├── Analytics engine (src/finance_engine.py)
   ├── AI integration (src/llm_ollama.py)
   └── Report generation (CSV/PDF)

Persistence Layer
   └── SQLAlchemy models (src/models.py) + SQLite (src/db.py)
```

---

## 4) Repository Structure

```text
.
├── data/
├── frontend/
│   ├── src/
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   └── styles.css
│   └── package.json
├── scripts/
│   └── test_project.sh
├── src/
│   ├── analyze_csv.py
│   ├── api.py
│   ├── auth.py
│   ├── db.py
│   ├── finance_engine.py
│   ├── llm_ollama.py
│   ├── mcp_server.py
│   ├── models.py
│   └── user_api.py
├── tests/
│   └── test_full_project.py
├── requirements.txt
└── README.md
```

---

## 5) Local Setup (Step-by-Step)

## Prerequisites
- Python 3.11+
- Node.js 18+
- npm
- (Optional for AI) Ollama installed and running

### Step 1: Clone and enter project
```bash
cd /Users/arijidas/Documents/Project/some
```

### Step 2: Backend setup
```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

### Step 3: Run backend API
```bash
python -m uvicorn src.api:app --reload
```

Backend URL: `http://127.0.0.1:8000`

### Step 4: Frontend setup
Open a second terminal:
```bash
cd /Users/arijidas/Documents/Project/some/frontend
npm install
npm run dev
```

Frontend URL will be printed by Vite (usually `http://localhost:5173` or next available port).

### Step 5 (Optional): Enable local AI with Ollama
```bash
ollama serve
ollama pull llama3.2:3b
```

---

## 6) How to Use the App

1. Register a new account and login.
2. Upload transaction data:
   - CSV upload, or
   - paste statement text.
3. Select period filter (All Time or specific month).
4. Review dashboard:
   - metrics, bars, pie chart, trends, top expenses.
5. Set target savings and check savings plan recommendations.
6. Use AI chat for personalized finance questions.
7. Download reports:
   - CSV report
   - Full PDF report.

---

## 7) API Overview

### Auth
- `POST /auth/register`
- `POST /auth/login`

### User & Analytics
- `GET /user/me`
- `GET /user/settings`
- `PUT /user/settings`
- `POST /user/upload-csv`
- `POST /user/upload-text`
- `GET /user/transactions`
- `DELETE /user/transactions`
- `GET /user/summary`
- `GET /user/categories`
- `GET /user/monthly`
- `GET /user/top-expenses`
- `GET /user/anomalies`
- `GET /user/forecast`
- `GET /user/savings-plan`

### AI
- `GET /user/ai-insight`
- `GET /user/ai-ask`

### Reports
- `GET /user/reports/transactions.csv`
- `GET /user/reports/summary.pdf?period=all|YYYY-MM`

---

## 8) Testing & Validation

### Run complete automated checks
```bash
cd /Users/arijidas/Documents/Project/some
bash scripts/test_project.sh
```

This script runs:
1. Backend end-to-end tests (`tests/test_full_project.py`)
2. Frontend production build (`npm run build`)

---

## 9) Resume-Ready Engineering Notes

- Designed a modular analytics backend with clean separation between API, business logic, and persistence.
- Implemented robust parsing for semi-structured financial statement text.
- Delivered local-first AI integration with graceful fallback behavior.
- Added professional reporting with charted PDF output and period-specific savings recommendations.
- Built and maintained end-to-end automation for reliability.

---

## 10) Sample Resume Bullet Points

- Built a full-stack personal finance copilot using **React, FastAPI, SQLAlchemy, and SQLite**, enabling secure multi-user transaction analytics and reporting.
- Engineered a finance analytics pipeline for category breakdown, monthly trends, anomaly detection, forecasting, and target-based savings plans.
- Integrated local AI assistant workflows with **Ollama** for contextual personal finance Q&A.
- Developed polished exports (CSV + PDF with charts) and automated test/build pipeline for production-style quality assurance.
