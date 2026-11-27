"""Keyword watch: the owner picks words (refund, scam, cancel, a destination...). Any message containing one is
flagged and raises an alert. A word matches at the start of a word, so "cancel" also catches "cancelled".
Same rule as frontend/src/lib/teamtools.ts (watchHits)."""
from __future__ import annotations

import re

from sqlalchemy.orm import Session

from app.services.settings_service import get_setting

MAX_WORDS, MIN_LEN, MAX_LEN = 50, 2, 40


def clean_words(words: list) -> list[str]:
    out: list[str] = []
    for w in words or []:
        w = " ".join(str(w).split())
        if MIN_LEN <= len(w) <= MAX_LEN and w.lower() not in (x.lower() for x in out):
            out.append(w)
    return out[:MAX_WORDS]


def watch_words(db: Session) -> list[str]:
    return clean_words(get_setting(db, "keyword_watch").get("words", []))


def _pattern(word: str) -> re.Pattern:
    return re.compile(r"(?<![^\W_])" + re.escape(word.lower()))


def hits(text: str, words: list[str]) -> list[str]:
    t = (text or "").lower()
    return [w for w in words if _pattern(w).search(t)]
