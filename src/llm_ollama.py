"""Local LLM helper using Ollama.

This keeps AI generation local and free (after model download).
"""

from __future__ import annotations

import json
import os
import urllib.error
import urllib.request


DEFAULT_OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://127.0.0.1:11434")
DEFAULT_OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "llama3.2:3b")


def _build_finance_prompt(
    summary: dict,
    categories: list[dict],
    monthly: list[dict],
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
        f"Anomalies: {anomalies}",
    ]
    return "\n".join(lines)


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
    anomalies: dict,
    model: str = DEFAULT_OLLAMA_MODEL,
) -> dict:
    prompt = _build_finance_prompt(summary, categories, monthly, anomalies)
    return ask_ollama(prompt=prompt, model=model)
