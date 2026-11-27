"""Customer sentiment engine (English, Tagalog, Taglish): the shared cases must be classified as specified."""
import json
from pathlib import Path

import pytest

from app.sentiment.rule_engine import analyze, assess_priority

CASES = json.loads((Path(__file__).parent / "sentiment_cases.json").read_text(encoding="utf-8"))


@pytest.mark.parametrize("case", CASES, ids=[c["text"][:40] for c in CASES])
def test_engine_case(case):
    a = analyze(case["text"])
    a.priority, _ = assess_priority(a, case["text"])
    for key in ("label", "emotion", "intent", "primary_topic", "possible_sarcasm", "priority"):
        if key in case:
            assert getattr(a, key) == case[key], f"{key}: got {getattr(a, key)!r} for {case['text']!r}"


def test_score_and_confidence_are_separate():
    a = analyze("Sobrang bagal ng process.")
    assert -100 <= a.score <= 100 and 0 <= a.confidence <= 1
    assert a.score < 0 and a.confidence > 0


def test_thresholds_are_configurable():
    text = "Okay naman."
    default = analyze(text)
    strict = analyze(text, thresholds={"negative_max": -90, "positive_min": 5})
    assert default.label == "neutral" and strict.label == "positive"


def test_rating_influences_score():
    assert analyze("Average experience.", rating=1).score < analyze("Average experience.", rating=5).score


def test_reason_is_always_given():
    for t in ["", "?", "hello", "ang ganda!"]:
        assert analyze(t or " ").reason
