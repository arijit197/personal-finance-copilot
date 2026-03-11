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


def print_summary(df: pd.DataFrame) -> None:
    total_in = float(df["credit"].sum())
    total_out = float(df["debit"].sum())
    net = total_in - total_out

    print("=== Core Money Summary ===")
    print(f"Total Money In  : ₹{total_in:,.2f}")
    print(f"Total Money Out : ₹{total_out:,.2f}")
    print(f"Net Savings     : ₹{net:,.2f}")

    top_expenses = (
        df[df["debit"] > 0]
        .sort_values(by="debit", ascending=False)
        [["date", "description", "debit"]]
        .head(5)
    )

    print("\nTop 5 Expenses:")
    for _, row in top_expenses.iterrows():
        print(f"- {row['date']} | {row['description']} | ₹{row['debit']:,.2f}")


def print_category_breakdown(df: pd.DataFrame) -> None:
    category_totals = (
        df[df["debit"] > 0]
        .groupby("category", as_index=False)["debit"]
        .sum()
        .sort_values(by="debit", ascending=False)
    )

    print("\nCategory-wise Spending:")
    for _, row in category_totals.iterrows():
        print(f"- {row['category']:<12} ₹{row['debit']:,.2f}")


if __name__ == "__main__":
    transactions = load_transactions("data/sample_bank_statement.csv")
    transactions = add_category_column(transactions)

    print("=== Personal Finance Copilot: Step 3 Summary ===")
    print_summary(transactions)
    print_category_breakdown(transactions)
