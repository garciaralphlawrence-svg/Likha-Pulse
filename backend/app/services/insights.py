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
        msg = "No messages came in during this period."
        return {k: msg if k == "overall" else "" for k in ("overall", "positives", "complaints", "emerging", "recurring", "trend", "actions")}
    s = {}
    s["overall"] = (f"You received {c['total']} messages: {c['positive']} from happy customers ({c['positive_pct']}%), "
                    f"{c['neutral']} neutral and {c['negative']} from unhappy customers ({c['negative_pct']}%). "
                    + ((f"{c['high_priority']} need your attention"
                        + (f", and {c['pending_review']} are unclear and worth a quick look." if c["pending_review"] else "."))
                       if c["high_priority"] else "Nothing urgent came in."))
    if c.get("sample_count"):
        s["overall"] += f" Note: {c['sample_count']} of these are sample messages for preview, not real customers."
    ma = agg["most_appreciated"]
    s["positives"] = ("Happy customers most often mention " + ", ".join(f"{t['topic']} ({t['count']})" for t in ma[:3]) + "."
                      ) if ma else "No single thing stood out in the happy messages."
    tc = agg["top_complaints"]
    s["complaints"] = ("Most complaints are about " + ", ".join(f"{t['topic']} ({t['count']})" for t in tc[:3]) + "."
                       ) if tc else "No common complaint this period."
    em = agg["emerging"]
    s["emerging"] = ("New issues growing fast (complaints at least doubled): " +
                     ", ".join(f"{e['topic']} ({e['before']} → {e['now']})" for e in em) + "."
                     ) if em else "No new problem is growing quickly."
    s["recurring"] = ("These problems keep coming back: " + ", ".join(agg["recurring"]) + "."
                      ) if agg["recurring"] else "No problem keeps repeating."
    if p["total"]:
        better = c["negative_pct"] <= p["negative_pct"]
        s["trend"] = (("Things are improving: " if better else "Things got worse: ")
                      + f"unhappy messages went from {p['negative_pct']}% to {c['negative_pct']}% compared with the period before.")
    else:
        s["trend"] = "Not enough history yet to compare with an earlier period."
    acts = []
    if tc:
        acts.append(f"Fix the biggest complaint first: {tc[0]['topic'].lower()}. Assign one person to own it.")
    if em:
        acts.append(f"Look into {em[0]['topic'].lower()} now, before it becomes a bigger problem.")
    if c["unresolved_high_priority"]:
        acts.append(f"Reply to the {c['unresolved_high_priority']} customers who still need an answer.")
    if agg["assistance_requests"]:
        acts.append(f"{agg['assistance_requests']} customers asked for help or an update. Make sure someone replies quickly.")
    if c["pending_review"]:
        acts.append(f"Take a quick look at {c['pending_review']} unclear messages (some may be sarcasm).")
    if ma:
        acts.append(f"Thank your team: customers love your {ma[0]['topic'].lower()}.")
    s["actions"] = "\n".join(acts) or "Keep doing what you are doing. Nothing needs action right now."
    return s


INSIGHT_SCHEMA = {"type": "object", "additionalProperties": False,
                  "required": ["overall", "positives", "complaints", "emerging", "recurring", "trend", "actions"],
                  "properties": {k: {"type": "string"} for k in ["overall", "positives", "complaints", "emerging", "recurring", "trend", "actions"]}}


def _claude_rewrite(agg: dict, draft: dict, key: str, model: str) -> dict | None:
    client = anthropic.Anthropic(api_key=key, max_retries=2, timeout=90.0)
    prompt = ("Rewrite these findings as a short, friendly briefing for a busy business owner, one or two plain sentences per field, with no technical words. "
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
