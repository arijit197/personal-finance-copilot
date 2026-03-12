# personal-finance-copilot


Beginner-friendly project to build an AI-powered Personal Finance Copilot step by step.

## Step 2: Local setup + first CSV analysis

### 1) Create and activate virtual environment

```bash
python3 -m venv .venv
source .venv/bin/activate
```

### 2) Install dependencies

```bash
pip install -r requirements.txt
```

### 3) Run first analysis script

```bash
python src/analyze_csv.py
```

This script reads `data/sample_bank_statement.csv` and prints:
- total money in (credit)
- total money out (debit)
- net savings
- top 5 highest expenses

## Git commands for this step

```bash
git add .
git commit -m "Step 2: setup venv, sample CSV and analysis script"
git push
```

## Step 3: Auto-categorize transactions

In this step, we added simple keyword rules to automatically classify expenses into categories like:
- Food
- Transport
- Utilities
- Shopping
- Entertainment
- Housing
- Investment
- Health
- Cash

### Run Step 3

```bash
python src/analyze_csv.py
```

Now output includes:
- core money summary
- top 5 expenses
- category-wise spending breakdown

## Git commands for Step 3

```bash
git add .
git commit -m "Step 3: add transaction categorization and category-wise spending"
git push
```

## Step 4: Monthly summary + anomaly detection

In this step, we made the script smarter with two useful insights:

1. **Monthly summary**
   - Total money in
   - Total money out
   - Net savings

2. **Anomaly detection (rule-based)**
   - Finds unusually high expenses
   - Uses median expense as baseline
   - Marks transactions >= 2x baseline as potential anomalies

### Run Step 4

```bash
python src/analyze_csv.py
```

Now output includes:
- core money summary
- top 5 expenses
- category-wise spending
- monthly summary
- unusual/high expense alerts

## Git commands for Step 4

```bash
git add .
git commit -m "Step 4: add monthly summary and anomaly detection"
git push
```

## Step 5: FastAPI endpoints (foundation for MCP)

In this step, we prepared your project for MCP by creating API endpoints.

### What we added
- `src/finance_engine.py` → reusable finance logic module
- `src/api.py` → FastAPI app with endpoints

### New API endpoints
- `GET /health`
- `GET /summary`
- `GET /top-expenses?limit=5`
- `GET /categories`
- `GET /monthly`
- `GET /anomalies?multiplier=2.0`

### Install/update dependencies

```bash
pip install -r requirements.txt
```

### Run API server

```bash
uvicorn src.api:app --reload
```

Then open:
- Swagger UI docs: `http://127.0.0.1:8000/docs`

## Git commands for Step 5

```bash
git add .
git commit -m "Step 5: add reusable finance engine and FastAPI endpoints"
git push
```

## Step 6: MCP server integration (AI can call your finance tools)

In this step, we added an MCP server so an AI assistant can directly call your finance functions.

### What we added
- `src/mcp_server.py` with MCP tools:
  - `health`
  - `get_summary`
  - `get_top_expenses`
  - `get_categories`
  - `get_monthly_summary`
  - `get_anomalies`

### Install/update dependencies

```bash
pip install -r requirements.txt
```

### Run MCP server locally

```bash
python src/mcp_server.py
```

### Next (optional): connect this MCP server in Cline MCP settings
After this, we can register this server in your MCP settings JSON so tools become available in chat.

## Git commands for Step 6

```bash
git add .
git commit -m "Step 6: add MCP server exposing finance tools"
git push
```

## Step 7: Ollama integration (free local AI advice)

In this step, we added local AI support using Ollama.

### What we added
- `src/llm_ollama.py` (Ollama client helper)
- API endpoint: `GET /ai-insight`
- MCP tool: `get_ai_finance_advice`

### Install Ollama (one-time)
- Download: https://ollama.com/download

### Start Ollama + pull a model

```bash
ollama serve
ollama pull llama3.2:3b
```

### Test model quickly

```bash
ollama run llama3.2:3b
```

### Run your API and test AI endpoint

```bash
uvicorn src.api:app --reload
```

Open:
- `http://127.0.0.1:8000/docs`
- Try `GET /ai-insight`

### Ask custom questions directly (Q&A)

You can now ask direct questions from API:

- Endpoint: `GET /ai-ask`
- Required query param: `question`

Example:

`/ai-ask?question=How%20much%20did%20I%20spend%20on%20food%20and%20how%20can%20I%20reduce%20it%3F`

### Run MCP server and use AI advice tool

```bash
python src/mcp_server.py
```

Use tool:
- `get_ai_finance_advice`
- `ask_ai_finance_question` (for custom question-based insights)

## Git commands for Step 7

```bash
git add .
git commit -m "Step 7: add Ollama-based AI finance advice in API and MCP"
git push
```

## Step 8: Forecasting + savings target suggestions

In this step, we added predictive planning features.

### New API endpoints
- `GET /forecast?income_growth_pct=0`
  - Predicts next month income/expense/savings using last month baseline.
- `GET /savings-plan?target_savings=55000`
  - Suggests category-wise budget cuts to reach your target savings.

### New MCP tools
- `get_forecast`
- `get_savings_target_plan`

### Example questions
- “How much might I save next month if income grows by 5%?”
- “If I want to save ₹55,000, how much should I cut category-wise?”

## Git commands for Step 8

```bash
git add .
git commit -m "Step 8: add forecasting and savings target planning"
git push
```

## Step 9: React UI dashboard (chat + forecast + savings plan)

We added a React frontend in `frontend/` so you can use your project visually.

### What it does
- Ask custom question to AI (`/ai-ask`)
- Show next month forecast (`/forecast`)
- Show target-based savings cut plan (`/savings-plan`)

### Run backend (Terminal 1)

```bash
cd /Users/arijidas/Documents/Project/some
source .venv/bin/activate
uvicorn src.api:app --reload
```

### Run frontend (Terminal 2)

```bash
cd /Users/arijidas/Documents/Project/some/frontend
npm install
npm run dev
```

Open UI:
- `http://127.0.0.1:5173`

## Git commands for Step 9

```bash
git add .
git commit -m "Step 9: add React dashboard for AI Q&A, forecast, and savings plan"
git push
```

## Step 10: Local auth + user history + reports + CSV/Text ingestion

This step upgrades the app into a real multi-user product flow.

### Added backend features
- Local auth (email/password + JWT)
  - `POST /auth/register`
  - `POST /auth/login`
- User profile/settings
  - `GET /user/me`
  - `GET /user/settings`
  - `PUT /user/settings`
- User transaction history
  - `GET /user/transactions`
  - `DELETE /user/transactions`
- Ingestion
  - `POST /user/upload-csv`
  - `POST /user/upload-text` (paste statement text)
- User-scoped analytics and AI
  - `/user/summary`, `/user/categories`, `/user/monthly`, `/user/top-expenses`, `/user/anomalies`
  - `/user/forecast`, `/user/savings-plan`
  - `/user/ai-insight`, `/user/ai-ask`
- Reports
  - `GET /user/reports/transactions.csv`
  - `GET /user/reports/summary.pdf`

### Added frontend features
- Login/Register screen
- Token-based session storage (localStorage)
- Upload CSV
- Paste statement text and parse transactions
- User settings (target savings, growth %, model)
- Download CSV/PDF reports
- View user transaction history
- Run AI + forecast + savings plan on user data

### Run full project

Terminal 1 (Ollama):
```bash
ollama serve
ollama pull llama3.2:3b
```

Terminal 2 (Backend):
```bash
cd /Users/arijidas/Documents/Project/some
source .venv/bin/activate
pip install -r requirements.txt
uvicorn src.api:app --reload
```

Terminal 3 (Frontend):
```bash
cd /Users/arijidas/Documents/Project/some/frontend
npm install
npm run dev
```

Open UI: `http://127.0.0.1:5173`

## Git commands for Step 10

```bash
git add .
git commit -m "Step 10: add local auth, user history, CSV + text ingestion, settings, and reports"
git push
```


## Step 11: Quick testing with demo files (CSV + Text)

We added ready-to-use demo files:
- `data/demo_upload_transactions.csv`
- `data/demo_upload_statement_text.txt`

### Run web app

Terminal 1 (Backend):
```bash
cd /Users/arijidas/Documents/Project/some
source .venv/bin/activate
pip install -r requirements.txt
uvicorn src.api:app --reload
```

Terminal 2 (Frontend):
```bash
cd /Users/arijidas/Documents/Project/some/frontend
npm install
npm run dev
```

Open:
- `http://127.0.0.1:5173`

### Test in UI

1. Register/login in UI.
2. Upload CSV using `data/demo_upload_transactions.csv`.
3. Open `data/demo_upload_statement_text.txt`, copy all lines, paste into text box, click **Upload Text**.
4. Check summary, history table, forecast and AI insights.

### Optional API test (upload text directly)

```bash
curl -X POST "http://127.0.0.1:8000/user/upload-text" \
  -H "Authorization: Bearer <YOUR_TOKEN>" \
  -H "Content-Type: application/json" \
  -d @<(jq -Rs '{text: .}' /Users/arijidas/Documents/Project/some/data/demo_upload_statement_text.txt)
```
