import io
import re
from datetime import datetime

import pandas as pd
from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from fastapi.responses import StreamingResponse
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel, EmailStr
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas
from sqlalchemy.orm import Session

from src.auth import (
    authenticate_user,
    create_access_token,
    get_current_user,
    get_password_hash,
)
from src.db import get_db
from src.finance_engine import (
    add_category_column,
    compute_anomalies,
    compute_category_breakdown,
    compute_core_summary,
    compute_monthly_category_breakdown,
    compute_monthly_summary,
    compute_top_expenses,
    forecast_next_month,
    suggest_savings_target_plan,
)
from src.llm_ollama import DEFAULT_OLLAMA_MODEL, answer_finance_question, generate_finance_advice
from src.models import Transaction, User, UserSettings


auth_router = APIRouter(prefix="/auth", tags=["auth"])
user_router = APIRouter(prefix="/user", tags=["user"])


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    full_name: str = ""


class SettingsRequest(BaseModel):
    default_target_savings: float | None = None
    default_income_growth_pct: float | None = None
    ollama_model: str | None = None


class TextUploadRequest(BaseModel):
    text: str


DATE_PATTERNS = [
    re.compile(r"\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b"),
    re.compile(r"\b\d{1,2}\s+[A-Za-z]{3,9}\s+\d{2,4}\b"),
    re.compile(r"\b[A-Za-z]{3,9}\s+\d{1,2},?\s+\d{2,4}\b"),
]

AMOUNT_PATTERN = re.compile(r"(?<!\d)(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d{1,2})?(?!\d)")

DEBIT_HINTS = ["dr", "debit", "withdraw", "withdrawal", "purchase", "upi", "atm", "pos"]
CREDIT_HINTS = ["cr", "credit", "deposit", "salary", "interest", "refund", "cashback"]


def _ensure_user_settings(db: Session, user: User) -> UserSettings:
    settings = db.query(UserSettings).filter(UserSettings.user_id == user.id).first()
    if settings:
        return settings
    settings = UserSettings(user_id=user.id)
    db.add(settings)
    db.commit()
    db.refresh(settings)
    return settings


def _transactions_to_df(rows: list[Transaction]) -> pd.DataFrame:
    if not rows:
        return pd.DataFrame(
            columns=[
                "date",
                "description",
                "debit",
                "credit",
                "balance",
                "transaction_type",
                "reference",
            ]
        )

    df = pd.DataFrame(
        [
            {
                "date": r.date_text,
                "description": r.description,
                "debit": r.debit,
                "credit": r.credit,
                "balance": r.balance,
                "transaction_type": r.transaction_type,
                "reference": r.reference,
            }
            for r in rows
        ]
    )
    df["date"] = pd.to_datetime(df["date"], errors="coerce", dayfirst=True)
    df["debit"] = pd.to_numeric(df["debit"], errors="coerce").fillna(0.0)
    df["credit"] = pd.to_numeric(df["credit"], errors="coerce").fillna(0.0)
    return add_category_column(df)


def _get_user_df_or_400(db: Session, user: User) -> pd.DataFrame:
    rows = (
        db.query(Transaction)
        .filter(Transaction.user_id == user.id)
        .order_by(Transaction.created_at.asc())
        .all()
    )
    if not rows:
        raise HTTPException(status_code=400, detail="No transactions found for this user.")
    return _transactions_to_df(rows)


def _normalize_columns(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    df.columns = [str(c).strip().lower() for c in df.columns]
    rename_map = {
        "txn date": "date",
        "transaction date": "date",
        "narration": "description",
        "remarks": "description",
        "withdrawal": "debit",
        "deposit": "credit",
        "txn type": "transaction_type",
        "ref": "reference",
    }
    for old, new in rename_map.items():
        if old in df.columns and new not in df.columns:
            df = df.rename(columns={old: new})
    return df


def _safe_float(value) -> float:
    text = str(value).strip().replace(",", "")
    text = re.sub(r"[^0-9.\-]", "", text)
    if text in {"", "nan", "None"}:
        return 0.0
    try:
        return float(text)
    except ValueError:
        return 0.0


def _find_date(text: str) -> str | None:
    for pattern in DATE_PATTERNS:
        m = pattern.search(text)
        if m:
            return m.group(0)
    return None


def _extract_amounts(text: str) -> list[float]:
    # remove date substrings first so year/day tokens (e.g. 2026, 01, 02)
    # are not mistaken as monetary amounts
    scrubbed = text
    for pattern in DATE_PATTERNS:
        scrubbed = pattern.sub(" ", scrubbed)

    candidates = []
    for token in AMOUNT_PATTERN.findall(scrubbed):
        compact = token.replace(",", "")
        digits_only = re.sub(r"\D", "", compact)
        # skip very long numeric strings that are usually reference numbers
        if len(digits_only) > 7 and "." not in compact:
            continue
        amount = _safe_float(compact)
        if amount > 0:
            candidates.append(amount)
    # keep unique order
    seen = set()
    out = []
    for x in candidates:
        key = round(x, 2)
        if key in seen:
            continue
        seen.add(key)
        out.append(x)
    return out


def _parse_block_to_transaction(block_text: str) -> dict | None:
    date_text = _find_date(block_text)
    if not date_text:
        return None

    amounts = _extract_amounts(block_text)
    if not amounts:
        return None

    lower = block_text.lower()
    has_debit_hint = any(k in lower for k in DEBIT_HINTS)
    has_credit_hint = any(k in lower for k in CREDIT_HINTS)

    debit = 0.0
    credit = 0.0
    balance = 0.0

    if len(amounts) >= 3:
        # common statement shape: debit/credit/balance
        if has_credit_hint and not has_debit_hint:
            credit = amounts[-3]
        elif has_debit_hint and not has_credit_hint:
            debit = amounts[-3]
        else:
            debit = amounts[-3]
        balance = amounts[-1]
    elif len(amounts) == 2:
        txn_amount = amounts[0]
        balance = amounts[1]
        if has_credit_hint and not has_debit_hint:
            credit = txn_amount
        else:
            debit = txn_amount
    else:
        txn_amount = amounts[0]
        if has_credit_hint and not has_debit_hint:
            credit = txn_amount
        else:
            debit = txn_amount

    tx_type = "CREDIT" if credit > 0 else "DEBIT"

    return {
        "date": date_text,
        "description": block_text.strip(),
        "debit": debit,
        "credit": credit,
        "balance": balance,
        "transaction_type": tx_type,
        "reference": "TEXT",
    }


def _upsert_transactions_from_df(db: Session, user: User, df: pd.DataFrame, source_type: str) -> int:
    count = 0
    for _, row in df.iterrows():
        date_text = str(row.get("date", "")).strip()
        if not date_text:
            continue

        tx = Transaction(
            user_id=user.id,
            date_text=date_text,
            description=str(row.get("description", "")).strip(),
            debit=_safe_float(row.get("debit", 0.0)),
            credit=_safe_float(row.get("credit", 0.0)),
            balance=_safe_float(row.get("balance", 0.0)),
            transaction_type=str(row.get("transaction_type", "")).strip(),
            reference=str(row.get("reference", "")).strip(),
            source_type=source_type,
        )
        db.add(tx)
        count += 1

    db.commit()
    return count


def _parse_statement_text_to_df(text: str) -> pd.DataFrame:
    lines = [re.sub(r"\s+", " ", ln).strip() for ln in text.splitlines() if ln.strip()]
    if not lines:
        return pd.DataFrame()

    blocks: list[str] = []
    current: list[str] = []

    for line in lines:
        if _find_date(line):
            if current:
                blocks.append(" ".join(current))
                current = []
            current.append(line)
        else:
            if current:
                current.append(line)

    if current:
        blocks.append(" ".join(current))

    parsed = []
    for block in blocks:
        tx = _parse_block_to_transaction(block)
        if tx:
            parsed.append(tx)

    # fallback: try line-by-line if block parsing failed
    if not parsed:
        for line in lines:
            tx = _parse_block_to_transaction(line)
            if tx:
                parsed.append(tx)

    if not parsed:
        return pd.DataFrame()

    df = pd.DataFrame(parsed)
    df = df.drop_duplicates(subset=["date", "description", "debit", "credit", "balance"])
    return df.reset_index(drop=True)


def _render_summary_pdf(summary: dict, monthly: list[dict], categories: list[dict]) -> bytes:
    buffer = io.BytesIO()
    c = canvas.Canvas(buffer, pagesize=A4)
    y = 800

    c.setFont("Helvetica-Bold", 14)
    c.drawString(40, y, "Personal Finance Copilot - Summary Report")
    y -= 28

    c.setFont("Helvetica", 11)
    c.drawString(40, y, f"Total In: ₹{summary.get('total_in', 0):,.2f}")
    y -= 18
    c.drawString(40, y, f"Total Out: ₹{summary.get('total_out', 0):,.2f}")
    y -= 18
    c.drawString(40, y, f"Net Savings: ₹{summary.get('net_savings', 0):,.2f}")
    y -= 28

    c.setFont("Helvetica-Bold", 12)
    c.drawString(40, y, "Monthly Summary")
    y -= 18
    c.setFont("Helvetica", 10)
    for row in monthly[:12]:
        c.drawString(
            40,
            y,
            f"{row['month']}: In ₹{row['total_in']:,.2f} | Out ₹{row['total_out']:,.2f} | Net ₹{row['net_savings']:,.2f}",
        )
        y -= 15
        if y < 80:
            c.showPage()
            y = 800

    y -= 8
    c.setFont("Helvetica-Bold", 12)
    c.drawString(40, y, "Top Categories")
    y -= 18
    c.setFont("Helvetica", 10)
    for row in categories[:10]:
        c.drawString(40, y, f"{row['category']}: ₹{row['amount']:,.2f}")
        y -= 15
        if y < 80:
            c.showPage()
            y = 800

    c.save()
    buffer.seek(0)
    return buffer.read()


@auth_router.post("/register")
def register(payload: RegisterRequest, db: Session = Depends(get_db)):
    existing = db.query(User).filter(User.email == payload.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered.")

    user = User(
        email=payload.email,
        full_name=payload.full_name.strip(),
        hashed_password=get_password_hash(payload.password),
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    _ensure_user_settings(db, user)

    return {"ok": True, "user_id": user.id, "email": user.email}


@auth_router.post("/login")
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = authenticate_user(db, email=form_data.username, password=form_data.password)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid email or password")

    token = create_access_token(subject=user.email)
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {"id": user.id, "email": user.email, "full_name": user.full_name},
    }


@user_router.get("/me")
def me(current_user: User = Depends(get_current_user)):
    return {"id": current_user.id, "email": current_user.email, "full_name": current_user.full_name}


@user_router.get("/settings")
def get_settings(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    s = _ensure_user_settings(db, current_user)
    return {
        "default_target_savings": s.default_target_savings,
        "default_income_growth_pct": s.default_income_growth_pct,
        "ollama_model": s.ollama_model,
    }


@user_router.put("/settings")
def update_settings(
    payload: SettingsRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    s = _ensure_user_settings(db, current_user)
    if payload.default_target_savings is not None:
        s.default_target_savings = float(payload.default_target_savings)
    if payload.default_income_growth_pct is not None:
        s.default_income_growth_pct = float(payload.default_income_growth_pct)
    if payload.ollama_model is not None and payload.ollama_model.strip():
        s.ollama_model = payload.ollama_model.strip()
    s.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(s)
    return {
        "ok": True,
        "default_target_savings": s.default_target_savings,
        "default_income_growth_pct": s.default_income_growth_pct,
        "ollama_model": s.ollama_model,
    }


@user_router.post("/upload-csv")
def upload_csv(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        df = pd.read_csv(file.file)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Invalid CSV file: {exc}")

    df = _normalize_columns(df)
    if "date" not in df.columns or "description" not in df.columns:
        raise HTTPException(status_code=400, detail="CSV must include at least date and description columns")

    count = _upsert_transactions_from_df(db, current_user, df, source_type="csv")
    return {"ok": True, "inserted": count}


@user_router.post("/upload-text")
def upload_text_statement(
    payload: TextUploadRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    text = (payload.text or "").strip()
    if not text:
        raise HTTPException(status_code=400, detail="Text is required")

    df = _parse_statement_text_to_df(text)
    if df.empty:
        preview = text.splitlines()[:20]
        raise HTTPException(
            status_code=400,
            detail={
                "message": "No transactions could be parsed from text",
                "text_preview_lines": preview,
                "tips": [
                    "Make sure each transaction line contains a date and at least one amount.",
                    "Use formats like DD/MM/YYYY ... DR/CR amount balance.",
                    "Paste clean text without heavy formatting artifacts.",
                ],
            },
        )

    count = _upsert_transactions_from_df(db, current_user, df, source_type="text")
    return {
        "ok": True,
        "inserted": count,
        "text_preview_lines": text.splitlines()[:12],
        "parsed_preview": df.head(5).to_dict(orient="records"),
    }


@user_router.get("/transactions")
def get_transactions(
    limit: int = Query(default=200, ge=1, le=2000),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    rows = (
        db.query(Transaction)
        .filter(Transaction.user_id == current_user.id)
        .order_by(Transaction.created_at.desc())
        .limit(limit)
        .all()
    )
    return {
        "count": len(rows),
        "items": [
            {
                "id": r.id,
                "date": r.date_text,
                "description": r.description,
                "debit": r.debit,
                "credit": r.credit,
                "balance": r.balance,
                "transaction_type": r.transaction_type,
                "reference": r.reference,
                "source_type": r.source_type,
            }
            for r in rows
        ],
    }


@user_router.delete("/transactions")
def clear_transactions(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    db.query(Transaction).filter(Transaction.user_id == current_user.id).delete()
    db.commit()
    return {"ok": True}


@user_router.get("/summary")
def user_summary(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    df = _get_user_df_or_400(db, current_user)
    return compute_core_summary(df)


@user_router.get("/categories")
def user_categories(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    df = _get_user_df_or_400(db, current_user)
    return {"items": compute_category_breakdown(df)}


@user_router.get("/monthly")
def user_monthly(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    df = _get_user_df_or_400(db, current_user)
    return {"items": compute_monthly_summary(df)}


@user_router.get("/top-expenses")
def user_top_expenses(
    limit: int = Query(default=5, ge=1, le=50),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    df = _get_user_df_or_400(db, current_user)
    return {"items": compute_top_expenses(df, limit=limit)}


@user_router.get("/anomalies")
def user_anomalies(
    multiplier: float = Query(default=2.0, ge=1.0, le=10.0),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    df = _get_user_df_or_400(db, current_user)
    return compute_anomalies(df, multiplier=multiplier)


@user_router.get("/forecast")
def user_forecast(
    income_growth_pct: float = Query(default=0.0, ge=-100.0, le=200.0),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    df = _get_user_df_or_400(db, current_user)
    return forecast_next_month(df, income_growth_pct=income_growth_pct)


@user_router.get("/savings-plan")
def user_savings_plan(
    target_savings: float = Query(..., gt=0),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    df = _get_user_df_or_400(db, current_user)
    return suggest_savings_target_plan(df, target_savings=target_savings)


@user_router.get("/ai-insight")
def user_ai_insight(
    model: str | None = Query(default=None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    df = _get_user_df_or_400(db, current_user)
    settings = _ensure_user_settings(db, current_user)
    selected_model = model or settings.ollama_model or DEFAULT_OLLAMA_MODEL

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
        model=selected_model,
    )


@user_router.get("/ai-ask")
def user_ai_ask(
    question: str = Query(...),
    model: str | None = Query(default=None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    df = _get_user_df_or_400(db, current_user)
    settings = _ensure_user_settings(db, current_user)
    selected_model = model or settings.ollama_model or DEFAULT_OLLAMA_MODEL

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
        model=selected_model,
    )


@user_router.get("/reports/transactions.csv")
def user_transactions_csv(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    rows = (
        db.query(Transaction)
        .filter(Transaction.user_id == current_user.id)
        .order_by(Transaction.date_text.asc())
        .all()
    )
    if not rows:
        raise HTTPException(status_code=400, detail="No transactions found for report export")

    df = pd.DataFrame(
        [
            {
                "date": r.date_text,
                "description": r.description,
                "debit": r.debit,
                "credit": r.credit,
                "balance": r.balance,
                "transaction_type": r.transaction_type,
                "reference": r.reference,
                "source_type": r.source_type,
            }
            for r in rows
        ]
    )
    content = df.to_csv(index=False)
    return StreamingResponse(
        io.BytesIO(content.encode("utf-8")),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=transactions_report.csv"},
    )


@user_router.get("/reports/summary.pdf")
def user_summary_pdf(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    df = _get_user_df_or_400(db, current_user)
    summary = compute_core_summary(df)
    monthly = compute_monthly_summary(df)
    categories = compute_category_breakdown(df)
    pdf_bytes = _render_summary_pdf(summary, monthly, categories)
    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": "attachment; filename=finance_summary_report.pdf"},
    )
