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
