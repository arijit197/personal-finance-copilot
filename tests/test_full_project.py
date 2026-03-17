import os
import tempfile
import unittest

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from src.api import app
from src.db import Base, get_db


class TestFullProjectFlow(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temp_db_dir = tempfile.TemporaryDirectory()
        cls.db_path = os.path.join(cls.temp_db_dir.name, "test_finance_copilot.db")
        cls.engine = create_engine(
            f"sqlite:///{cls.db_path}",
            connect_args={"check_same_thread": False},
        )
        cls.TestSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=cls.engine)
        Base.metadata.create_all(bind=cls.engine)

        def override_get_db():
            db = cls.TestSessionLocal()
            try:
                yield db
            finally:
                db.close()

        app.dependency_overrides[get_db] = override_get_db
        cls.client = TestClient(app)

    @classmethod
    def tearDownClass(cls):
        app.dependency_overrides.clear()
        cls.temp_db_dir.cleanup()

    def test_01_health(self):
        res = self.client.get("/health")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json().get("status"), "ok")

    def test_02_end_to_end_user_flow(self):
        email = "autotest_user@example.com"
        password = "pass12345"

        reg = self.client.post(
            "/auth/register",
            json={"email": email, "password": password, "full_name": "Auto Test User"},
        )
        self.assertEqual(reg.status_code, 200)

        duplicate = self.client.post(
            "/auth/register",
            json={"email": email, "password": password, "full_name": "Auto Test User"},
        )
        self.assertEqual(duplicate.status_code, 400)

        bad_login = self.client.post(
            "/auth/login",
            data={"username": email, "password": "wrong-pass"},
        )
        self.assertEqual(bad_login.status_code, 401)

        login = self.client.post(
            "/auth/login",
            data={"username": email, "password": password},
        )
        self.assertEqual(login.status_code, 200)
        token = login.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        with open("data/demo_upload_transactions.csv", "rb") as f:
            up_csv = self.client.post(
                "/user/upload-csv",
                headers=headers,
                files={"file": ("demo_upload_transactions.csv", f, "text/csv")},
            )
        self.assertEqual(up_csv.status_code, 200)
        self.assertGreaterEqual(up_csv.json().get("inserted", 0), 1)

        with open("data/demo_upload_statement_text.txt", "r", encoding="utf-8") as f:
            statement_text = f.read()
        up_text = self.client.post(
            "/user/upload-text",
            headers=headers,
            json={"text": statement_text},
        )
        self.assertEqual(up_text.status_code, 200)
        self.assertGreaterEqual(up_text.json().get("inserted", 0), 1)

        transactions = self.client.get("/user/transactions?limit=20", headers=headers)
        self.assertEqual(transactions.status_code, 200)
        self.assertGreater(transactions.json().get("count", 0), 0)

        summary = self.client.get("/user/summary", headers=headers)
        self.assertEqual(summary.status_code, 200)
        self.assertIn("net_savings", summary.json())

        categories = self.client.get("/user/categories", headers=headers)
        self.assertEqual(categories.status_code, 200)
        self.assertIsInstance(categories.json().get("items"), list)

        monthly = self.client.get("/user/monthly", headers=headers)
        self.assertEqual(monthly.status_code, 200)
        self.assertIsInstance(monthly.json().get("items"), list)

        top_expenses = self.client.get("/user/top-expenses?limit=5", headers=headers)
        self.assertEqual(top_expenses.status_code, 200)
        self.assertIsInstance(top_expenses.json().get("items"), list)

        anomalies = self.client.get("/user/anomalies?multiplier=2", headers=headers)
        self.assertEqual(anomalies.status_code, 200)
        self.assertIn("anomalies", anomalies.json())

        forecast = self.client.get("/user/forecast?income_growth_pct=5", headers=headers)
        self.assertEqual(forecast.status_code, 200)
        self.assertIn("ok", forecast.json())

        plan = self.client.get("/user/savings-plan?target_savings=30000", headers=headers)
        self.assertEqual(plan.status_code, 200)
        self.assertIn("cut_needed", plan.json())

        settings_put = self.client.put(
            "/user/settings",
            headers=headers,
            json={
                "default_target_savings": 42000,
                "default_income_growth_pct": 7,
                "ollama_model": "llama3.2:3b",
            },
        )
        self.assertEqual(settings_put.status_code, 200)

        settings_get = self.client.get("/user/settings", headers=headers)
        self.assertEqual(settings_get.status_code, 200)
        self.assertEqual(int(settings_get.json().get("default_target_savings", 0)), 42000)

        ai = self.client.get(
            "/user/ai-ask?question=How can I reduce food expenses?",
            headers=headers,
        )
        self.assertEqual(ai.status_code, 200)
        self.assertIn("ok", ai.json())

        report_csv = self.client.get("/user/reports/transactions.csv", headers=headers)
        self.assertEqual(report_csv.status_code, 200)
        self.assertIn("text/csv", report_csv.headers.get("content-type", ""))

        report_pdf = self.client.get("/user/reports/summary.pdf", headers=headers)
        self.assertEqual(report_pdf.status_code, 200)
        self.assertIn("application/pdf", report_pdf.headers.get("content-type", ""))
        self.assertTrue(report_pdf.content.startswith(b"%PDF"))

        clear = self.client.delete("/user/transactions", headers=headers)
        self.assertEqual(clear.status_code, 200)

        no_data_summary = self.client.get("/user/summary", headers=headers)
        self.assertEqual(no_data_summary.status_code, 400)


if __name__ == "__main__":
    unittest.main(verbosity=2)
