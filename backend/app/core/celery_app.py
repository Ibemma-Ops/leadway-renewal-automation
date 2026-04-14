from celery import Celery
from celery.schedules import crontab
from app.core.config import settings

celery_app = Celery(
    "mras",
    broker=settings.CELERY_BROKER_URL,
    backend=settings.CELERY_RESULT_BACKEND,
    include=[
        "app.services.email_service",
        "app.services.scheduler_service",
    ]
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="Africa/Lagos",
    enable_utc=True,
    task_track_started=True,
    task_acks_late=True,
    worker_prefetch_multiplier=1,
    beat_schedule={
        "check-renewals-daily": {
            "task": "app.services.scheduler_service.check_renewal_triggers",
            "schedule": crontab(hour=8, minute=0),
        },
        "retry-failed-emails": {
            "task": "app.services.email_service.retry_failed_emails",
            "schedule": crontab(hour="*/2", minute=0),
        },
    },
)
