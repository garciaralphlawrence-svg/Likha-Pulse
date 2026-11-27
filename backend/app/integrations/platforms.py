"""Official-API integrations. Each reports `not_connected` until real, authorized credentials are set.

- Facebook Page comments: Graph API `/{page-id}/posts` with nested comments (Page access token with
  pages_read_engagement / pages_read_user_content, approved through Meta App Review).
- Messenger: Graph API `/{page-id}/conversations?platform=messenger` (Page access token with pages_messaging,
  approved through Meta App Review). Only messages sent to the Page are collected; the Page's own replies are skipped.
"""
from __future__ import annotations

from datetime import datetime, timezone

import httpx

from app.core.config import get_settings
from app.integrations.base import BaseIntegration, FetchedItem, IntegrationError, IntegrationStatus

def _parse_time(value: str | None) -> datetime:
    if not value:
        return datetime.now(timezone.utc)
    v = value.replace("Z", "+00:00")
    if len(v) >= 5 and (v[-5] in "+-") and v[-3] != ":":  # Graph API "+0000"
        v = v[:-2] + ":" + v[-2:]
    try:
        return datetime.fromisoformat(v)
    except ValueError:
        return datetime.now(timezone.utc)


def _get(url: str, params: dict, headers: dict | None = None) -> dict:
    try:
        r = httpx.get(url, params=params, headers=headers or {}, timeout=30)
    except httpx.HTTPError as e:
        raise IntegrationError(f"Network error: {e}") from e
    if r.status_code != 200:
        try:
            msg = r.json().get("error", {}).get("message", r.text[:200])
        except ValueError:
            msg = r.text[:200]
        raise IntegrationError(f"HTTP {r.status_code}: {msg}")
    return r.json()


class FacebookPageIntegration(BaseIntegration):
    code = "facebook_page"
    name = "Facebook Page comments"
    docs_url = "https://developers.facebook.com/docs/graph-api/reference/page/feed"
    required_env = ["META_PAGE_ID", "META_PAGE_ACCESS_TOKEN"]

    def status(self) -> IntegrationStatus:
        s = get_settings()
        missing = [n for n, v in zip(self.required_env, [s.meta_page_id, s.meta_page_access_token]) if not v]
        if missing:
            return IntegrationStatus(False, "Not connected. Add an authorized Facebook Page ID and Page access token.", missing)
        return IntegrationStatus(True, "Credentials configured. Run a sync to verify permissions.")

    def fetch(self, since=None) -> list[FetchedItem]:
        s = get_settings()
        if not self.status().connected:
            raise IntegrationError("Facebook Page is not connected.")
        base = f"https://graph.facebook.com/{s.meta_graph_version}"
        params = {"access_token": s.meta_page_access_token, "limit": 25,
                  "fields": "id,permalink_url,comments.limit(100){id,message,from,created_time,permalink_url}"}
        if since:
            params["since"] = int(since.timestamp())
        data = _get(f"{base}/{s.meta_page_id}/posts", params)
        items = []
        for post in data.get("data", []):
            for c in (post.get("comments") or {}).get("data", []):
                if (c.get("from") or {}).get("id") == s.meta_page_id or not (c.get("message") or "").strip():
                    continue
                items.append(FetchedItem(external_id=c["id"], content=c["message"].strip(), created_at=_parse_time(c.get("created_time")),
                                         author=(c.get("from") or {}).get("id"), author_name=(c.get("from") or {}).get("name"), source_url=c.get("permalink_url") or post.get("permalink_url"),
                                         parent_reference=post.get("id")))
        return items


class MessengerIntegration(BaseIntegration):
    code = "messenger"
    name = "Facebook Messenger"
    docs_url = "https://developers.facebook.com/docs/graph-api/reference/page/conversations"
    required_env = ["META_PAGE_ID", "META_PAGE_ACCESS_TOKEN"]

    def status(self) -> IntegrationStatus:
        s = get_settings()
        missing = [n for n, v in zip(self.required_env, [s.meta_page_id, s.meta_page_access_token]) if not v]
        if missing:
            return IntegrationStatus(False, "Not connected. Messenger needs an authorized Page token with pages_messaging.", missing)
        return IntegrationStatus(True, "Credentials configured. Run a sync to verify permissions.")

    def fetch(self, since=None) -> list[FetchedItem]:
        s = get_settings()
        if not self.status().connected:
            raise IntegrationError("Messenger is not connected.")
        base = f"https://graph.facebook.com/{s.meta_graph_version}"
        params = {"access_token": s.meta_page_access_token, "platform": "messenger", "limit": 25,
                  "fields": "id,link,updated_time,messages.limit(20){id,message,from,created_time}"}
        data = _get(f"{base}/{s.meta_page_id}/conversations", params)
        items = []
        for conv in data.get("data", []):
            for m in (conv.get("messages") or {}).get("data", []):
                created = _parse_time(m.get("created_time"))
                if (m.get("from") or {}).get("id") == s.meta_page_id or not (m.get("message") or "").strip():
                    continue
                if since and created <= since:
                    continue
                items.append(FetchedItem(external_id=m["id"], content=m["message"].strip(), created_at=created,
                                         author=(m.get("from") or {}).get("id"), author_name=(m.get("from") or {}).get("name"), parent_reference=conv.get("id"),
                                         source_url=("https://www.facebook.com" + conv["link"]) if conv.get("link") else None))
        return items


REGISTRY: dict[str, BaseIntegration] = {i.code: i for i in (FacebookPageIntegration(), MessengerIntegration())}
