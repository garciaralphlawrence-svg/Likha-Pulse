"""Free analysis engine for English, Filipino and Taglish.

It reads the whole sentence, not single keywords:
- negation flips meaning ("hindi maganda" -> negative),
- intensifiers strengthen it ("sobrang tagal"),
- after a contrast word ("pero", "but", "kaso") the second clause dominates,
- praise combined with a bad experience is flagged as possible sarcasm.

The same algorithm is ported to TypeScript for the in-browser demo (frontend/src/demo/engine.ts).
Keep both in sync; tests/test_engine.py and frontend/scripts/engine-test.mjs check the same examples.
"""
from __future__ import annotations

import json
import math
import re
from dataclasses import dataclass, field
from pathlib import Path

LEXICON = json.loads((Path(__file__).parent / "lexicon.json").read_text(encoding="utf-8"))
ENGINE_VERSION = f"rule-engine-1.0 (lexicon {LEXICON['version']})"

EMOTIONS = ["happiness", "satisfaction", "appreciation", "anger", "frustration", "disappointment",
            "sadness", "confusion", "concern", "excitement", "neutral"]
INTENTS = ["complaint", "compliment", "inquiry", "suggestion", "request_assistance", "general_feedback",
           "reported_problem", "appreciation", "follow_up_request"]

TIME_PATTERN = re.compile(r"\b(\d+|one|two|three|four|five|six|isang|dalawang|tatlong)\s*(hours?|hrs?|oras|minutes?|mins?|days?|araw|weeks?|linggo)\b")


@dataclass
class Signal:
    term: str
    weight: float
    note: str = ""


@dataclass
class Analysis:
    label: str
    score: int
    confidence: float
    emotion: str
    emotion_scores: dict
    intent: str
    intent_reason: str
    topics: list[str]
    primary_topic: str
    possible_sarcasm: bool
    reason: str
    priority: str = "low"
    priority_reason: str = ""
    recommended_action: str = ""
    language: str = "unknown"
    engine: str = "rule"
    model_version: str = ENGINE_VERSION
    signals: list[Signal] = field(default_factory=list)


def normalize(text: str) -> str:
    t = text.lower().replace("’", "'").replace("‘", "'").replace("“", '"').replace("”", '"')
    t = re.sub(r"https?://\S+", " ", t)
    t = t.replace("'", "")
    t = re.sub(r"[^a-z0-9ñ?!\s-]", " ", t)
    t = t.replace("-", " ")
    return re.sub(r"\s+", " ", t).strip()


def _find_all(padded: str, term: str) -> list[int]:
    """Start indexes (in padded string) of whole-word matches of term."""
    out, needle, i = [], f" {term} ", 0
    while True:
        i = padded.find(needle, i)
        if i < 0:
            return out
        out.append(i + 1)
        i += 1


def _contains(padded: str, term: str) -> bool:
    return f" {term} " in padded


def detect_language(norm: str) -> str:
    fil = {"ang", "ng", "po", "naman", "pero", "sobrang", "hindi", "di", "ba", "mga", "sa", "na", "ko", "ako", "kayo", "nyo", "lang", "talaga", "sana", "kasi"}
    en = {"the", "is", "and", "but", "very", "not", "was", "i", "you", "it", "to", "for", "my", "service", "please"}
    words = norm.replace("?", " ").replace("!", " ").split()
    f = sum(w in fil for w in words)
    e = sum(w in en for w in words)
    if f and e:
        return "taglish"
    if f:
        return "filipino"
    if e:
        return "english"
    return "unknown"


def _score_terms(norm: str, contrast_at: int | None) -> list[Signal]:
    padded = f" {norm.replace('?', ' ').replace('!', ' ')} "
    terms = [(t, w) for t, w in LEXICON["positive"].items()] + [(t, w) for t, w in LEXICON["negative"].items()]
    terms.sort(key=lambda tw: -len(tw[0]))  # longest phrase wins overlaps
    negators = set(LEXICON["negators"])
    intens = LEXICON["intensifiers"]
    # pass 1: find non-overlapping matches
    matches: list[tuple[int, int, str, float]] = []
    for term, weight in terms:
        if weight == 0:
            continue
        for start in _find_all(padded, term):
            end = start + len(term)
            if any(s < end and start < e for s, e, _, _ in matches):
                continue
            matches.append((start, end, term, float(weight)))
    matches.sort()
    # pass 2: left to right; negation/intensifiers only look back to the previous matched phrase
    signals: list[Signal] = []
    prev_end = 0
    for start, end, term, weight in matches:
        before = padded[prev_end:start].split()[-3:]
        prev_end = end
        w, notes = weight, []
        if any(b in negators for b in before) and not term.startswith(("wala", "walang", "hindi", "di ", "no ", "not ", "never")):
            w = -w * 0.8
            notes.append("negated")
        mult = max([intens.get(b, 1.0) for b in before[-2:]] + [1.0])
        if mult > 1:
            w *= mult
            notes.append("intensified")
        if contrast_at is not None:
            if start < contrast_at:
                w *= 0.4
                notes.append("before contrast")
            else:
                w *= 1.4
                notes.append("after contrast")
        signals.append(Signal(term, round(w, 2), ", ".join(notes)))
    return signals


def _contrast_position(norm: str) -> tuple[int | None, str | None]:
    padded = f" {norm} "
    best, word = None, None
    for c in LEXICON["contrast"]:
        for pos in _find_all(padded, c):
            if pos > 2 and (best is None or pos > best):
                best, word = pos, c
    return best, word


def _keyword_hits(padded: str, words: list[str]) -> list[str]:
    return [w for w in words if _contains(padded, w)]


def analyze(text: str, rating: float | None = None, thresholds: dict | None = None,
            review_threshold: float = 0.70) -> Analysis:
    th = thresholds or {"negative_max": -25, "positive_min": 25}
    norm = normalize(text)
    padded = f" {norm.replace('?', ' ? ').replace('!', ' ! ')} "
    contrast_at, contrast_word = _contrast_position(norm)
    signals = _score_terms(norm, contrast_at)
    raw = sum(s.weight for s in signals)
    if "!" in text and raw:
        raw *= 1.1

    # sarcasm: praise words + a clearly negative experience in the same message
    praise = _keyword_hits(padded, LEXICON["sarcasm_praise"])
    neg_markers = _keyword_hits(padded, LEXICON["sarcasm_negative_markers"]) + [m.group(0) for m in TIME_PATTERN.finditer(norm)]
    possible_sarcasm = bool(praise) and bool(neg_markers) and raw > -1.5

    score = 100 * math.tanh(raw / 4.0)
    if rating is not None:
        rating_score = (float(rating) - 3.0) / 2.0 * 80
        score = rating_score if not signals else 0.5 * score + 0.5 * rating_score
    if possible_sarcasm:
        score = min(-40.0, -abs(score))
    score_i = int(round(max(-100, min(100, score))))
    label = "negative" if score_i <= th["negative_max"] else "positive" if score_i >= th["positive_min"] else "neutral"

    # emotion
    emo_clause = f" {norm[contrast_at:]} " if contrast_at else padded
    emo_scores = {e: len(_keyword_hits(padded, LEXICON["emotions"][e])) + len(_keyword_hits(emo_clause, LEXICON["emotions"][e])) * (1 if contrast_at else 0)
                  for e in LEXICON["emotions"]}
    neg_emos, pos_emos = ("anger", "frustration", "disappointment", "sadness", "concern"), ("happiness", "satisfaction", "appreciation", "excitement")
    if possible_sarcasm:
        emo_scores["frustration"] += 2
    if "?" in text and any(_contains(padded, w) for w in ("paano", "bakit", "how", "why")):
        emo_scores["confusion"] += 1
    pool = neg_emos + ("confusion",) if label == "negative" else pos_emos if label == "positive" else tuple(emo_scores)
    best_emo = max(pool, key=lambda k: emo_scores.get(k, 0))
    if emo_scores.get(best_emo, 0) == 0:
        best_emo = max(emo_scores, key=lambda k: emo_scores[k])
    if emo_scores[best_emo] == 0:
        best_emo = {"positive": "satisfaction", "negative": "disappointment"}.get(label, "neutral")
    elif label == "positive" and best_emo in ("frustration", "anger", "disappointment", "sadness") and not possible_sarcasm:
        best_emo = "satisfaction"
    elif label == "negative" and best_emo in ("happiness", "satisfaction", "appreciation", "excitement"):
        best_emo = "frustration" if possible_sarcasm or neg_markers else "disappointment"

    # intent
    hits = {k: _keyword_hits(padded, v) for k, v in LEXICON["intents"].items()}
    first_word = norm.split()[0] if norm else ""
    is_question = "?" in text or first_word in LEXICON["question_starters"] and len(norm.split()) <= 12
    if hits["follow_up_request"]:
        intent, why = "follow_up_request", f"asks for an update ('{hits['follow_up_request'][0]}')"
    elif hits["request_assistance"]:
        intent, why = "request_assistance", f"asks for help ('{hits['request_assistance'][0]}')"
    elif hits["reported_problem"]:
        intent, why = "reported_problem", f"reports a problem ('{hits['reported_problem'][0]}')"
    elif label == "negative":
        intent, why = "complaint", "expresses dissatisfaction"
    elif is_question or hits["inquiry"] and label == "neutral":
        intent, why = "inquiry", "asks a question" + (f" ('{hits['inquiry'][0]}')" if hits["inquiry"] else "")
    elif hits["suggestion"]:
        intent, why = "suggestion", f"proposes an improvement ('{hits['suggestion'][0]}')"
    elif label == "positive" and hits["appreciation"]:
        intent, why = "appreciation", f"thanks the business ('{hits['appreciation'][0]}')"
    elif label == "positive":
        intent, why = "compliment", "praises the service"
    else:
        intent, why = "general_feedback", "shares an opinion without a request"

    # topics: the clause after a contrast word decides the main topic
    topic_hits: dict[str, int] = {}
    main_clause = f" {norm[contrast_at:]} " if contrast_at else padded
    for topic, words in LEXICON["topics"].items():
        n = len(_keyword_hits(padded, words))
        if n:
            topic_hits[topic] = n + 2 * len(_keyword_hits(main_clause, words))
    topics = sorted(topic_hits, key=lambda k: -topic_hits[k]) or ["General"]

    # confidence (how sure the engine is; not the same as sentiment strength)
    signs = {1 if s.weight > 0 else -1 for s in signals}
    conf = 0.55 + min(0.3, 0.06 * len(signals))
    if len(signs) == 1:
        conf += 0.08
    elif len(signs) > 1 and contrast_at is None:
        conf -= 0.18
    if rating is not None:
        conf += 0.07
    if not signals:
        conf = 0.72 if intent == "inquiry" else 0.5
    if possible_sarcasm:
        conf = min(conf, 0.6)
    conf = round(max(0.3, min(0.97, conf)), 2)

    reason = _explain(label, score_i, signals, contrast_word, possible_sarcasm, praise, neg_markers, rating)
    a = Analysis(label=label, score=score_i, confidence=conf, emotion=best_emo, emotion_scores=emo_scores,
                 intent=intent, intent_reason=f"The message {why}.", topics=topics[:3], primary_topic=topics[0],
                 possible_sarcasm=possible_sarcasm, reason=reason, language=detect_language(norm), signals=signals)
    return a


def _explain(label, score, signals, contrast_word, sarcasm, praise, neg_markers, rating) -> str:
    if sarcasm:
        return (f"Possible sarcasm: positive wording ({', '.join(repr(p) for p in praise[:2])}) contradicts a negative "
                f"experience ({', '.join(repr(m) for m in neg_markers[:2])}). Treated as negative and sent for manual review.")
    if not signals:
        base = "No clear positive or negative wording was found, so the message is treated as neutral."
        return base + (f" The {rating:g}-star rating was used." if rating is not None else "")
    pos = [s for s in signals if s.weight > 0]
    neg = [s for s in signals if s.weight < 0]
    def fmt(items):
        return ", ".join(f"'{s.term}'" + (f" ({s.note})" if s.note else "") for s in sorted(items, key=lambda s: -abs(s.weight))[:3])
    parts = []
    if contrast_word and pos and neg:
        after = [s for s in signals if "after contrast" in s.note]
        side = "negative" if sum(s.weight for s in after) < 0 else "positive"
        parts.append(f"The message changes direction at '{contrast_word}'; the part after it is {side} and carries more weight.")
    if neg:
        parts.append(f"Negative cues: {fmt(neg)}.")
    if pos:
        parts.append(f"Positive cues: {fmt(pos)}.")
    if rating is not None:
        parts.append(f"Star rating {rating:g}/5 was combined with the text.")
    parts.append(f"Overall score {score:+d} → {label}.")
    return " ".join(parts)


def assess_priority(a: Analysis, text: str, repeated_count: int = 0, unresolved_days: int = 0) -> tuple[str, str]:
    """Urgency is decided separately from sentiment. Returns (level, reason)."""
    padded = f" {normalize(text)} "
    critical = _keyword_hits(padded, LEXICON["critical_terms"])
    if critical:
        return "critical", f"Mentions a sensitive or safety-related issue ('{critical[0]}'). Needs immediate review regardless of tone."
    if a.score <= -80:
        return "high", f"Strong dissatisfaction (score {a.score})."
    if repeated_count >= 3 and a.label == "negative":
        return "high", f"Repeated complaint: {repeated_count} similar negative messages about {a.primary_topic} in the last 7 days."
    if a.intent == "follow_up_request" or unresolved_days >= 3:
        return "high", "The customer is still waiting for a resolution or reply."
    if a.intent in ("reported_problem", "request_assistance"):
        return "medium", "Reports a problem or asks for help; needs follow-up."
    if a.label == "negative":
        return "medium", "General complaint that should be acknowledged."
    if a.intent == "suggestion":
        return "medium", "Suggestion worth reviewing."
    if a.possible_sarcasm:
        return "medium", "Possible sarcasm; confirm the real sentiment."
    return "low", "Inquiry, compliment or ordinary feedback with no urgent signal."


ACTIONS = {
    "critical": "Escalate to the manager on duty today, contact the customer privately, and document the case.",
    "follow_up_request": "Reply with a concrete status update and a timeline; close the loop once resolved.",
    "request_assistance": "Assign a staff member to assist and confirm the next step with the customer.",
    "reported_problem": "Log the problem, investigate the cause, and tell the customer when it is fixed.",
    "complaint": "Acknowledge the concern, apologize where appropriate, and review the process involved.",
    "inquiry": "Answer the question; consider adding it to the FAQ if it comes up often.",
    "suggestion": "Thank the customer and forward the suggestion to the team for evaluation.",
    "compliment": "Thank the customer publicly and share the praise with the staff involved.",
    "appreciation": "Thank the customer and share the feedback with the team.",
    "general_feedback": "Acknowledge the feedback; no immediate action needed.",
}


def recommend(a: Analysis) -> str:
    if a.priority == "critical":
        return ACTIONS["critical"]
    return ACTIONS.get(a.intent, ACTIONS["general_feedback"])
