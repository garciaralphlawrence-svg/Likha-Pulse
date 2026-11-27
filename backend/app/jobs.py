"""Background jobs: Facebook/Messenger sync every 30 minutes (only when connected) and the weekly report every Monday
8:00 AM Philippine time (00:00 UTC)."""
import logging

from apscheduler.schedulers.background import BackgroundScheduler

from app.db import SessionLocal
from app.integrations.platforms import REGISTRY
from app.services.care_store import send_weekly, sync_platform
from app.services.requests import all_requests
from app.services.settings_service import quote_settings

log = logging.getLogger(__name__)


def sync_all() -> None:
    with SessionLocal() as db:
        for code, integ in REGISTRY.items():
            if integ.status().connected:
                log.info("sync %s: %s", code, sync_platform(db, code, quote_settings(db)))


def weekly() -> None:
    with SessionLocal() as db:
        log.info("weekly report: %s", send_weekly(db, quote_settings(db), all_requests(db)))


def start_scheduler() -> BackgroundScheduler:
    sched = BackgroundScheduler(timezone="UTC")
    sched.add_job(sync_all, "interval", minutes=30, id="sync", max_instances=1, coalesce=True)
    sched.add_job(weekly, "cron", day_of_week="mon", hour=0, minute=0, id="weekly_report", max_instances=1,
                  misfire_grace_time=6 * 3600, coalesce=True)  # 8:00 AM in the Philippines
    sched.start()
    return sched
