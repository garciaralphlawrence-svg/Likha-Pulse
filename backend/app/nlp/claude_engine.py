"""Optional Claude-powered analysis. Used only when an Anthropic API key is configured.

One structured-output request per message returns sentiment, score, confidence, emotion,
intent, topics, sarcasm flag, priority and explanations as validated JSON. Any failure
(network, rate limit, refusal, invalid output) raises ClaudeUnavailable so the pipeline
falls back to the free rule engine.
"""
from __future__ import annotations

import json
import logging

import anthropic

from app.nlp.rule_engine import EMOTIONS, INTENTS, Analysis, LEXICON

log = logging.getLogger(__name__)

PRIORITIES = ["critical", "high", "medium", "low"]
TOPICS = list(LEXICON["topics"].keys()) + ["General"]

SCHEMA = {
    "type": "object",
    "additionalProperties": False,
    "required": ["sentiment", "score", "confidence", "emotion", "intent", "intent_reason", "topics",
                 "possible_sarcasm", "reason", "priority", "priority_reason", "recommended_action", "language"],
    "properties": {
        "sentiment": {"type": "string", "enum": ["positive", "negative", "neutral"]},
        "score": {"type": "integer", "description": "-100 (very negative) to +100 (very positive)"},
        "confidence": {"type": "number", "description": "0 to 1: how certain the classification is"},
        "emotion": {"type": "string", "enum": EMOTIONS},
        "intent": {"type": "string", "enum": INTENTS},
        "intent_reason": {"type": "string"},
        "topics": {"type": "array", "items": {"type": "string", "enum": TOPICS}},
        "possible_sarcasm": {"type": "boolean"},
        "reason": {"type": "string"},
        "priority": {"type": "string", "enum": PRIORITIES},
        "priority_reason": {"type": "string"},
        "recommended_action": {"type": "string"},
        "language": {"type": "string", "enum": ["english", "filipino", "taglish", "unknown"]},
    },
}

SYSTEM = """You analyze customer feedback for a business's management team. Messages may be in English, Filipino/Tagalog, or Taglish; read them in their original language and understand common Filipino expressions.

Judge the whole message in context, not individual keywords. When a message has a contrast ("okay naman ... pero ...", "good but ..."), the part after the contrast usually decides the sentiment. Positive words describing a bad experience ("Wow, excellent service! I waited five hours.") are sarcasm: mark possible_sarcasm true and treat the sentiment as negative; if you are unsure whether it is sarcasm, lower the confidence.

Fields:
- score: direction and strength of sentiment from -100 to +100. Use about -25 or below for negative, +25 or above for positive, values in between for neutral.
- confidence: how certain you are about the classification, 0 to 1. This is not the sentiment strength.
- priority is urgency, decided separately from sentiment. critical = safety/health problems, legal threats, harassment, fraud, or urgent unresolved problems; high = strong dissatisfaction, repeated or unresolved complaints; medium = general complaints, suggestions, follow-ups; low = inquiries, compliments, ordinary feedback. A neutral question can be critical; a negative comment is not automatically critical.
- reason, intent_reason, priority_reason: one or two plain sentences explaining why, quoting the words that drove the decision.
- recommended_action: one practical next step for management.
- topics: up to three from the allowed list, most important first; use "General" if none fit.
Never invent facts that are not in the message."""


class ClaudeUnavailable(Exception):
    pass


def analyze_with_claude(text: str, api_key: str, model: str, rating: float | None = None,
                        context: str = "") -> Analysis:
    client = anthropic.Anthropic(api_key=api_key, max_retries=2, timeout=60.0)
    user = f"Message:\n\"\"\"\n{text}\n\"\"\""
    if rating is not None:
        user += f"\nStar rating given with the message: {rating:g} out of 5."
    if context:
        user += f"\nContext: {context}"
    try:
        resp = client.beta.messages.create(
            model=model,
            max_tokens=2048,
            system=SYSTEM,
            messages=[{"role": "user", "content": user}],
            output_config={"effort": "low", "format": {"type": "json_schema", "schema": SCHEMA}},
            betas=["server-side-fallback-2026-07-01"],
            fallbacks="default",
        )
    except anthropic.AuthenticationError as e:
        raise ClaudeUnavailable("Invalid Anthropic API key") from e
    except anthropic.RateLimitError as e:
        raise ClaudeUnavailable("Claude rate limit reached") from e
    except anthropic.APIStatusError as e:
        raise ClaudeUnavailable(f"Claude API error {e.status_code}") from e
    except anthropic.APIConnectionError as e:
        raise ClaudeUnavailable("Could not reach the Claude API") from e

    if resp.stop_reason == "refusal":
        raise ClaudeUnavailable("Claude declined to analyze this message")
    if resp.stop_reason == "max_tokens":
        raise ClaudeUnavailable("Claude response was cut off")
    text_out = "".join(b.text for b in resp.content if getattr(b, "type", "") == "text")
    try:
        d = json.loads(text_out)
    except json.JSONDecodeError as e:
        raise ClaudeUnavailable("Claude returned invalid JSON") from e

    score = int(max(-100, min(100, d["score"])))
    topics = [t for t in d["topics"] if t in TOPICS][:3] or ["General"]
    return Analysis(
        label=d["sentiment"], score=score, confidence=round(max(0.0, min(1.0, float(d["confidence"]))), 2),
        emotion=d["emotion"], emotion_scores={d["emotion"]: 1}, intent=d["intent"], intent_reason=d["intent_reason"],
        topics=topics, primary_topic=topics[0], possible_sarcasm=bool(d["possible_sarcasm"]), reason=d["reason"],
        priority=d["priority"], priority_reason=d["priority_reason"], recommended_action=d["recommended_action"],
        language=d["language"], engine="claude", model_version=getattr(resp, "model", model) or model,
    )
