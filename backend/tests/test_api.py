"""End-to-end API tests: auth, roles, the public request form, tracking, and the full quotation flow."""
CONTACT = "0917 123 4567"


def new_request(client, text="gusto ko pumunta London 10 days, 5 star hotel", inp=None, addons=None):
    body = {"customer": {"name": "Test Customer", "contact": CONTACT}, "raw_text": text,
            "input": inp or {"destination": "london", "days": 10, "adults": 1, "tier": "luxury"}, "addons": addons or ["wifi"]}
    r = client.post("/api/public/requests", json=body)
    assert r.status_code == 201, r.text
    return r.json()["ref"]


def find_id(client, headers, ref):
    rows = client.get("/api/requests?view=all", headers=headers).json()
    return next(x["id"] for x in rows if x["ref"] == ref)


def act(client, headers, rid, action, **payload):
    return client.post(f"/api/requests/{rid}/actions", json={"action": action, **payload}, headers=headers)


def test_health(client):
    j = client.get("/api/health").json()
    assert j["status"] == "ok" and j["app"] == "PAPH Travel and Tours"


def test_login_rejects_bad_password(client):
    assert client.post("/api/auth/login", json={"email": "owner@paph-test.com", "password": "wrong-pass1"}).status_code == 401


def test_requires_auth(client):
    assert client.get("/api/requests").status_code == 401
    assert client.get("/api/dashboard").status_code == 401


def test_me_has_role(client, admin_headers):
    me = client.get("/api/auth/me", headers=admin_headers).json()
    assert me["role"] == "ADMIN" and "requests.approve" in me["permissions"]


def test_sample_requests_are_seeded_and_labeled(client, admin_headers):
    rows = client.get("/api/requests?view=all", headers=admin_headers).json()
    samples = [r for r in rows if r["is_sample"]]
    assert len(samples) >= 10 and all(r["customer_name"].startswith("Sample") for r in samples)
    assert {r["status"] for r in samples} >= {"ai_recommended", "offer_drafted", "pending_approval", "changes_requested", "sent", "booked", "lost", "declined"}


def test_public_parse_and_estimate(client):
    p = client.post("/api/public/parse", json={"text": "budget friendly London 10 days ₱80,000"}).json()
    assert p["destination"] == "london" and p["budget"] == 80000 and p["tier"] == "budget"
    est = client.post("/api/public/estimate", json={"text": "solo trip, budget friendly London 10 days ₱80,000"}).json()
    assert est["budget"]["status"] == "over" and "Nearest fit" in est["verdict"]
    assert est["budget"]["best"]["destination"] == "seoul"


def test_public_input_is_validated(client):
    body = {"customer": {"name": "X", "contact": CONTACT}, "raw_text": "", "input": {"destination": "london"}, "addons": []}
    assert client.post("/api/public/requests", json=body).status_code == 400  # name too short
    body["customer"]["name"] = "Real Name"
    body["input"]["days"] = "ten"
    assert client.post("/api/public/requests", json=body).status_code == 400


def test_tracking_needs_matching_contact(client):
    ref = new_request(client)
    assert client.get(f"/api/public/requests/{ref}", params={"contact": "0999 999 9999"}).status_code == 404
    v = client.get(f"/api/public/requests/{ref}", params={"contact": "+63 917 123 4567"}).json()
    assert v["customer_status"] == "Received" and v["offer"] is None and v["recommendation"]["recommended"] == "premium"
    assert "cost" not in str(v.get("offer"))


def test_rbac(client, staff):
    ref = new_request(client)
    rid = find_id(client, staff["SALES"], ref)
    assert client.get("/api/users", headers=staff["SALES"]).status_code == 403
    assert client.get("/api/dashboard", headers=staff["SALES"]).status_code == 403
    assert client.put("/api/settings", json={"service_fee_pct": 5}, headers=staff["AGENT"]).status_code == 403
    assert client.get("/api/settings", headers=staff["SALES"]).json()["min_margin_pct"] == 8
    r = act(client, staff["AGENT"], rid, "start_offer")
    assert r.status_code == 400 and "role" in r.json()["detail"]
    assert act(client, staff["SALES"], rid, "start_offer").status_code == 200
    assert act(client, staff["SALES"], rid, "submit").status_code == 200
    r = act(client, staff["SALES"], rid, "approve")
    assert r.status_code == 400 and "role" in r.json()["detail"]
    assert act(client, staff["AGENT"], rid, "nonsense").status_code == 400


def test_full_flow_to_booked(client, staff):
    ref = new_request(client)
    rid = find_id(client, staff["SALES"], ref)
    d = act(client, staff["SALES"], rid, "start_offer").json()
    assert d["status"] == "offer_drafted" and d["offer"]["totals"]["ai_check"] == "inside" and "submit" in d["allowed"]
    d = act(client, staff["SALES"], rid, "submit").json()
    assert d["status"] == "pending_approval"
    d = act(client, staff["AGENT"], rid, "approve").json()
    assert d["status"] == "approved" and d["terms"]["ref"] == ref and d["terms"]["deposit"] > 0
    v = client.get(f"/api/public/requests/{ref}", params={"contact": CONTACT}).json()
    assert v["customer_status"] == "Offer ready" and v["offer"]["total"] == d["offer"]["totals"]["price"] and "customer_accept" in v["can"]
    assert all(set(line) == {"label", "detail", "price"} for line in v["offer"]["lines"])
    r = client.post(f"/api/public/requests/{ref}/actions", json={"contact": CONTACT, "action": "customer_question", "note": "Breakfast included?"})
    assert r.status_code == 200 and r.json()["question"]["text"] == "Breakfast included?"
    assert client.post(f"/api/public/requests/{ref}/actions", json={"contact": CONTACT, "action": "approve"}).status_code == 400
    assert act(client, staff["SALES"], rid, "answer", note="Yes, daily breakfast").status_code == 200
    v = client.post(f"/api/public/requests/{ref}/actions", json={"contact": CONTACT, "action": "customer_accept"}).json()
    assert v["status"] == "accepted"
    d = act(client, staff["SALES"], rid, "mark_booked").json()
    assert d["status"] == "booked" and [e["action"] for e in d["events"]][-1] == "mark_booked"
    logs = client.get("/api/audit", headers=staff["ADMIN"]).json()
    assert any(x["action"] == "request_mark_booked" and x["entity_id"] == ref for x in logs)


def test_ask_for_changes_and_reapproval(client, staff):
    ref = new_request(client)
    rid = find_id(client, staff["SALES"], ref)
    act(client, staff["SALES"], rid, "start_offer")
    act(client, staff["SALES"], rid, "submit")
    assert act(client, staff["AGENT"], rid, "request_changes").status_code == 400  # note required
    d = act(client, staff["AGENT"], rid, "request_changes", note="Use a 4-star hotel").json()
    assert d["status"] == "changes_requested"
    d = act(client, staff["SALES"], rid, "save_offer", discount=1000).json()
    assert d["status"] == "offer_drafted"
    act(client, staff["SALES"], rid, "submit")
    d = act(client, staff["AGENT"], rid, "approve").json()
    assert d["status"] == "approved"
    d = act(client, staff["SALES"], rid, "save_offer", discount=2000).json()
    assert d["status"] == "pending_approval" and d["approval"] is None  # any change after approval needs approval again


def test_self_approval_and_below_cost_blocked(client, staff):
    ref = new_request(client)
    rid = find_id(client, staff["ADMIN"], ref)
    d = act(client, staff["ADMIN"], rid, "start_offer").json()
    act(client, staff["ADMIN"], rid, "submit")
    r = act(client, staff["ADMIN"], rid, "approve")
    assert r.status_code == 400 and "someone else" in r.json()["detail"]
    act(client, staff["AGENT"], rid, "request_changes", note="Recheck")
    r = act(client, staff["ADMIN"], rid, "save_offer", discount=d["offer"]["totals"]["margin"] + 10000)
    assert r.json()["offer"]["totals"]["below_cost"]
    r = act(client, staff["ADMIN"], rid, "submit")
    assert r.status_code == 400 and "below cost" in r.json()["detail"]


def test_lost_needs_reason_and_dashboard(client, staff):
    ref = new_request(client)
    rid = find_id(client, staff["SALES"], ref)
    assert act(client, staff["SALES"], rid, "mark_lost").status_code == 400
    assert act(client, staff["SALES"], rid, "mark_lost", reason="price").json()["status"] == "lost"
    dash = client.get("/api/dashboard", headers=staff["AGENT"]).json()
    rows = client.get("/api/requests?view=all", headers=staff["AGENT"]).json()
    assert dash["total"] == len(rows) and sum(s["count"] for s in dash["by_status"]) == dash["total"]
    assert any(x["reason"] == "price" for x in dash["lost_reasons"]) and any(x["code"] == "london" for x in dash["top_destinations"])
    assert dash["sample_count"] == sum(1 for r in rows if r["is_sample"])


def test_settings_validation(client, admin_headers):
    s = client.get("/api/settings", headers=admin_headers).json()
    assert client.put("/api/settings", json={**s, "service_fee_pct": 90}, headers=admin_headers).status_code == 400
    r = client.put("/api/settings", json={**s, "validity_days": 10}, headers=admin_headers)
    assert r.status_code == 200 and r.json()["validity_days"] == 10
    client.put("/api/settings", json=s, headers=admin_headers)


def test_staff_list_and_assign(client, staff):
    people = client.get("/api/staff", headers=staff["SALES"]).json()
    sales = next(p for p in people if p["name"] == "Test Sales")
    agent = next(p for p in people if p["name"] == "Test Agent")
    ref = new_request(client)
    rid = find_id(client, staff["SALES"], ref)
    assert act(client, staff["SALES"], rid, "assign", assignee={"id": agent["id"]}).status_code == 400  # sales only takes for themselves
    d = act(client, staff["SALES"], rid, "assign", assignee={"id": sales["id"]}).json()
    assert d["assignee"]["name"] == "Test Sales"


def test_unknown_destination_goes_to_manual(client, staff):
    ref = new_request(client, "We want to go to Iceland for 8 days", {"place_text": "Iceland", "days": 8, "adults": 2}, [])
    rid = find_id(client, staff["SALES"], ref)
    d = client.get(f"/api/requests/{rid}", headers=staff["SALES"]).json()
    assert d["recommendation"]["kind"] == "manual" and "Iceland" in d["recommendation"]["verdict"]
    d = act(client, staff["SALES"], rid, "start_offer").json()
    assert d["offer"]["lines"] == []
    assert act(client, staff["SALES"], rid, "submit").status_code == 400


def test_owner_dashboard_is_owner_only(client, staff):
    for role in ("SALES", "AGENT"):
        assert client.get("/api/owner", headers=staff[role]).status_code == 403
        assert client.get("/api/owner/voices.csv", headers=staff[role]).status_code == 403
    rep = client.get("/api/owner?range=all", headers=staff["ADMIN"]).json()
    assert {"briefing", "sentiment", "team", "revenue", "voices", "options"} <= set(rep)
    assert rep["briefing"]["verdict"] and rep["sentiment"]["total"] > 50 and rep["revenue"]["bookings"] > 5
    assert any(t["name"] == "Mia (sample salesperson)" for t in rep["team"])
    assert client.get("/api/owner?range=forever", headers=staff["ADMIN"]).status_code == 422
    csv = client.get("/api/owner/voices.csv?range=30", headers=staff["ADMIN"])
    assert csv.status_code == 200 and csv.headers["content-type"].startswith("text/csv") and "Reference" in csv.text.splitlines()[0]


def test_sample_staff_cannot_sign_in(client):
    assert client.post("/api/auth/login", json={"email": "sample.sales1@example.com", "password": "Anything123"}).status_code == 401


def test_customer_feedback_after_booking(client, staff):
    ref = new_request(client)
    rid = find_id(client, staff["SALES"], ref)
    act(client, staff["SALES"], rid, "start_offer")
    act(client, staff["SALES"], rid, "submit")
    act(client, staff["AGENT"], rid, "approve")
    url = f"/api/public/requests/{ref}/actions"
    assert client.post(url, json={"contact": CONTACT, "action": "customer_feedback", "rating": 5}).status_code == 400  # not booked yet
    client.post(url, json={"contact": CONTACT, "action": "customer_accept"})
    act(client, staff["SALES"], rid, "mark_booked")
    v = client.get(f"/api/public/requests/{ref}", params={"contact": CONTACT}).json()
    assert "customer_feedback" in v["can"] and v["feedback"] is None
    assert client.post(url, json={"contact": CONTACT, "action": "customer_feedback", "rating": 9}).status_code == 400
    note = "Super bait ng tour guide, sulit ang London trip!"
    v = client.post(url, json={"contact": CONTACT, "action": "customer_feedback", "rating": 5, "note": note}).json()
    assert v["feedback"]["rating"] == 5 and "customer_feedback" not in v["can"] and v["timeline"][-1]["label"] == "You rated your trip"
    r = client.post(url, json={"contact": CONTACT, "action": "customer_feedback", "rating": 1})
    assert r.status_code == 400 and "already rated" in r.json()["detail"]
    rep = client.get("/api/owner?range=30", headers=staff["ADMIN"]).json()
    mine = [x for x in rep["voices"] if x["ref"] == ref and x["kind"] == "feedback"]
    assert len(mine) == 1 and mine[0]["rating"] == 5 and mine[0]["mood"] == "positive" and mine[0]["text"] == note
