"""AI insights built from real aggregates. The text only states numbers found in the data.

With Claude enabled, Claude rewrites the computed findings into management prose; it receives
only the aggregates and is told not to add any figure that is not in them.
"""
from __future__ import annotations

import json
import logging
from dataclasses import replace

import anthropic
from sqlalchemy.orm import Session

from app.models import AIInsight
from app.nlp.pipeline import claude_key
from app.services.analytics import auto_granularity, summarize
from app.services.filters import FeedbackFilters, fetch
from app.services.settings_service import get_setting

log = logging.getLogger(__name__)
PRETTY = lambda s: s.replace("_", " ")


def build_aggregates(db: Session, f: FeedbackFilters) -> dict:
    start, end = f.period()
    cur = summarize(fetch(db, replace(f, date_from=start, date_to=end)), auto_granularity(start, end))
    span = end - start
    prev = summarize(fetch(db, replace(f, date_from=start - span, date_to=start)), "day")
    cur_neg = {t["topic"]: t["count"] for t in cur["top_complaints"]}
    prev_neg = {t["topic"]: t["count"] for t in prev["top_complaints"]}
    emerging = sorted(((t, n, prev_neg.get(t, 0)) for t, n in cur_neg.items() if n >= 2 and n >= 2 * max(1, prev_neg.get(t, 0))),
                      key=lambda x: -(x[1] - x[2]))
    recurring = [t for t, n in cur_neg.items() if n >= 3 and prev_neg.get(t, 0) >= 2]
    assistance = sum(i["count"] for i in cur["intents"] if i["intent"] in ("request_assistance", "follow_up_request"))
    return {
        "period": {"from": start.isoformat(), "to": end.isoformat()},
        "current": cur["kpis"], "previous": prev["kpis"],
        "top_complaints": cur["top_complaints"], "most_appreciated": cur["most_appreciated"],
        "emotions": cur["emotions"][:5], "emerging": [{"topic": t, "now": n, "before": b} for t, n, b in emerging[:4]],
        "recurring": recurring, "assistance_requests": assistance, "by_platform": cur["by_platform"],
    }


def _delta(a: float, b: float) -> str:
    d = round(a - b, 1)
    return "unchanged" if d == 0 else (f"up {d} points" if d > 0 else f"down {abs(d)} points")


def compose(agg: dict) -> dict:
    c, p = agg["current"], agg["previous"]
    if c["total"] == 0:
        msg = "No feedback was collected in the selected period, so there is nothing to summarize yet."
        return {k: msg if k == "overall" else "" for k in ("overall", "positives", "complaints", "emerging", "recurring", "trend", "actions")}
    s = {}
    s["overall"] = (f"{c['total']} feedback items were analyzed: {c['positive']} positive ({c['positive_pct']}%), "
                    f"{c['neutral']} neutral ({c['neutral_pct']}%) and {c['negative']} negative ({c['negative_pct']}%). "
                    f"The average sentiment score is {c['average_score']:+}. {c['high_priority']} item(s) are high priority or critical"
                    + (f", and {c['pending_review']} are waiting for human review." if c["pending_review"] else "."))
    if c.get("sample_count"):
        s["overall"] += f" Note: {c['sample_count']} of these items are labeled sample data, not real customer feedback."
    ma = agg["most_appreciated"]
    s["positives"] = ("Positive feedback most often mentioned " + ", ".join(f"{t['topic']} ({t['count']})" for t in ma[:3]) + "."
                      ) if ma else "No recurring positive topic stood out in this period."
    tc = agg["top_complaints"]
    s["complaints"] = ("The most common complaints were about " + ", ".join(f"{t['topic']} ({t['count']})" for t in tc[:3]) + "."
                       ) if tc else "No recurring complaint topic was found."
    em = agg["emerging"]
    s["emerging"] = ("Emerging issues (complaints at least doubled versus the previous period): " +
                     ", ".join(f"{e['topic']} ({e['before']} → {e['now']})" for e in em) + "."
                     ) if em else "No new issue grew sharply compared with the previous period."
    s["recurring"] = ("Recurring concerns seen in both this and the previous period: " + ", ".join(agg["recurring"]) + "."
                      ) if agg["recurring"] else "No complaint topic repeated strongly across both periods."
    if p["total"]:
        s["trend"] = (f"Compared with the previous period of the same length, negative share is {_delta(c['negative_pct'], p['negative_pct'])} "
                      f"({p['negative_pct']}% → {c['negative_pct']}%) and the average score moved from {p['average_score']:+} to {c['average_score']:+}.")
    else:
        s["trend"] = "There is no data for the previous period, so changes over time cannot be measured yet."
    acts = []
    if tc:
        acts.append(f"Review the process behind {tc[0]['topic']}, the top complaint topic, and assign an owner to monitor it.")
    if em:
        acts.append(f"Investigate the rise in complaints about {em[0]['topic']} before it becomes a recurring problem.")
    if c["unresolved_high_priority"]:
        acts.append(f"Resolve the {c['unresolved_high_priority']} open high-priority or critical item(s) and close the loop with each customer.")
    if agg["assistance_requests"]:
        acts.append(f"{agg['assistance_requests']} message(s) asked for help or an update; check response handling and reply times.")
    if c["pending_review"]:
        acts.append(f"Have a reviewer validate the {c['pending_review']} low-confidence or possibly sarcastic classifications.")
    if ma:
        acts.append(f"Recognize the team for {ma[0]['topic']}, the most appreciated area.")
    s["actions"] = " ".join(acts) or "No specific action is needed based on this period's data."
    return s


INSIGHT_SCHEMA = {"type": "object", "additionalProperties": False,
                  "required": ["overall", "positives", "complaints", "emerging", "recurring", "trend", "actions"],
                  "properties": {k: {"type": "string"} for k in ["overall", "positives", "complaints", "emerging", "recurring", "trend", "actions"]}}


def _claude_rewrite(agg: dict, draft: dict, key: str, model: str) -> dict | None:
    client = anthropic.Anthropic(api_key=key, max_retries=2, timeout=90.0)
    prompt = ("Rewrite these findings as a clear executive summary for management, one short paragraph per field. "
              "Use only the numbers that appear in the aggregates and draft; do not add, estimate or round any figure, "
              "and keep the note about sample data if present.\n\nAggregates:\n" + json.dumps(agg, default=str) +
              "\n\nDraft findings:\n" + json.dumps(draft))
    try:
        resp = client.beta.messages.create(model=model, max_tokens=4096, messages=[{"role": "user", "content": prompt}],
                                           output_config={"effort": "low", "format": {"type": "json_schema", "schema": INSIGHT_SCHEMA}},
                                           betas=["server-side-fallback-2026-07-01"], fallbacks="default")
    except anthropic.APIError as e:
        log.warning("Claude insight rewrite failed: %s", e)
        return None
    if resp.stop_reason in ("refusal", "max_tokens"):
        return None
    try:
        return json.loads("".join(b.text for b in resp.content if getattr(b, "type", "") == "text"))
    except json.JSONDecodeError:
        return None


def generate(db: Session, f: FeedbackFilters, user_id: str | None = None) -> AIInsight:
    agg = build_aggregates(db, f)
    summary, engine = compose(agg), "rule"
    provider, key = get_setting(db, "ai_provider"), claude_key(db)
    if provider.get("provider") == "claude" and key and agg["current"]["total"]:
        out = _claude_rewrite(agg, summary, key, provider.get("claude_model", "claude-opus-5-5"))
        if out:
            summary, engine = out, "claude"
    start, end = f.period()
    ins = AIInsight(period_start=start, period_end=end, summary=summary, aggregates=agg, engine=engine, created_by=user_id,
                    filters={k: v for k, v in vars(f).items() if v and not isinstance(v, (bool,)) and k not in ("date_from", "date_to")})
    db.add(ins)
    db.commit()
    return ins
