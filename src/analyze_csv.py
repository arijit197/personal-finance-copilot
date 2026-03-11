import pandas as pd


def load_transactions(csv_path: str) -> pd.DataFrame:
    df = pd.read_csv(csv_path)
    df["debit"] = pd.to_numeric(df["debit"], errors="coerce").fillna(0.0)
    df["credit"] = pd.to_numeric(df["credit"], errors="coerce").fillna(0.0)
    return df


def print_summary(df: pd.DataFrame) -> None:
    total_in = float(df["credit"].sum())
    total_out = float(df["debit"].sum())
    net = total_in - total_out

    print("=== Personal Finance Copilot: Step 2 Summary ===")
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


if __name__ == "__main__":
    transactions = load_transactions("data/sample_bank_statement.csv")
    print_summary(transactions)
