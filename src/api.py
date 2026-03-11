from fastapi import FastAPI, Query

try:
    from src.finance_engine import (
        add_category_column,
        compute_anomalies,
        compute_category_breakdown,
        compute_core_summary,
        forecast_next_month,
        compute_monthly_category_breakdown,
        compute_monthly_summary,
        suggest_savings_target_plan,
        compute_top_expenses,
        load_transactions,
    )
except ModuleNotFoundError:
    from finance_engine import (
        add_category_column,
        compute_anomalies,
        compute_category_breakdown,
        compute_core_summary,
        forecast_next_month,
        compute_monthly_category_breakdown,
        compute_monthly_summary,
        suggest_savings_target_plan,
        compute_top_expenses,
        load_transactions,
    )

try:
    from src.llm_ollama import (
        DEFAULT_OLLAMA_MODEL,
        answer_finance_question,
        generate_finance_advice,
    )
except ModuleNotFoundError:
    from llm_ollama import DEFAULT_OLLAMA_MODEL, answer_finance_question, generate_finance_advice


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


@app.get("/forecast")
def get_forecast(income_growth_pct: float = Query(default=0.0, ge=-100.0, le=200.0)):
    df = get_prepared_data()
    return forecast_next_month(df, income_growth_pct=income_growth_pct)


@app.get("/savings-plan")
def get_savings_plan(target_savings: float = Query(..., gt=0.0)):
    df = get_prepared_data()
    return suggest_savings_target_plan(df, target_savings=target_savings)


def build_ai_insight(model: str = DEFAULT_OLLAMA_MODEL):
    df = get_prepared_data()
    summary = compute_core_summary(df)
    categories = compute_category_breakdown(df)
    monthly = compute_monthly_summary(df)
    monthly_categories = compute_monthly_category_breakdown(df)
    anomalies = compute_anomalies(df)

    return generate_finance_advice(
        summary=summary,
        categories=categories,
        monthly=monthly,
        monthly_categories=monthly_categories,
        anomalies=anomalies,
        model=model,
    )


def build_ai_answer(question: str, model: str = DEFAULT_OLLAMA_MODEL):
    df = get_prepared_data()
    summary = compute_core_summary(df)
    categories = compute_category_breakdown(df)
    monthly = compute_monthly_summary(df)
    monthly_categories = compute_monthly_category_breakdown(df)
    anomalies = compute_anomalies(df)

    return answer_finance_question(
        question=question,
        summary=summary,
        categories=categories,
        monthly=monthly,
        monthly_categories=monthly_categories,
        anomalies=anomalies,
        model=model,
    )


@app.get("/ai-insight")
def get_ai_insight(model: str = Query(default=DEFAULT_OLLAMA_MODEL)):
    return build_ai_insight(model=model)


@app.get("/ai-ask")
def ask_ai(
    question: str = Query(..., description="Ask a custom finance question"),
    model: str = Query(default=DEFAULT_OLLAMA_MODEL),
):
    return build_ai_answer(question=question, model=model)
