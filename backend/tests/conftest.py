import os
import tempfile

import pytest

_tmp = tempfile.mkdtemp()
os.environ.update({
    "DATABASE_URL": f"sqlite:///{_tmp}/test.db",
    "JWT_SECRET": "test-secret-0123456789abcdef0123456789",
    "SUPERADMIN_EMAIL": "owner@paph-test.com",
    "SUPERADMIN_PASSWORD": "OwnerPass123",
    "SUPERADMIN_NAME": "Test Owner",
    "SEED_SAMPLE_DATA": "true",
    "PUBLIC_RATE_LIMIT": "1000",
    "ENABLE_SCHEDULER": "false",
})

from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402


def login(client, email, password):
    r = client.post("/api/auth/login", json={"email": email, "password": password})
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


@pytest.fixture(scope="session")
def client():
    with TestClient(app) as c:
        yield c


@pytest.fixture(scope="session")
def admin_headers(client):
    return login(client, "owner@paph-test.com", "OwnerPass123")


@pytest.fixture(scope="session")
def staff(client, admin_headers):
    """One salesperson and one agent (plus the Owner)."""
    out = {"ADMIN": admin_headers}
    for role, email in (("SALES", "sales@paph-test.com"), ("AGENT", "agent@paph-test.com")):
        r = client.post("/api/users", json={"email": email, "full_name": f"Test {role.title()}", "role": role, "password": "StaffPass123"},
                        headers=admin_headers)
        assert r.status_code == 201, r.text
        out[role] = login(client, email, "StaffPass123")
    return out
