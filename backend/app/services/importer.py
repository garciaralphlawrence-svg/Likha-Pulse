"""Import past feedback from Excel (.xlsx) or CSV: old surveys and past messages, so history and trends start full.

Flow: parse the file -> the team maps the columns (date, client name, message, channel) -> preview -> import.
Every row runs through the same AI engine. Imported rows are saved as history: they count in charts, trends and
client history, but they never open Response Clock cases or alerts. Same rules as frontend/src/lib/teamtools.ts.
"""
from __future__ import annotations

import csv
import io
import re
from datetime import datetime, timedelta, timezone
from pathlib import Path

from sqlalchemy.orm import Session

from app.integrations.base import FetchedItem
from app.services.ingestion import ingest

PH = timezone(timedelta(hours=8))  # dates without a time zone are read as Philippine time
MAX_ROWS = 5000
FIELDS = ("date", "client", "message", "channel")
HINTS = {
    "date": ("date", "petsa", "time", "created", "submitted", "timestamp", "when"),
    "client": ("client", "customer", "name", "pangalan", "traveler", "guest", "author", "sender"),
    "message": ("message", "feedback", "comment", "review", "remarks", "text", "mensahe", "content", "answer"),
    "channel": ("channel", "source", "platform", "via", "where"),
}
MONTHS = {m: i + 1 for i, m in enumerate(["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"])}


SAMPLE_CSV = (Path(__file__).parent / "import_template.csv").read_text(encoding="utf-8")


class ImportFileError(ValueError):
    pass


def _cell(v) -> str:
    if v is None:
        return ""
    if isinstance(v, datetime):
        return v.strftime("%Y-%m-%d %H:%M")
    if isinstance(v, float) and v.is_integer():
        return str(int(v))
    return str(v).strip()


def parse_file(name: str, data: bytes) -> dict:
    """Read the first sheet of an .xlsx file, or a .csv file. Returns the header and the rows as text."""
    lower = (name or "").lower()
    if lower.endswith(".xlsx"):
        from openpyxl import load_workbook
        try:
            wb = load_workbook(io.BytesIO(data), read_only=True, data_only=True)
        except Exception as e:  # noqa: BLE001 - any broken workbook
            raise ImportFileError("This Excel file could not be opened. Save it again as .xlsx or .csv.") from e
        table = [[_cell(c) for c in row] for row in wb.worksheets[0].iter_rows(values_only=True)]
    elif lower.endswith(".csv") or lower.endswith(".txt"):
        try:
            text = data.decode("utf-8-sig")
        except UnicodeDecodeError:
            text = data.decode("cp1252", errors="replace")
        first = text.split("\n", 1)[0]
        delim = max([",", ";", "\t"], key=first.count)
        table = [[c.strip() for c in row] for row in csv.reader(io.StringIO(text), delimiter=delim)]
    else:
        raise ImportFileError("Please upload an Excel (.xlsx) or CSV file.")
    table = [r for r in table if any(c for c in r)]
    if len(table) < 2:
        raise ImportFileError("The file has no rows to import (the first row must be the column names).")
    width = max(len(r) for r in table)
    header = [(table[0][i] if i < len(table[0]) else "") or f"Column {i + 1}" for i in range(width)]
    rows = [r + [""] * (width - len(r)) for r in table[1:]]
    if len(rows) > MAX_ROWS:
        raise ImportFileError(f"The file has {len(rows)} rows. Import at most {MAX_ROWS} rows at a time.")
    return {"columns": header, "rows": rows, "total": len(rows), "mapping": guess_mapping(header)}


def guess_mapping(columns: list[str]) -> dict:
    out: dict[str, int | None] = {f: None for f in FIELDS}
    used: set[int] = set()
    for f in ("message", "date", "client", "channel"):
        for i, c in enumerate(columns):
            if i not in used and any(h in c.lower() for h in HINTS[f]):
                out[f] = i
                used.add(i)
                break
    return out


def parse_date(value: str, now: datetime | None = None) -> datetime | None:
    """Accepts 2025-11-03, 2025-11-03 14:20, 11/03/2025 (month first, unless the first number is above 12),
    3 Nov 2025, Nov 3, 2025 and Excel date numbers."""
    v = (value or "").strip()
    if not v:
        return None
    if re.fullmatch(r"\d{5}(\.\d+)?", v):  # Excel serial day number
        d = datetime(1899, 12, 30) + timedelta(days=float(v))
        return d.replace(tzinfo=PH)
    t = re.search(r"(\d{1,2}):(\d{2})(?::\d{2})?\s*([ap]\.?m\.?)?", v, re.I)
    hh, mm = (int(t.group(1)), int(t.group(2))) if t else (9, 0)
    if t and t.group(3):
        pm = t.group(3).lower().startswith("p")
        hh = (hh % 12) + (12 if pm else 0)
    date_part = v[:t.start()] if t else v
    y = mo = d = None
    if m := re.match(r"\s*(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})", date_part):
        y, mo, d = int(m.group(1)), int(m.group(2)), int(m.group(3))
    elif m := re.match(r"\s*(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})", date_part):
        a, b, y = int(m.group(1)), int(m.group(2)), int(m.group(3))
        mo, d = (b, a) if a > 12 else (a, b)
    elif m := re.match(r"\s*(\d{1,2})\s+([a-z]{3})[a-z]*\.?,?\s+(\d{4})", date_part, re.I):
        d, mo, y = int(m.group(1)), MONTHS.get(m.group(2).lower()), int(m.group(3))
    elif m := re.match(r"\s*([a-z]{3})[a-z]*\.?\s+(\d{1,2}),?\s+(\d{4})", date_part, re.I):
        mo, d, y = MONTHS.get(m.group(1).lower()), int(m.group(2)), int(m.group(3))
    if not (y and mo and d):
        return None
    if y < 100:
        y += 2000
    try:
        return datetime(y, mo, d, min(hh, 23), min(mm, 59), tzinfo=PH)
    except ValueError:
        return None


def channel_code(value: str) -> str:
    v = (value or "").lower()
    if any(w in v for w in ("messenger", "chat", "inbox", "pm", "dm")):
        return "messenger"
    if any(w in v for w in ("facebook", "fb", "comment", "post")):
        return "facebook_page"
    return "import"


def import_rows(db: Session, rows: list[dict], now: datetime | None = None) -> dict:
    """rows: [{date, client, message, channel}] as text (already mapped). Returns counts and the skipped rows."""
    now = now or datetime.now(timezone.utc)
    if len(rows) > MAX_ROWS:
        raise ImportFileError(f"Import at most {MAX_ROWS} rows at a time.")
    imported = duplicates = 0
    skipped: list[dict] = []
    by_channel: dict[str, int] = {}
    for n, r in enumerate(rows, start=2):  # row 1 is the header in the file
        msg = (r.get("message") or "").strip()
        if len(msg) < 2:
            skipped.append({"row": n, "reason": "No message"})
            continue
        when = parse_date(r.get("date") or "")
        if not when:
            skipped.append({"row": n, "reason": "Date not readable"})
            continue
        if when > now + timedelta(days=1):
            skipped.append({"row": n, "reason": "Date is in the future"})
            continue
        client = (r.get("client") or "").strip()[:120] or None
        code = channel_code(r.get("channel") or "")
        item = FetchedItem(external_id=None, content=msg[:5000], created_at=min(when, now), author=client, author_name=client)
        if ingest(db, code, item, history=True):
            imported += 1
            by_channel[code] = by_channel.get(code, 0) + 1
        else:
            duplicates += 1
    return {"total": len(rows), "imported": imported, "duplicates": duplicates, "skipped": skipped[:200],
            "skipped_count": len(skipped), "by_channel": by_channel}
