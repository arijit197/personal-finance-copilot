import pandas as pd


CATEGORY_RULES = {
    "Food": ["swiggy", "restaurant", "coffee", "grocery", "bigbasket"],
    "Transport": ["uber", "fuel", "metro", "bus", "taxi"],
    "Utilities": ["electricity", "internet", "mobile", "bill", "recharge"],
    "Shopping": ["amazon", "shopping", "flipkart"],
    "Entertainment": ["movie", "bookmyshow", "netflix", "spotify"],
    "Housing": ["rent"],
    "Investment": ["sip", "mutual fund", "investment"],
    "Health": ["pharmacy", "medical", "hospital"],
    "Cash": ["atm", "cash withdrawal"],
}


def load_transactions(csv_path: str) -> pd.DataFrame:
    df = pd.read_csv(csv_path)
    df["date"] = pd.to_datetime(df["date"], errors="coerce")
    df["debit"] = pd.to_numeric(df["debit"], errors="coerce").fillna(0.0)
    df["credit"] = pd.to_numeric(df["credit"], errors="coerce").fillna(0.0)
    return df


def categorize_transaction(description: str) -> str:
    text = str(description).lower()
    for category, keywords in CATEGORY_RULES.items():
        if any(keyword in text for keyword in keywords):
            return category
    return "Other"


def add_category_column(df: pd.DataFrame) -> pd.DataFrame:
    result = df.copy()
    result["category"] = result["description"].apply(categorize_transaction)
    return result


def compute_core_summary(df: pd.DataFrame) -> dict:
    total_in = float(df["credit"].sum())
    total_out = float(df["debit"].sum())
    return {
        "total_in": total_in,
        "total_out": total_out,
        "net_savings": total_in - total_out,
    }


def compute_top_expenses(df: pd.DataFrame, limit: int = 5) -> list[dict]:
    rows = (
        df[df["debit"] > 0]
        .sort_values(by="debit", ascending=False)
        [["date", "description", "debit"]]
        .head(limit)
    )
    output = []
    for _, row in rows.iterrows():
        output.append(
            {
                "date": row["date"].strftime("%Y-%m-%d") if pd.notna(row["date"]) else "N/A",
                "description": row["description"],
                "amount": float(row["debit"]),
            }
        )
    return output


def compute_category_breakdown(df: pd.DataFrame) -> list[dict]:
    category_totals = (
        df[df["debit"] > 0]
        .groupby("category", as_index=False)["debit"]
        .sum()
        .sort_values(by="debit", ascending=False)
    )
    return [
        {"category": row["category"], "amount": float(row["debit"])}
        for _, row in category_totals.iterrows()
    ]


def compute_monthly_summary(df: pd.DataFrame) -> list[dict]:
    monthly = (
        df.assign(month=df["date"].dt.to_period("M").astype(str))
        .groupby("month", as_index=False)
        .agg(total_in=("credit", "sum"), total_out=("debit", "sum"))
    )
    monthly["net_savings"] = monthly["total_in"] - monthly["total_out"]
    return [
        {
            "month": row["month"],
            "total_in": float(row["total_in"]),
            "total_out": float(row["total_out"]),
            "net_savings": float(row["net_savings"]),
        }
        for _, row in monthly.iterrows()
    ]


def compute_anomalies(df: pd.DataFrame, multiplier: float = 2.0) -> dict:
    debit_txns = df[df["debit"] > 0].copy()
    if debit_txns.empty:
        return {
            "baseline": 0.0,
            "threshold": 0.0,
            "multiplier": multiplier,
            "anomalies": [],
        }

    baseline = float(debit_txns["debit"].median())
    threshold = baseline * multiplier
    anomalies_df = debit_txns[debit_txns["debit"] >= threshold].sort_values(
        by="debit", ascending=False
    )

    anomalies = []
    for _, row in anomalies_df.iterrows():
        anomalies.append(
            {
                "date": row["date"].strftime("%Y-%m-%d") if pd.notna(row["date"]) else "N/A",
                "description": row["description"],
                "category": row["category"],
                "amount": float(row["debit"]),
            }
        )

    return {
        "baseline": baseline,
        "threshold": threshold,
        "multiplier": multiplier,
        "anomalies": anomalies,
    }
