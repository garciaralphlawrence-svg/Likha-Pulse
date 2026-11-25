"""Response Clock: urgent messages become cases with a deadline, colors by time used, and a working action log."""
from datetime import datetime


def _open(client, h):
    return client.get("/api/cases?view=open", headers=h).json()


def test_sample_cases_cover_every_color(client, admin_headers):
    d = _open(client, admin_headers)
    s = d["stats"]
    assert s["open"] == len(d["items"]) >= 5
    assert s["overdue"] >= 1 and s["due_soon"] >= 1 and s["on_track"] >= 1
    assert s["open"] == s["on_track"] + s["needs_progress"] + s["at_risk"] + s["due_soon"] + s["overdue"]
    dues = [x["due_at"] for x in d["items"]]
    assert dues == sorted(dues), "most urgent first"
    stranded = next(x for x in d["items"] if "stranded" in x["content"])
    assert stranded["situation"] == "emergency" and stranded["traveling_now"] and stranded["steps"]


def test_new_urgent_message_runs_the_full_case_flow(client, admin_headers):
    h = admin_headers
    fb = client.post("/api/feedback", json={"content": "Naiwan po kami ng van sa airport, stranded kami dito sa Cebu.", "author": "clock-1"}, headers=h).json()
    assert fb["priority"] == "critical"
    c = next(x for x in _open(client, h)["items"] if x["id"] == fb["id"])
    span = datetime.fromisoformat(c["due_at"]) - datetime.fromisoformat(c["opened_at"])
    assert c["deadline_hours"] == 24 and span.total_seconds() == 24 * 3600
    assert c["situation"] == "emergency" and c["traveling_now"] and c["first_reply_at"] is None

    act = lambda body: client.post(f"/api/cases/{fb['id']}/actions", json=body, headers=h)  # noqa: E731
    assert act({"kind": "reply"}).json()["first_reply_at"]
    assert act({"kind": "step", "index": 0}).json()["steps"][0]["done"] is True
    assert act({"kind": "note", "text": "Called the driver, pickup in 20 minutes"}).json()["updates"][-1]["kind"] == "note"
    assert act({"kind": "note", "text": "  "}).status_code == 400
    assert act({"kind": "assign", "assignee": "Nobody Here"}).status_code == 400
    assert act({"kind": "step", "index": 99}).status_code == 400

    solved = act({"kind": "solve"}).json()
    assert solved["resolved_at"] and solved["updates"][-1]["kind"] == "solved"
    assert client.get(f"/api/feedback/{fb['id']}", headers=h).json()["action_status"] == "resolved"
    assert any(x["id"] == fb["id"] for x in client.get("/api/cases?view=solved", headers=h).json()["items"])
    assert not any(x["id"] == fb["id"] for x in _open(client, h)["items"])

    reopened = act({"kind": "reopen"}).json()
    assert reopened["resolved_at"] is None and reopened["updates"][-1]["kind"] == "reopened"
    logs = client.get("/api/audit?action=case_solve", headers=h).json()
    assert logs and logs[0]["entity_id"] == fb["id"]


def test_marking_done_in_inbox_solves_the_case(client, admin_headers):
    h = admin_headers
    fb = client.post("/api/feedback", json={"content": "Nawala po passport ko dito sa Tokyo, ano po gagawin ko?", "author": "clock-2"}, headers=h).json()
    assert fb["priority"] == "critical"
    client.patch(f"/api/feedback/{fb['id']}/status", json={"action_status": "resolved"}, headers=h)
    solved = client.get("/api/cases?view=solved", headers=h).json()["items"]
    c = next(x for x in solved if x["id"] == fb["id"])
    assert c["situation"] == "documents" and c["resolved_at"]


def test_response_clock_settings(client, admin_headers):
    h = admin_headers
    assert client.put("/api/settings/response_clock", json={"urgent_hours": 0}, headers=h).status_code == 400
    assert client.put("/api/settings/response_clock", json={"urgent_hours": 12}, headers=h).json()["urgent_hours"] == 12
    fb = client.post("/api/feedback", json={"content": "Naaksidente po yung bus namin papuntang Baguio, may sugat po kami.", "author": "clock-3"}, headers=h).json()
    c = next(x for x in _open(client, h)["items"] if x["id"] == fb["id"])
    assert c["deadline_hours"] == 12
    client.put("/api/settings/response_clock", json={"urgent_hours": 24}, headers=h)


def test_alerts_include_clock_warnings(client, admin_headers):
    kinds = {n["kind"] for n in client.get("/api/notifications", headers=admin_headers).json()["items"]}
    assert "case_overdue" in kinds and "case_due_soon" in kinds
