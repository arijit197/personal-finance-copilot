"""MCP server for Personal Finance Copilot.

This exposes finance insights as MCP tools so an AI assistant can call them.
"""

from mcp.server.fastmcp import FastMCP

try:
    from src.finance_engine import (
        add_category_column,
        compute_anomalies,
        compute_category_breakdown,
        compute_core_summary,
        compute_monthly_category_breakdown,
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
        compute_monthly_category_breakdown,
        compute_monthly_summary,
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


DATA_PATH = "data/sample_bank_statement.csv"
mcp = FastMCP("personal-finance-copilot")


def _prepared_data(data_path: str = DATA_PATH):
    df = load_transactions(data_path)
    return add_category_column(df)


@mcp.tool()
def health() -> dict:
    """Simple health check for the MCP server."""
    return {"status": "ok"}


@mcp.tool()
def get_summary(data_path: str = DATA_PATH) -> dict:
    """Get total money in, total money out, and net savings."""
    df = _prepared_data(data_path)
    return compute_core_summary(df)


@mcp.tool()
def get_top_expenses(limit: int = 5, data_path: str = DATA_PATH) -> dict:
    """Get top highest debit transactions."""
    safe_limit = max(1, min(limit, 50))
    df = _prepared_data(data_path)
    return {"items": compute_top_expenses(df, limit=safe_limit)}


@mcp.tool()
def get_categories(data_path: str = DATA_PATH) -> dict:
    """Get category-wise debit totals."""
    df = _prepared_data(data_path)
    return {"items": compute_category_breakdown(df)}


@mcp.tool()
def get_monthly_summary(data_path: str = DATA_PATH) -> dict:
    """Get month-wise totals for in, out, and savings."""
    df = _prepared_data(data_path)
    return {"items": compute_monthly_summary(df)}


@mcp.tool()
def get_anomalies(multiplier: float = 2.0, data_path: str = DATA_PATH) -> dict:
    """Get unusual/high expenses using multiplier × median threshold."""
    safe_multiplier = min(max(multiplier, 1.0), 10.0)
    df = _prepared_data(data_path)
    return compute_anomalies(df, multiplier=safe_multiplier)


@mcp.tool()
def get_ai_finance_advice(
    model: str = DEFAULT_OLLAMA_MODEL,
    data_path: str = DATA_PATH,
) -> dict:
    """Generate simple AI finance advice from summary + category + anomaly insights."""
    df = _prepared_data(data_path)
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


@mcp.tool()
def ask_ai_finance_question(
    question: str,
    model: str = DEFAULT_OLLAMA_MODEL,
    data_path: str = DATA_PATH,
) -> dict:
    """Ask a direct custom question about finance data and get AI answer."""
    df = _prepared_data(data_path)
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


if __name__ == "__main__":
    mcp.run()
