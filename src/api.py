from fastapi import FastAPI, Query

try:
    from src.finance_engine import (
        add_category_column,
        compute_anomalies,
        compute_category_breakdown,
        compute_core_summary,
        compute_monthly_summary,
        compute_top_expenses,
        load_transactions,
    )
except ModuleNotFoundError:
    from finance_engine import (
        add_category_column,
        compute_anomalies,
        compute_category_breakdown,
        compute_core_summary,
        compute_monthly_summary,
        compute_top_expenses,
        load_transactions,
    )


app = FastAPI(title="Personal Finance Copilot API", version="0.1.0")
DATA_PATH = "data/sample_bank_statement.csv"


def get_prepared_data():
    df = load_transactions(DATA_PATH)
    return add_category_column(df)


@app.get("/health")
def health_check():
    return {"status": "ok"}


@app.get("/summary")
def get_summary():
    df = get_prepared_data()
    return compute_core_summary(df)


@app.get("/top-expenses")
def get_top_expenses(limit: int = Query(default=5, ge=1, le=50)):
    df = get_prepared_data()
    return {"items": compute_top_expenses(df, limit=limit)}


@app.get("/categories")
def get_categories():
    df = get_prepared_data()
    return {"items": compute_category_breakdown(df)}


@app.get("/monthly")
def get_monthly_summary():
    df = get_prepared_data()
    return {"items": compute_monthly_summary(df)}


@app.get("/anomalies")
def get_anomalies(multiplier: float = Query(default=2.0, ge=1.0, le=10.0)):
    df = get_prepared_data()
    return compute_anomalies(df, multiplier=multiplier)
