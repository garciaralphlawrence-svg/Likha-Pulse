"""End-to-end API tests: auth, RBAC, data-driven dashboard, feedback workflow, review audit, reports, settings."""


def test_health(client):
    assert client.get("/api/health").json()["status"] == "ok"


def test_login_rejects_bad_password(client):
    assert client.post("/api/auth/login", json={"email": "admin@pulse-test.com", "password": "wrong-pass1"}).status_code == 401


def test_requires_auth(client):
    assert client.get("/api/dashboard").status_code == 401


def test_dashboard_numbers_come_from_database(client, admin_headers):
    d = client.get("/api/dashboard?date_from=2000-01-01", headers=admin_headers).json()
    k = d["kpis"]
    assert k["total"] > 50, "sample data should be seeded"
    assert k["positive"] + k["neutral"] + k["negative"] == k["total"]
    assert k["sample_count"] == k["total"]  # nothing real connected in tests
    listed = client.get("/api/feedback?date_from=2000-01-01&page_size=1", headers=admin_headers).json()["total"]
    assert listed == k["total"]
    neg = client.get("/api/dashboard?date_from=2000-01-01&sentiment=negative", headers=admin_headers).json()["kpis"]
    assert neg["total"] == k["negative"]


def test_manual_feedback_analysis_and_duplicates(client, admin_headers):
    body = {"content": "Okay naman ang service pero sobrang tagal ng response.", "author": "test-user-1"}
    r = client.post("/api/feedback", json=body, headers=admin_headers)
    assert r.status_code == 201, r.text
    fb = r.json()
    assert fb["sentiment"] == "negative" and fb["emotion"] == "frustration" and fb["topic"] == "Response Time"
    assert fb["reason"] and fb["recommended_action"] and fb["priority_reason"]
    assert client.post("/api/feedback", json=body, headers=admin_headers).status_code == 409


def test_human_review_keeps_ai_prediction(client, admin_headers):
    fb = client.post("/api/feedback", json={"content": "Wow, excellent service! I waited for five hours.", "author": "u2"},
                     headers=admin_headers).json()
    assert fb["review_status"] == "pending_review" and fb["possible_sarcasm"]
    ai_level = fb["priority"]
    new_level = "critical" if ai_level != "critical" else "low"
    r = client.post(f"/api/feedback/{fb['id']}/review", json={"priority": new_level, "note": "Confirmed sarcasm"}, headers=admin_headers).json()
    assert r["priority"] == new_level and r["ai"]["priority"] == ai_level  # AI prediction preserved
    assert r["review_status"] == "reviewed" and r["reviews"][0]["original"] == ai_level
    logs = client.get("/api/audit?action=feedback_reviewed", headers=admin_headers).json()
    assert logs and logs[0]["entity_id"] == fb["id"]


def test_rbac_viewer_cannot_manage(client, admin_headers):
    r = client.post("/api/users", json={"email": "viewer@pulse-test.com", "full_name": "View Only", "role": "VIEWER", "password": "ViewerPass123"},
                    headers=admin_headers)
    assert r.status_code == 201, r.text
    tok = client.post("/api/auth/login", json={"email": "viewer@pulse-test.com", "password": "ViewerPass123"}).json()["access_token"]
    h = {"Authorization": f"Bearer {tok}"}
    assert client.get("/api/dashboard", headers=h).status_code == 200
    assert client.get("/api/feedback", headers=h).status_code == 403
    assert client.get("/api/users", headers=h).status_code == 403
    assert client.put("/api/settings/sentiment_thresholds", json={"negative_max": -10}, headers=h).status_code == 403


def test_weak_password_rejected(client, admin_headers):
    r = client.post("/api/users", json={"email": "weak@pulse-test.com", "full_name": "Weak", "role": "ANALYST", "password": "short"}, headers=admin_headers)
    assert r.status_code == 400


def test_settings_validation_and_claude_requires_key(client, admin_headers):
    assert client.put("/api/settings/sentiment_thresholds", json={"negative_max": 30, "positive_min": 10}, headers=admin_headers).status_code == 400
    assert client.put("/api/settings/ai_provider", json={"provider": "claude"}, headers=admin_headers).status_code == 400
    s = client.get("/api/settings", headers=admin_headers).json()
    assert s["ai_provider"]["api_key_set"] is False


def test_integrations_report_not_connected(client, admin_headers):
    items = {i["code"]: i for i in client.get("/api/integrations", headers=admin_headers).json()}
    assert items["google_business"]["status"] == "not_connected"
    assert items["facebook_page"]["missing"]
    r = client.post("/api/integrations/messenger/sync", headers=admin_headers).json()
    assert r["status"] == "not_connected" and r["added"] == 0


def test_insights_use_real_numbers(client, admin_headers):
    ins = client.post("/api/insights/generate?date_from=2000-01-01", headers=admin_headers).json()
    total = ins["aggregates"]["current"]["total"]
    assert str(total) in ins["summary"]["overall"]
    assert "sample messages" in ins["summary"]["overall"]


def test_reports_all_formats(client, admin_headers):
    for fmt in ("pdf", "xlsx", "csv"):
        r = client.post("/api/reports?date_from=2000-01-01", json={"report_type": "overall", "file_format": fmt}, headers=admin_headers)
        assert r.status_code == 200, r.text
        dl = client.get(f"/api/reports/{r.json()['id']}/download", headers=admin_headers)
        assert dl.status_code == 200 and len(dl.content) > 500
    assert client.post("/api/reports", json={"report_type": "platform", "file_format": "pdf"}, headers=admin_headers).status_code == 400


def test_notifications_are_deduplicated(client, admin_headers):
    client.post("/api/notifications/check", headers=admin_headers)
    first = client.get("/api/notifications", headers=admin_headers).json()["items"]
    client.post("/api/notifications/check", headers=admin_headers)
    second = client.get("/api/notifications", headers=admin_headers).json()["items"]
    assert len(first) == len(second)
    keys = [(n["kind"], n["feedback_id"], n["title"]) for n in second]
    assert len(keys) == len(set(keys))
