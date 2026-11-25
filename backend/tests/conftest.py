import os
import tempfile

import pytest

_tmp = tempfile.mkdtemp()
os.environ.update({
    "DATABASE_URL": f"sqlite:///{_tmp}/test.db",
    "JWT_SECRET": "test-secret-0123456789abcdef0123456789",
    "SUPERADMIN_EMAIL": "admin@pulse-test.com",
    "SUPERADMIN_PASSWORD": "AdminPass123",
    "ENABLE_SCHEDULER": "false",
    "SEED_SAMPLE_DATA": "true",
    "REPORTS_DIR": f"{_tmp}/reports",
    "ANTHROPIC_API_KEY": "",
})

from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402


@pytest.fixture(scope="session")
def client():
    with TestClient(app) as c:
        yield c


@pytest.fixture(scope="session")
def admin_headers(client):
    r = client.post("/api/auth/login", json={"email": "admin@pulse-test.com", "password": "AdminPass123"})
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['access_token']}"}
