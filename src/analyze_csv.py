from finance_engine import (
    add_category_column,
    compute_anomalies,
    compute_category_breakdown,
    compute_core_summary,
    compute_monthly_summary,
    compute_top_expenses,
    load_transactions,
)


if __name__ == "__main__":
    transactions = load_transactions("data/sample_bank_statement.csv")
    transactions = add_category_column(transactions)

    summary = compute_core_summary(transactions)
    top_expenses = compute_top_expenses(transactions)
    categories = compute_category_breakdown(transactions)
    monthly = compute_monthly_summary(transactions)
    anomaly_info = compute_anomalies(transactions)

    print("=== Personal Finance Copilot: Step 4 Insights ===")
    print("=== Core Money Summary ===")
    print(f"Total Money In  : ₹{summary['total_in']:,.2f}")
    print(f"Total Money Out : ₹{summary['total_out']:,.2f}")
    print(f"Net Savings     : ₹{summary['net_savings']:,.2f}")

    print("\nTop 5 Expenses:")
    for row in top_expenses:
        print(f"- {row['date']} | {row['description']} | ₹{row['amount']:,.2f}")

    print("\nCategory-wise Spending:")
    for row in categories:
        print(f"- {row['category']:<13}₹{row['amount']:,.2f}")

    print("\nMonthly Summary:")
    for row in monthly:
        print(
            f"- {row['month']} | In: ₹{row['total_in']:,.2f} | "
            f"Out: ₹{row['total_out']:,.2f} | Net: ₹{row['net_savings']:,.2f}"
        )

    print("\nAnomaly Detection:")
    print(f"- Baseline (median expense): ₹{anomaly_info['baseline']:,.2f}")
    print(f"- Threshold ({anomaly_info['multiplier']:.1f}x): ₹{anomaly_info['threshold']:,.2f}")
    if not anomaly_info["anomalies"]:
        print("- No unusual expenses detected in this dataset.")
    else:
        print("- Unusual/high expenses:")
        for row in anomaly_info["anomalies"]:
            print(
                f"  • {row['date']} | {row['description']} | "
                f"Category: {row['category']} | ₹{row['amount']:,.2f}"
            )
