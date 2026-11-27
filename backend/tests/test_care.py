"""Customer care API: messages, Response Clock cases, client history, suggested replies, keyword watch,
team and weekly reports, importing past messages, and the Facebook/Messenger connections."""
from tests.test_api import CONTACT, act, find_id, new_request


def test_messages_waiting_and_reply(client, staff):
    allm = client.get("/api/messages?view=all", headers=staff["SALES"]).json()
    assert len(allm) > 50 and all(m["is_sample"] for m in allm)
    assert [m["at"] for m in allm] == sorted((m["at"] for m in allm), reverse=True)
    waiting = client.get("/api/messages?view=waiting", headers=staff["SALES"]).json()
    rank = {"overdue": 0, "red": 1, "orange": 2, "yellow": 3, "green": 4}
    assert waiting and all(m["clock"] for m in waiting)
    assert [rank[m["clock"]["stage"]] for m in waiting] == sorted(rank[m["clock"]["stage"]] for m in waiting)
    m = waiting[0]
    r = client.post(f"/api/messages/{m['id']}/actions", json={"action": "reply"}, headers=staff["SALES"]).json()
    assert r["first_reply_at"] and r["handled_by"]["name"] == "Test Sales" and r["clock"] is None
    assert client.post(f"/api/messages/{m['id']}/actions", json={"action": "nope"}, headers=staff["SALES"]).status_code == 400


def test_message_to_request_and_case(client, staff):
    m = next(x for x in client.get("/api/messages?view=all", headers=staff["SALES"]).json() if not x["request_id"] and not x["case_id"])
    r = client.post(f"/api/messages/{m['id']}/actions", json={"action": "make_request"}, headers=staff["SALES"]).json()
    assert r["request_id"] and r["request_ref"].startswith("PAPH-") and r["first_reply_at"]
    d = client.get(f"/api/requests/{r['request_id']}", headers=staff["SALES"]).json()
    assert d["raw_text"] == m["text"] and d["customer"]["contact"].split(":")[0] in ("Facebook", "Messenger")
    assert client.post(f"/api/messages/{m['id']}/actions", json={"action": "make_request"}, headers=staff["SALES"]).status_code == 400
    c = client.post(f"/api/messages/{m['id']}/actions", json={"action": "open_case"}, headers=staff["SALES"]).json()
    assert c["case_id"].startswith("CASE-")
    assert client.post(f"/api/messages/{m['id']}/actions", json={"action": "open_case"}, headers=staff["SALES"]).status_code == 400


def test_case_visibility_by_role(client, staff):
    admin = client.get("/api/cases?view=open", headers=staff["ADMIN"]).json()
    sales = client.get("/api/cases?view=open", headers=staff["SALES"]).json()
    assert len(admin["items"]) > len(sales["items"]) >= 0
    me = client.get("/api/auth/me", headers=staff["SALES"]).json()["id"]
    assert all(not c["owner"] or c["owner"]["id"] == me for c in sales["items"])
    stages = [c["stage"] for c in admin["items"]]
    order = {"overdue": 0, "red": 1, "orange": 2, "yellow": 3, "green": 4}
    assert [order[s] for s in stages] == sorted(order[s] for s in stages)
    assert {"open", "by_stage", "solved", "on_time_pct", "by_person"} <= set(admin["stats"]) and admin["team"]
    solved = client.get("/api/cases?view=solved", headers=staff["ADMIN"]).json()["items"]
    assert solved and all(c["stage"] == "solved" for c in solved)


def test_case_take_assign_solve(client, staff):
    c = client.post("/api/cases", json={"text": "Customer called: van did not arrive at the airport, stranded po kami", "source": "manual"},
                    headers=staff["ADMIN"])
    assert c.status_code == 201, c.text
    c = c.json()
    assert c["priority"] == "urgent" and c["owner"] is None and c["stage"] == "green"
    assert client.post("/api/cases", json={"text": c["text"], "source": "manual"}, headers=staff["ADMIN"]).status_code == 400  # duplicate
    url = f"/api/cases/{c['id']}/actions"
    people = client.get("/api/staff", headers=staff["SALES"]).json()
    sales = next(p for p in people if p["name"] == "Test Sales")
    agent = next(p for p in people if p["name"] == "Test Agent")
    r = client.post(url, json={"action": "reply"}, headers=staff["SALES"])
    assert r.status_code == 400 and "Take this case first" in r.json()["detail"]
    assert client.post(url, json={"action": "assign", "assignee": {"id": agent["id"]}}, headers=staff["SALES"]).status_code == 400
    assert client.post(url, json={"action": "assign", "assignee": {"id": sales["id"]}}, headers=staff["SALES"]).json()["owner"]["name"] == "Test Sales"
    r = client.post(url, json={"action": "reply", "note": "Called, driver on the way"}, headers=staff["AGENT"])
    assert r.status_code == 400 and "belongs to Test Sales" in r.json()["detail"]
    assert client.post(url, json={"action": "step", "index": 0}, headers=staff["SALES"]).json()["steps_done"] == 1
    assert client.post(url, json={"action": "step", "index": 99}, headers=staff["SALES"]).status_code == 400
    done = client.post(url, json={"action": "solve", "note": "Picked up."}, headers=staff["SALES"]).json()
    assert done["stage"] == "solved" and done["on_time"] and done["first_reply_at"]
    assert client.post(url, json={"action": "note", "note": "x"}, headers=staff["SALES"]).status_code == 400  # already solved
    again = client.post(url, json={"action": "reopen"}, headers=staff["ADMIN"]).json()
    assert again["resolved_at"] is None and again["stage"] == "green"


def _booked_request(client, staff):
    ref = new_request(client)
    rid = find_id(client, staff["SALES"], ref)
    act(client, staff["SALES"], rid, "start_offer")
    act(client, staff["SALES"], rid, "submit")
    act(client, staff["AGENT"], rid, "approve")
    return ref, rid


def _cases_for(client, staff, rid):
    return [c for c in client.get("/api/cases?view=open", headers=staff["ADMIN"]).json()["items"] if c["request_id"] == rid]


def test_auto_case_from_unhappy_question_and_low_rating(client, staff):
    ref, rid = _booked_request(client, staff)
    url = f"/api/public/requests/{ref}/actions"
    client.post(url, json={"contact": CONTACT, "action": "customer_question", "note": "Is breakfast included?"})
    assert _cases_for(client, staff, rid) == []  # a calm question does not open a case
    client.post(url, json={"contact": CONTACT, "action": "customer_question", "note": "Ang tagal po ng reply ninyo, wala pa rin update!"})
    cs = _cases_for(client, staff, rid)
    assert len(cs) == 1 and cs[0]["source"] == "request" and cs[0]["owner"]["name"] == "Test Sales" and cs[0]["request_ref"] == ref
    d = client.get(f"/api/requests/{rid}", headers=staff["SALES"]).json()
    assert d["clock"] and d["clock"]["label"] == "Customer question"
    act(client, staff["SALES"], rid, "answer", note="Sorry po, sending it now")
    client.post(url, json={"contact": CONTACT, "action": "customer_accept"})
    act(client, staff["SALES"], rid, "mark_booked")
    client.post(url, json={"contact": CONTACT, "action": "customer_feedback", "rating": 2, "note": "Hotel was far from the sights"})
    fb = [c for c in _cases_for(client, staff, rid) if c["source"] == "feedback"]
    assert len(fb) == 1 and fb[0]["priority"] == "important"


def test_staff_reply_stops_request_clock(client, staff):
    ref = new_request(client)
    rid = find_id(client, staff["SALES"], ref)
    assert client.get(f"/api/requests/{rid}", headers=staff["SALES"]).json()["clock"]["label"] == "First reply"
    d = act(client, staff["SALES"], rid, "reply").json()
    assert d["clock"] is None and d["events"][-1]["note"] == "Replied to the customer."


def test_client_history(client, staff):
    m = client.get("/api/messages?view=all", headers=staff["SALES"]).json()[0]
    h = client.get(f"/api/clients/{m['client_key']}", headers=staff["SALES"]).json()
    assert h["name"] == m["client"] and h["messages"] >= 1 and h["verdict"] and h["timeline"]


def test_reply_templates(client, staff):
    rows = client.get("/api/reply-templates", headers=staff["SALES"]).json()
    assert len(rows) >= 10 and all(r["is_default"] for r in rows)
    body = {"situation": rows[0]["situation"], "language": "tl", "title": "Sample reply", "body": "Hi {name}! Salamat po."}
    assert client.post("/api/reply-templates", json=body, headers=staff["SALES"]).status_code == 403
    t = client.post("/api/reply-templates", json=body, headers=staff["ADMIN"]).json()
    assert t["is_default"] is False and t["updated_by"] == "Test Owner"
    assert client.post("/api/reply-templates", json={**body, "situation": "nonsense"}, headers=staff["ADMIN"]).status_code == 400
    t2 = client.put(f"/api/reply-templates/{t['id']}", json={**body, "title": "Edited"}, headers=staff["ADMIN"]).json()
    assert t2["title"] == "Edited"
    assert client.delete(f"/api/reply-templates/{t['id']}", headers=staff["ADMIN"]).status_code == 204
    assert client.delete(f"/api/reply-templates/{t['id']}", headers=staff["ADMIN"]).status_code == 404


def test_keyword_watch_and_reports_are_owner_only(client, staff):
    for path in ("/api/keyword-watch?days=30", "/api/team-report", "/api/team-report/csv", "/api/weekly-report"):
        assert client.get(path, headers=staff["SALES"]).status_code == 403
        assert client.get(path, headers=staff["AGENT"]).status_code == 403
    w = client.get("/api/keyword-watch?days=180", headers=staff["ADMIN"]).json()
    assert w["words"] and w["total"] == len(w["items"]) and all(i["hits"] for i in w["items"])
    t = client.get("/api/team-report?months=6", headers=staff["ADMIN"]).json()
    assert t["staff"] and t["totals"]["handled"] == len(t["rows"])
    csv = client.get("/api/team-report/csv?months=6", headers=staff["ADMIN"])
    assert csv.headers["content-type"].startswith("text/csv") and "First reply (minutes)" in csv.text.splitlines()[0]
    wk = client.get("/api/weekly-report", headers=staff["ADMIN"]).json()
    assert wk["subject"].startswith("PAPH weekly report") and wk["actions"] and wk["schedule"].startswith("Every Monday")


def test_weekly_send_without_smtp_is_logged(client, staff):
    assert client.post("/api/weekly-report/send", headers=staff["SALES"]).status_code == 403
    r = client.post("/api/weekly-report/send", headers=staff["ADMIN"]).json()
    assert r["sent"] is False and "log" in r["detail"]


def test_import_past_messages(client, staff):
    rows = [
        {"date": "2026-03-01 10:30", "client": "Juan Dela Cruz", "message": "Ang ganda ng Boracay trip namin, salamat PAPH!", "channel": "Facebook comment"},
        {"date": "03/02/2026", "client": "Maria", "message": "Wala pa po refund ko for the cancelled Japan tour", "channel": "Messenger"},
        {"date": "2026-03-01 10:30", "client": "Juan Dela Cruz", "message": "Ang ganda ng Boracay trip namin, salamat PAPH!", "channel": "Facebook comment"},
        {"date": "not a date", "client": "X", "message": "Hello", "channel": ""},
        {"date": "2026-03-03", "client": "Y", "message": "", "channel": ""},
        {"date": "2099-01-01", "client": "Z", "message": "From the future", "channel": ""},
    ]
    assert client.post("/api/import", json={"file_name": "old.csv", "rows": rows}, headers=staff["AGENT"]).status_code == 403
    r = client.post("/api/import", json={"file_name": "old.csv", "rows": rows}, headers=staff["ADMIN"]).json()
    assert r["total"] == 6 and r["imported"] == 2 and r["duplicates"] == 1 and r["skipped_count"] == 3
    assert r["by_channel"] == {"facebook_page": 1, "messenger": 1}
    assert {s["reason"] for s in r["skipped"]} == {"Date not understood", "No message", "Date is in the future"}
    again = client.post("/api/import", json={"file_name": "old.csv", "rows": rows[:2]}, headers=staff["ADMIN"]).json()
    assert again["imported"] == 0 and again["duplicates"] == 2
    msgs = [m for m in client.get("/api/messages?view=all", headers=staff["ADMIN"]).json() if m["is_imported"]]
    assert {m["client"] for m in msgs} >= {"Juan Dela Cruz", "Maria"} and all(m["clock"] is None and not m["case_id"] for m in msgs)


def test_integrations_not_connected(client, staff):
    rows = {i["code"]: i for i in client.get("/api/integrations", headers=staff["SALES"]).json()}
    assert set(rows) == {"facebook_page", "messenger", "import"}
    assert rows["facebook_page"]["status"] == "not_connected" and rows["facebook_page"]["missing"] == ["META_PAGE_ID", "META_PAGE_ACCESS_TOKEN"]
    assert rows["messenger"]["sample_count"] > 0
    assert client.post("/api/integrations/messenger/sync", headers=staff["SALES"]).status_code == 403
    r = client.post("/api/integrations/messenger/sync", headers=staff["ADMIN"]).json()
    assert r["status"] == "not_connected" and r["added"] == 0


def test_clock_settings_validation(client, admin_headers):
    s = client.get("/api/settings", headers=admin_headers).json()
    assert s["urgent_hours"] == 24 and "refund" in s["watch_words"]
    assert client.put("/api/settings", json={"urgent_hours": 500}, headers=admin_headers).status_code == 400
    assert client.put("/api/settings", json={"weekly_recipients": "not-an-email"}, headers=admin_headers).status_code == 400
    r = client.put("/api/settings", json={"watch_words": ["refund", "Refund", "  scam  ", "x"], "weekly_recipients": "owner@paph-test.com"},
                   headers=admin_headers).json()
    assert r["watch_words"] == ["refund", "scam"] and r["weekly_recipients"] == "owner@paph-test.com" and r["service_fee_pct"] == s["service_fee_pct"]
    client.put("/api/settings", json=s, headers=admin_headers)


def test_owner_report_includes_messages_and_cases(client, staff):
    rep = client.get("/api/owner?range=all", headers=staff["ADMIN"]).json()
    kinds = {v["kind"] for v in rep["voices"]}
    assert {"facebook_page", "messenger"} <= kinds
    assert any(t["messages_handled"] > 0 and "cases_solved" in t for t in rep["team"])
    dash = client.get("/api/dashboard", headers=staff["AGENT"]).json()
    assert set(dash["request_clock"]) == {"overdue", "red", "orange", "yellow", "green"}
