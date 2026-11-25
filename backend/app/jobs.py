"""Background jobs: platform sync every 30 minutes, alert checks hourly, data retention daily."""
import logging
from datetime import datetime, timedelta, timezone

from apscheduler.schedulers.background import BackgroundScheduler
from sqlalchemy import delete

from app.db import SessionLocal
from app.integrations.platforms import REGISTRY
from app.models import AuditLog, Feedback
from app.services.ingestion import sync_platform
from app.services.notifications import run_periodic_checks
from app.services.settings_service import get_setting

log = logging.getLogger(__name__)


def sync_all() -> None:
    with SessionLocal() as db:
        for code, integ in REGISTRY.items():
            if integ.status().connected:
                log.info("sync %s: %s", code, sync_platform(db, code))


def alerts() -> None:
    with SessionLocal() as db:
        run_periodic_checks(db)


def retention() -> None:
    with SessionLocal() as db:
        cfg = get_setting(db, "retention")
        now = datetime.now(timezone.utc)
        old = db.query(Feedback).filter(Feedback.created_at < now - timedelta(days=cfg["feedback_days"])).all()
        for fb in old:
            db.delete(fb)
        db.execute(delete(AuditLog).where(AuditLog.created_at < now - timedelta(days=cfg["audit_days"])))
        db.commit()


def start_scheduler() -> BackgroundScheduler:
    sched = BackgroundScheduler(timezone="UTC")
    sched.add_job(sync_all, "interval", minutes=30, id="sync", max_instances=1, coalesce=True)
    sched.add_job(alerts, "interval", hours=1, id="alerts", max_instances=1, coalesce=True)
    sched.add_job(retention, "cron", hour=3, id="retention", max_instances=1)
    sched.start()
    return sched
