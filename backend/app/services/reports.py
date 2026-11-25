"""Report generation (Module 8): PDF, Excel and CSV built from stored analysis results."""
from __future__ import annotations

import csv
import io
from dataclasses import replace
from datetime import datetime
from pathlib import Path

from openpyxl import Workbook
from openpyxl.chart import BarChart, PieChart, Reference
from openpyxl.styles import Alignment, Font, PatternFill
from reportlab.graphics.charts.barcharts import VerticalBarChart
from reportlab.graphics.charts.piecharts import Pie
from reportlab.graphics.shapes import Drawing
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models import Feedback, GeneratedReport
from app.services.filters import FeedbackFilters, fetch
from app.services.insights import build_aggregates, compose

REPORT_TYPES = {
    "overall": "Overall Sentiment Report",
    "platform": "Platform-Specific Report",
    "negative": "Negative Feedback Report",
    "positive": "Positive Feedback Report",
    "complaints": "Complaint Analysis Report",
    "priority": "Priority Concerns Report",
    "monthly": "Monthly Sentiment Report",
    "insights": "AI Insights and Recommendations",
}
NAVY, GREEN, GREY, RED = "#0f1f3d", "#1f9d6b", "#8a94a6", "#d64545"


def scope_filters(report_type: str, f: FeedbackFilters) -> FeedbackFilters:
    if report_type == "negative":
        return replace(f, sentiment="negative")
    if report_type == "positive":
        return replace(f, sentiment="positive")
    if report_type == "complaints":
        return replace(f, intent="complaint,reported_problem,follow_up_request")
    if report_type == "priority":
        return replace(f, priority="critical,high")
    return f


def _rows(items: list[Feedback]) -> list[list]:
    return [[fb.id[:8], fb.platform.name, fb.created_at.strftime("%Y-%m-%d %H:%M"), fb.author_ref, fb.content,
             fb.sentiment.final_label, fb.sentiment.score, f"{fb.sentiment.confidence:.0%}", fb.emotion.final_emotion,
             fb.intent.final_intent, ", ".join(t.topic for t in fb.topics), fb.priority.final_level, fb.review_status,
             "yes" if fb.is_sample else "no"] for fb in items]


HEAD = ["ID", "Platform", "Date", "Author", "Feedback", "Sentiment", "Score", "Confidence", "Emotion", "Intent", "Topics",
        "Priority", "Review status", "Sample data"]


def build(db: Session, report_type: str, fmt: str, f: FeedbackFilters, user_id: str | None) -> GeneratedReport:
    scoped = scope_filters(report_type, f)
    start, end = scoped.period()
    scoped.date_from, scoped.date_to = start, end
    items = fetch(db, scoped)
    agg = build_aggregates(db, scoped)
    text = compose(agg)
    title = REPORT_TYPES[report_type] + (f" — {scoped.platform}" if scoped.platform else "")
    out_dir = Path(get_settings().reports_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    path = out_dir / f"{report_type}-{stamp}.{fmt}"
    if fmt == "csv":
        with path.open("w", newline="", encoding="utf-8-sig") as fh:
            w = csv.writer(fh)
            w.writerow([title]); w.writerow([f"Period: {start:%Y-%m-%d} to {end:%Y-%m-%d}"]); w.writerow([])
            w.writerow(HEAD); w.writerows(_rows(items))
    elif fmt == "xlsx":
        _xlsx(path, title, start, end, agg, text, items)
    elif fmt == "pdf":
        _pdf(path, title, start, end, agg, text, items)
    else:
        raise ValueError("Unsupported format")
    rep = GeneratedReport(report_type=report_type, file_format=fmt, period_start=start, period_end=end, file_path=str(path), created_by=user_id)
    db.add(rep)
    db.commit()
    return rep


def _xlsx(path, title, start, end, agg, text, items):
    wb = Workbook()
    ws = wb.active
    ws.title = "Summary"
    ws["A1"] = title; ws["A1"].font = Font(size=16, bold=True, color="0F1F3D")
    ws["A2"] = f"Reporting period: {start:%B %d, %Y} – {end:%B %d, %Y}"
    c = agg["current"]
    rows = [("Total feedback", c["total"]), ("Positive", c["positive"]), ("Neutral", c["neutral"]), ("Negative", c["negative"]),
            ("Average sentiment score", c["average_score"]), ("High priority / critical", c["high_priority"]),
            ("Pending review", c["pending_review"]), ("Sample data items", c.get("sample_count", 0))]
    ws.append([]); ws.append(["Metric", "Value"])
    for cell in ws[4]:
        cell.font = Font(bold=True, color="FFFFFF"); cell.fill = PatternFill("solid", fgColor="0F1F3D")
    for r in rows:
        ws.append(list(r))
    pie = PieChart(); pie.title = "Sentiment distribution"
    pie.add_data(Reference(ws, min_col=2, min_row=6, max_row=8)); pie.set_categories(Reference(ws, min_col=1, min_row=6, max_row=8))
    ws.add_chart(pie, "D4")
    r0 = ws.max_row + 2
    ws.cell(r0, 1, "Key observations").font = Font(bold=True, size=13)
    for i, (k, v) in enumerate(text.items(), start=1):
        ws.cell(r0 + i, 1, k.capitalize()).font = Font(bold=True)
        ws.cell(r0 + i, 2, v).alignment = Alignment(wrap_text=True, vertical="top")
    ws.column_dimensions["A"].width = 26; ws.column_dimensions["B"].width = 90
    ts = wb.create_sheet("Top topics")
    ts.append(["Complaint topic", "Count", "", "Appreciated topic", "Count"])
    for i in range(max(len(agg["top_complaints"]), len(agg["most_appreciated"]))):
        a = agg["top_complaints"][i] if i < len(agg["top_complaints"]) else {"topic": "", "count": None}
        b = agg["most_appreciated"][i] if i < len(agg["most_appreciated"]) else {"topic": "", "count": None}
        ts.append([a["topic"], a["count"], "", b["topic"], b["count"]])
    if agg["top_complaints"]:
        bar = BarChart(); bar.title = "Most common complaints"
        bar.add_data(Reference(ts, min_col=2, min_row=1, max_row=len(agg["top_complaints"]) + 1), titles_from_data=True)
        bar.set_categories(Reference(ts, min_col=1, min_row=2, max_row=len(agg["top_complaints"]) + 1))
        ts.add_chart(bar, "G2")
    fs = wb.create_sheet("Feedback")
    fs.append(HEAD)
    for cell in fs[1]:
        cell.font = Font(bold=True)
    for r in _rows(items):
        fs.append(r)
    fs.column_dimensions["E"].width = 70
    wb.save(path)


def _pdf(path, title, start, end, agg, text, items):
    doc = SimpleDocTemplate(str(path), pagesize=A4, leftMargin=16 * mm, rightMargin=16 * mm, topMargin=16 * mm, bottomMargin=16 * mm,
                            title=title, author="Likha Pulse")
    ss = getSampleStyleSheet()
    h1 = ParagraphStyle("h1", parent=ss["Title"], textColor=colors.HexColor(NAVY), alignment=0, fontSize=20)
    h2 = ParagraphStyle("h2", parent=ss["Heading2"], textColor=colors.HexColor(NAVY))
    body = ParagraphStyle("b", parent=ss["BodyText"], fontSize=9.5, leading=13)
    small = ParagraphStyle("s", parent=body, fontSize=8, leading=10)
    c = agg["current"]
    story = [Paragraph(title, h1), Paragraph(f"Reporting period: {start:%B %d, %Y} – {end:%B %d, %Y} · Generated {datetime.now():%B %d, %Y %H:%M}", small), Spacer(1, 8)]
    if c.get("sample_count"):
        story.append(Paragraph(f"<font color='{RED}'>Includes {c['sample_count']} labeled sample-data items (not real customer feedback).</font>", small))
    kp = [["Total", "Positive", "Neutral", "Negative", "Avg score", "High/critical", "Pending review"],
          [c["total"], f"{c['positive']} ({c['positive_pct']}%)", f"{c['neutral']} ({c['neutral_pct']}%)", f"{c['negative']} ({c['negative_pct']}%)",
           f"{c['average_score']:+}", c["high_priority"], c["pending_review"]]]
    t = Table(kp, hAlign="LEFT")
    t.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, 0), colors.HexColor(NAVY)), ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                           ("FONTSIZE", (0, 0), (-1, -1), 8.5), ("GRID", (0, 0), (-1, -1), 0.3, colors.HexColor("#d5dae3")),
                           ("ALIGN", (0, 0), (-1, -1), "CENTER")]))
    story += [Spacer(1, 6), t, Spacer(1, 10)]
    d = Drawing(480, 150)
    if c["total"]:
        pie = Pie(); pie.x, pie.y, pie.width, pie.height = 10, 10, 120, 120
        pie.data = [c["positive"] or 0.0001, c["neutral"] or 0.0001, c["negative"] or 0.0001]
        pie.labels = ["Positive", "Neutral", "Negative"]
        for i, col in enumerate([GREEN, GREY, RED]):
            pie.slices[i].fillColor = colors.HexColor(col)
        d.add(pie)
    if agg["top_complaints"]:
        bc = VerticalBarChart(); bc.x, bc.y, bc.width, bc.height = 200, 25, 270, 110
        bc.data = [[x["count"] for x in agg["top_complaints"][:5]]]
        bc.categoryAxis.categoryNames = [x["topic"][:14] for x in agg["top_complaints"][:5]]
        bc.categoryAxis.labels.fontSize = 6; bc.valueAxis.labels.fontSize = 7; bc.valueAxis.valueMin = 0
        bc.bars[0].fillColor = colors.HexColor(RED)
        d.add(bc)
    story += [d, Spacer(1, 6), Paragraph("Key observations & recommendations", h2)]
    labels = {"overall": "Overall", "positives": "Most appreciated", "complaints": "Common issues", "emerging": "Emerging issues",
              "recurring": "Recurring concerns", "trend": "Change over time", "actions": "Recommendations"}
    for k, lab in labels.items():
        if text.get(k):
            story.append(Paragraph(f"<b>{lab}.</b> {text[k]}", body)); story.append(Spacer(1, 4))
    story += [Spacer(1, 6), Paragraph(f"Feedback ({min(len(items), 60)} of {len(items)} shown)", h2)]
    rows = [["Date", "Platform", "Feedback", "Sentiment", "Priority"]]
    for fb in items[:60]:
        rows.append([fb.created_at.strftime("%Y-%m-%d"), fb.platform.name.replace("Facebook ", "FB "), Paragraph(fb.content[:300], small),
                     f"{fb.sentiment.final_label} ({fb.sentiment.score:+})", fb.priority.final_level])
    ft = Table(rows, colWidths=[20 * mm, 26 * mm, 92 * mm, 24 * mm, 16 * mm], repeatRows=1)
    ft.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#eef1f6")), ("FONTSIZE", (0, 0), (-1, -1), 7.5),
                            ("VALIGN", (0, 0), (-1, -1), "TOP"), ("LINEBELOW", (0, 0), (-1, -1), 0.25, colors.HexColor("#d5dae3"))]))
    story.append(ft)
    doc.build(story)
