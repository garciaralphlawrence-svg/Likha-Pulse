"""Team tools: Google retired, client history, suggested replies, keyword watch, team report, weekly report, import."""
import base64
from datetime import datetime, timedelta, timezone

from app.services import importer, weekly_report
from app.services.replies import reply_key
from app.services.watch import clean_words, hits


def test_no_google_anywhere(client, admin_headers):
    meta = client.get("/api/meta", headers=admin_headers).json()
    assert [p["code"] for p in meta["platforms"]] == ["facebook_page", "messenger", "manual", "import"]
    d = client.get("/api/dashboard?date_from=2000-01-01", headers=admin_headers).json()
    names = {p["platform"] for p in d["by_platform"]}
    assert names and not any("Google" in n for n in names)


def test_retire_google_moves_real_rows_and_drops_samples():
    from app.db import SessionLocal
    from app.integrations.base import FetchedItem
    from app.models import Feedback, Platform
    from app.services.ingestion import ingest, retire_google
    with SessionLocal() as db:
        g = Platform(code="google_business", name="Google Business Profile", status="not_connected")
        db.add(g)
        db.commit()
        now = datetime.now(timezone.utc)
        real = ingest(db, "google_business", FetchedItem("g-real", "Ang ganda ng Coron tour namin!", now, "g-client"), notify=False)
        ingest(db, "google_business", FetchedItem("g-sample", "Sample Google review sa Bohol.", now, "g-s"), is_sample=True, notify=False)
        assert retire_google(db) == 1
        assert db.query(Platform).filter_by(code="google_business").first() is None
        moved = db.get(Feedback, real.id)
        assert moved.platform.code == "import" and moved.is_imported
        assert retire_google(db) == 0


def test_client_history_groups_every_message(client, admin_headers):
    h = admin_headers
    a = client.post("/api/feedback", json={"content": "Magkano po ang El Nido island hopping tour?", "author": "History Traveler"}, headers=h).json()
    b = client.post("/api/feedback", json={"content": "Salamat sa smooth na El Nido trip namin, super bait ng tour guide!", "author": "History Traveler"}, headers=h).json()
    assert a["author"] == b["author"] and a["client"] == b["client"] and b["client_messages"] == 2
    c = client.get(f"/api/clients/{a['author']}", headers=h).json()
    assert c["total"] == 2 and {x["id"] for x in c["timeline"]} == {a["id"], b["id"]}
    assert len(c["feelings"]) == 2 and c["moods"]["positive"] >= 1 and c["verdict"]
    assert client.get("/api/clients/anonymous", headers=h).status_code == 404
    # sample travelers have several messages each
    items = client.get("/api/feedback?date_from=2000-01-01&page_size=60", headers=h).json()["items"]
    item = next(x for x in items if x["client"].startswith("Sample traveler"))
    assert client.get(f"/api/clients/{item['author']}", headers=h).json()["total"] >= 2


def test_reply_key_matches_travel_situations():
    assert reply_key("Nawala po passport ko dito sa Tokyo", "Visa & Travel Documents", "request_assistance", "negative") == "lost_passport"
    assert reply_key("Follow up lang po sa refund ko", "Payment & Refunds", "follow_up_request", "negative") == "refund"
    assert reply_key("Late ang sundo namin sa airport", "Flights & Transfers", "complaint", "negative") == "delay"
    assert reply_key("Salamat sa magandang tour!", "Tours & Itinerary", "appreciation", "positive") == "thank_you"
    assert reply_key("Magkano po ang Japan tour?", "Pricing & Promos", "inquiry", "neutral") == "inquiry"


def test_suggested_replies_and_template_editing(client, admin_headers):
    h = admin_headers
    lib = client.get("/api/reply-templates", headers=h).json()
    assert len(lib["items"]) >= 22 and {"en", "tl"} <= {t["language"] for t in lib["items"]}
    fb = client.post("/api/feedback", json={"content": "Follow up lang po sa refund ng cancelled Boracay tour ko, wala pa rin.", "author": "reply-1"}, headers=h).json()
    s = client.get(f"/api/feedback/{fb['id']}/replies", headers=h).json()
    assert s["situation"] == "refund" and {t["language"] for t in s["templates"]} == {"en", "tl"}
    new = client.post("/api/reply-templates", json={"situation": "refund", "language": "tl", "title": "GCash refund", "body": "Na-process na po ang GCash refund ninyo. Salamat po!"}, headers=h)
    assert new.status_code == 201
    tid = new.json()["id"]
    assert client.put(f"/api/reply-templates/{tid}", json={"situation": "refund", "language": "tl", "title": "GCash refund sent", "body": "Naipadala na po ang GCash refund ninyo."}, headers=h).json()["title"] == "GCash refund sent"
    assert any(t["id"] == tid for t in client.get(f"/api/feedback/{fb['id']}/replies", headers=h).json()["templates"])
    assert client.post("/api/reply-templates", json={"situation": "nope", "language": "en", "title": "x" * 3, "body": "hello there"}, headers=h).status_code == 400
    assert client.delete(f"/api/reply-templates/{tid}", headers=h).json()["deleted"] == tid
    replied = client.post(f"/api/feedback/{fb['id']}/replied", headers=h).json()
    assert replied["first_reply_at"] and replied["handled_by"]


def test_keyword_watch_flags_and_alerts(client, admin_headers):
    h = admin_headers
    assert hits("Na-cancel po ang flight namin papuntang Boracay", ["cancel", "boracay", "scam"]) == ["cancel", "boracay"]
    assert hits("Cancelled ang tour", ["cancel"]) == ["cancel"] and hits("pancake", ["cancel"]) == []
    assert clean_words(["  refund ", "Refund", "x", "El  Nido"]) == ["refund", "El Nido"]
    assert client.put("/api/settings/keyword_watch", json={"words": "refund"}, headers=h).status_code == 400
    assert client.put("/api/settings/keyword_watch", json={"words": ["scam", "Siargao"]}, headers=h).json()["words"] == ["scam", "Siargao"]
    fb = client.post("/api/feedback", json={"content": "Parang scam yung promo ninyo for Siargao, walang sumasagot.", "author": "kw-1"}, headers=h).json()
    assert fb["watch_hits"] == ["scam", "Siargao"]
    w = client.get("/api/keyword-watch?days=30", headers=h).json()
    assert any(x["id"] == fb["id"] for x in w["items"]) and {c["word"] for c in w["counts"]} == {"scam", "Siargao"}
    alerts = client.get("/api/notifications", headers=h).json()["items"]
    assert any(n["kind"] == "keyword_match" and n["feedback_id"] == fb["id"] for n in alerts)
    client.put("/api/settings/keyword_watch", json={"words": ["refund", "scam", "cancel", "estafa", "Boracay"]}, headers=h)


def test_team_report_per_staff_and_month(client, admin_headers):
    h = admin_headers
    r = client.get("/api/team-report?months=6", headers=h).json()
    assert len(r["months"]) == 6 and r["totals"]["handled"] > 0
    assert r["staff"] and all({"name", "handled", "avg_first_reply_minutes", "avg_resolution_minutes"} <= set(s) for s in r["staff"])
    assert sum(s["handled"] for s in r["staff"]) == r["totals"]["handled"]
    assert sum(m["handled"] for m in r["by_month"]) == r["totals"]["handled"]
    csv = client.get("/api/team-report/csv", headers=h)
    assert csv.status_code == 200 and "Staff member" in csv.text and "First reply (minutes)" in csv.text


def test_weekly_report_preview_and_send_without_smtp(client, admin_headers):
    h = admin_headers
    p = client.get("/api/weekly-report", headers=h).json()
    assert p["subject"].startswith("Likha Pulse weekly report") and p["verdict"] and "<table" in p["html"]
    assert p["recipients"] == ["admin@pulse-test.com"] and p["email_ready"] is False
    r = client.post("/api/weekly-report/send", headers=h).json()
    assert r["sent"] is False and "not set up" in r["detail"]
    assert client.put("/api/settings/weekly_report", json={"enabled": True, "recipients": "not-an-email"}, headers=h).status_code == 400
    s = client.put("/api/settings/weekly_report", json={"enabled": False, "recipients": "owner@agency.test; ops@agency.test"}, headers=h).json()
    assert s["recipients"] == "owner@agency.test, ops@agency.test" and s["enabled"] is False
    from app.db import SessionLocal
    with SessionLocal() as db:
        assert weekly_report.send_weekly(db)["detail"] == "The weekly report is turned off."
    client.put("/api/settings/weekly_report", json={"enabled": True, "recipients": ""}, headers=h)


def test_import_dates_and_channels():
    assert importer.parse_date("2025-10-12 14:30").hour == 14
    assert importer.parse_date("10/20/2025").month == 10 and importer.parse_date("20/10/2025").day == 20
    assert importer.parse_date("Nov 3, 2025").day == 3 and importer.parse_date("3 November 2025").month == 11
    assert importer.parse_date("2025-01-05 2:15 PM").hour == 14
    assert importer.parse_date("45000").year == 2023 and importer.parse_date("hello") is None
    assert importer.channel_code("Messenger") == "messenger" and importer.channel_code("FB comment") == "facebook_page"
    assert importer.channel_code("Survey") == "import"


def test_import_csv_flow(client, admin_headers):
    h = admin_headers
    raw = importer.SAMPLE_CSV + "not a date,Sample traveler F,Okay naman,Messenger\n2025-11-20,,x,Messenger\n"
    p = client.post("/api/import/parse", json={"file_name": "past.csv", "content_base64": base64.b64encode(raw.encode()).decode()}, headers=h).json()
    assert p["total"] == 8 and p["mapping"] == {"date": 0, "client": 1, "message": 2, "channel": 3}
    rows = [{"date": r[0], "client": r[1], "message": r[2], "channel": r[3]} for r in p["rows"]]
    res = client.post("/api/import", json={"file_name": "past.csv", "rows": rows}, headers=h).json()
    assert res["imported"] == 6 and res["skipped_count"] == 2 and res["by_channel"] == {"facebook_page": 2, "messenger": 3, "import": 1}
    assert client.post("/api/import", json={"file_name": "past.csv", "rows": rows}, headers=h).json()["duplicates"] == 6
    imported = client.get("/api/feedback?date_from=2025-10-01&date_to=2025-11-30&search=Coron tour for 4", headers=h).json()["items"][0]
    assert imported["is_imported"] and imported["action_status"] == "resolved" and imported["client"].startswith("Client ")  # names stay private unless ANONYMIZE_AUTHORS=false
    assert client.get(f"/api/clients/{imported['author']}", headers=h).json()["open_cases"] == []
    bad = client.post("/api/import/parse", json={"file_name": "x.pdf", "content_base64": base64.b64encode(b"%PDF").decode()}, headers=h)
    assert bad.status_code == 400
    assert client.get("/api/import/template.csv", headers=h).text.startswith("date,client name,message,channel")


def test_import_xlsx_parse():
    import io

    from openpyxl import Workbook
    wb = Workbook()
    ws = wb.active
    ws.append(["Petsa", "Pangalan", "Feedback", "Source"])
    ws.append([datetime(2025, 9, 1, 10, 0), "Sample traveler G", "Sulit ang Bohol countryside tour!", "Facebook"])
    buf = io.BytesIO()
    wb.save(buf)
    p = importer.parse_file("old-survey.xlsx", buf.getvalue())
    assert p["mapping"] == {"date": 0, "client": 1, "message": 2, "channel": 3}
    assert p["rows"][0][0] == "2025-09-01 10:00" and importer.parse_date(p["rows"][0][0]) == datetime(2025, 9, 1, 10, 0, tzinfo=timezone(timedelta(hours=8)))
