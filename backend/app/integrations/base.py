"""Integration contract. Add a new platform by subclassing BaseIntegration and registering it in platforms.py (REGISTRY)."""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime


@dataclass
class FetchedItem:
    external_id: str
    content: str
    created_at: datetime
    author: str | None = None
    rating: float | None = None
    source_url: str | None = None
    parent_reference: str | None = None
    author_name: str | None = None  # display name; stored only when ANONYMIZE_AUTHORS=false (or for sample data)


@dataclass
class IntegrationStatus:
    connected: bool
    detail: str
    missing: list[str] = field(default_factory=list)


class IntegrationError(Exception):
    pass


class BaseIntegration:
    code: str = ""
    name: str = ""
    docs_url: str = ""
    required_env: list[str] = []

    def status(self) -> IntegrationStatus:
        raise NotImplementedError

    def fetch(self, since: datetime | None = None) -> list[FetchedItem]:
        """Return new items from the official API. Raise IntegrationError on failure."""
        raise NotImplementedError
