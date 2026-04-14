from datetime import date
import logging
from sqlalchemy.orm import Session
from app.core.celery_app import celery_app
from app.core.database import SessionLocal
from app.models.renewal import RenewalPolicy, RenewalStatus
from app.models.operations import AuditLog

logger = logging.getLogger(__name__)

TRIGGER_DAYS = {60: "D-60", 30: "D-30", 7: "D-7", 0: "D-0"}

# Only dispatch emails for policies that are APPROVED or already NOTICE_SENT/CONFIRMED
DISPATCHABLE = (RenewalStatus.APPROVED, RenewalStatus.NOTICE_SENT, RenewalStatus.CONFIRMED)


@celery_app.task
def check_renewal_triggers():
    db: Session = SessionLocal()
    triggered = 0
    try:
        today = date.today()
        policies = db.query(RenewalPolicy).filter(
            RenewalPolicy.renewal_status.notin_([
                RenewalStatus.LAPSED, RenewalStatus.REJECTED, RenewalStatus.TPA_ROUTED,
            ])
        ).all()

        for policy in policies:
            days = (policy.end_date - today).days
            policy.days_to_renewal = days

            # Auto-lapse
            if days < 0:
                if policy.renewal_status not in (RenewalStatus.LAPSED, RenewalStatus.CONFIRMED):
                    policy.renewal_status = RenewalStatus.LAPSED
                    _audit(db, policy.id, "AUTO_LAPSED",
                           f"Policy {policy.policy_number} lapsed — renewal date passed")
                continue

            # Only trigger emails for approved policies
            if policy.renewal_status not in DISPATCHABLE:
                continue

            send_flags = {
                60: policy.email_d60_sent,
                30: policy.email_d30_sent,
                7:  policy.email_d7_sent,
                0:  policy.email_d0_sent,
            }
            for trigger_day, trigger_key in TRIGGER_DAYS.items():
                if days == trigger_day and not send_flags[trigger_day]:
                    from app.services.email_service import send_renewal_email_task
                    send_renewal_email_task.delay(policy.id, trigger_key)
                    _audit(db, policy.id, f"EMAIL_TRIGGERED_{trigger_key}",
                           f"Auto email trigger {trigger_key} for approved policy {policy.policy_number}")
                    triggered += 1

        db.commit()
        logger.info(f"Scheduler: {triggered} emails triggered")
        return {"triggered": triggered}
    finally:
        db.close()


def _audit(db, policy_id, action, desc):
    db.add(AuditLog(policy_id=policy_id, action=action, description=desc,
                    metadata={"source": "scheduler"}))
