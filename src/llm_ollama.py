"""Local LLM helper using Ollama.

This keeps AI generation local and free (after model download).
"""

from __future__ import annotations

import json
import os
import re
import urllib.error
import urllib.request


DEFAULT_OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://127.0.0.1:11434")
DEFAULT_OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "llama3.2:3b")

MONTH_ALIASES = {
    "jan": "01",
    "january": "01",
    "feb": "02",
    "february": "02",
    "mar": "03",
    "march": "03",
    "apr": "04",
    "april": "04",
    "may": "05",
    "jun": "06",
    "june": "06",
    "jul": "07",
    "july": "07",
    "aug": "08",
    "august": "08",
    "sep": "09",
    "sept": "09",
    "september": "09",
    "oct": "10",
    "october": "10",
    "nov": "11",
    "november": "11",
    "dec": "12",
    "december": "12",
}


def _build_finance_prompt(
    summary: dict,
    categories: list[dict],
    monthly: list[dict],
    monthly_categories: list[dict],
    anomalies: dict,
) -> str:
    lines = [
        "You are a personal finance coach.",
        "Give short, practical advice in simple language.",
        "Use INR (₹) while talking about money.",
        "Output format:",
        "1) One-line health summary",
        "2) Top 3 insights",
        "3) Top 3 action steps for next month",
        "",
        f"Core summary: {summary}",
        f"Category breakdown: {categories}",
        f"Monthly summary: {monthly}",
        f"Monthly category breakdown: {monthly_categories}",
        f"Anomalies: {anomalies}",
    ]
    return "\n".join(lines)


def _build_finance_question_prompt(
    question: str,
    summary: dict,
    categories: list[dict],
    monthly: list[dict],
    monthly_categories: list[dict],
    anomalies: dict,
) -> str:
    lines = [
        "You are a personal finance assistant.",
        "Answer the user's question based only on the data context below.",
        "If data is not enough, say that clearly and suggest what data is missing.",
        "Do not claim month data is missing if it is present in monthly summaries.",
        "Keep answer short, practical, and beginner-friendly.",
        "Use INR (₹) for money values.",
        "",
        f"Core summary: {summary}",
        f"Category breakdown: {categories}",
        f"Monthly summary: {monthly}",
        f"Monthly category breakdown: {monthly_categories}",
        f"Anomalies: {anomalies}",
        "",
        f"User question: {question}",
    ]
    return "\n".join(lines)


def _extract_year_month(question: str, monthly: list[dict]) -> str | None:
    q = question.lower()

    direct = re.search(r"(20\d{2})-(0[1-9]|1[0-2])", q)
    if direct:
        return f"{direct.group(1)}-{direct.group(2)}"

    detected_month_num = None
    for token, month_num in MONTH_ALIASES.items():
        if re.search(rf"\b{re.escape(token)}\b", q):
            detected_month_num = month_num
            break

    if not detected_month_num:
        return None

    years = sorted({str(row.get("month", "")).split("-")[0] for row in monthly if row.get("month")})
    year = years[0] if len(years) == 1 and years[0].isdigit() else None

    if not year:
        found_year = re.search(r"(20\d{2})", q)
        if found_year:
            year = found_year.group(1)

    if not year:
        # Fallback: if only one month exists with same month number, use it
        matched = [
            str(row.get("month"))
            for row in monthly
            if str(row.get("month", "")).endswith(f"-{detected_month_num}")
        ]
        if len(matched) == 1:
            return matched[0]
        return None

    return f"{year}-{detected_month_num}"


def _maybe_answer_monthly_category_question(
    question: str,
    monthly: list[dict],
    monthly_categories: list[dict],
    model: str,
) -> dict | None:
    q = question.lower()
    wants_category = "category" in q and ("wise" in q or "by" in q)
    if not wants_category:
        return None

    year_month = _extract_year_month(question, monthly)
    if not year_month:
        return None

    rows = [r for r in monthly_categories if str(r.get("month")) == year_month]
    if not rows:
        return {
            "ok": True,
            "model": model,
            "base_url": DEFAULT_OLLAMA_BASE_URL,
            "advice": f"I could not find category-wise expense rows for {year_month} in the current dataset.",
            "question": question,
            "source": "rule-based",
        }

    rows = sorted(rows, key=lambda x: float(x.get("amount", 0.0)), reverse=True)
    total = sum(float(r.get("amount", 0.0)) for r in rows)

    lines = [f"Category-wise expenses for {year_month}:"]
    for row in rows:
        lines.append(f"- {row['category']}: ₹{float(row['amount']):,.2f}")
    lines.append(f"Total debit spend in {year_month}: ₹{total:,.2f}")

    return {
        "ok": True,
        "model": model,
        "base_url": DEFAULT_OLLAMA_BASE_URL,
        "advice": "\n".join(lines),
        "question": question,
        "source": "rule-based",
    }


def ask_ollama(prompt: str, model: str = DEFAULT_OLLAMA_MODEL) -> dict:
    payload = {
        "model": model,
        "messages": [
            {"role": "user", "content": prompt},
        ],
        "stream": False,
    }

    req = urllib.request.Request(
        url=f"{DEFAULT_OLLAMA_BASE_URL}/api/chat",
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )

    try:
        with urllib.request.urlopen(req, timeout=90) as response:
            body = json.loads(response.read().decode("utf-8"))
            content = body.get("message", {}).get("content", "").strip()
            return {
                "ok": True,
                "model": model,
                "base_url": DEFAULT_OLLAMA_BASE_URL,
                "advice": content,
            }
    except urllib.error.URLError as exc:
        return {
            "ok": False,
            "model": model,
            "base_url": DEFAULT_OLLAMA_BASE_URL,
            "advice": "",
            "error": (
                "Could not connect to Ollama. Start it with 'ollama serve' "
                "and ensure model is downloaded using 'ollama pull llama3.2:3b'."
            ),
            "details": str(exc),
        }


def generate_finance_advice(
    summary: dict,
    categories: list[dict],
    monthly: list[dict],
    monthly_categories: list[dict],
    anomalies: dict,
    model: str = DEFAULT_OLLAMA_MODEL,
) -> dict:
    prompt = _build_finance_prompt(
        summary=summary,
        categories=categories,
        monthly=monthly,
        monthly_categories=monthly_categories,
        anomalies=anomalies,
    )
    return ask_ollama(prompt=prompt, model=model)


def answer_finance_question(
    question: str,
    summary: dict,
    categories: list[dict],
    monthly: list[dict],
    monthly_categories: list[dict],
    anomalies: dict,
    model: str = DEFAULT_OLLAMA_MODEL,
) -> dict:
    clean_question = (question or "").strip()
    if not clean_question:
        return {
            "ok": False,
            "model": model,
            "base_url": DEFAULT_OLLAMA_BASE_URL,
            "advice": "",
            "error": "Question is required.",
        }

    quick_answer = _maybe_answer_monthly_category_question(
        question=clean_question,
        monthly=monthly,
        monthly_categories=monthly_categories,
        model=model,
    )
    if quick_answer is not None:
        return quick_answer

    prompt = _build_finance_question_prompt(
        question=clean_question,
        summary=summary,
        categories=categories,
        monthly=monthly,
        monthly_categories=monthly_categories,
        anomalies=anomalies,
    )
    response = ask_ollama(prompt=prompt, model=model)
    response["question"] = clean_question
    return response
