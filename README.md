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

### Run MCP server and use AI advice tool

```bash
python src/mcp_server.py
```

Use tool:
- `get_ai_finance_advice`

## Git commands for Step 7

```bash
git add .
git commit -m "Step 7: add Ollama-based AI finance advice in API and MCP"
git push
```
