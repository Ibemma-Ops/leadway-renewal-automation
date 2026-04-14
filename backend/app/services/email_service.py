import smtplib
import os
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.mime.base import MIMEBase
from email import encoders
from typing import Optional
from datetime import datetime
import logging
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type
from sqlalchemy.orm import Session
from app.core.config import settings
from app.core.celery_app import celery_app
from app.core.database import SessionLocal
from app.models.operations import EmailLog
from app.models.renewal import RenewalPolicy

logger = logging.getLogger(__name__)

EMAIL_TEMPLATES = {
    "D-60": {
        "subject": "Policy Renewal Notice – 60 Days | {company_name}",
        "body": """
Dear {contact_name},

This is a courtesy notice that your health insurance policy <strong>{policy_number}</strong> 
with Leadway Health Insurance Limited is due for renewal in <strong>60 days</strong>.

<strong>Renewal Date:</strong> {renewal_date}<br>
<strong>Current Premium:</strong> ₦{current_premium:,.2f}<br>
<strong>Proposed Renewal Premium:</strong> ₦{renewal_premium:,.2f}<br>

Our team will be in touch shortly to guide you through the renewal process.

For enquiries, please contact your relationship manager.

Warm regards,<br>
<strong>Leadway Health Insurance Limited</strong><br>
Monthly Renewal Automation System
"""
    },
    "D-30": {
        "subject": "URGENT: Policy Renewal Due in 30 Days | {company_name}",
        "body": """
Dear {contact_name},

Your health insurance policy <strong>{policy_number}</strong> is due for renewal 
in <strong>30 days</strong>. Please take action to avoid a lapse in coverage.

<strong>Renewal Date:</strong> {renewal_date}<br>
<strong>Proposed Renewal Premium:</strong> ₦{renewal_premium:,.2f}<br>
<strong>Rate Adjustment:</strong> {renewal_rate_pct:.1f}%<br>

Please contact your relationship manager immediately to process your renewal.

Warm regards,<br>
<strong>Leadway Health Insurance Limited</strong>
"""
    },
    "D-7": {
        "subject": "FINAL NOTICE: Policy Renewal Due in 7 Days | {company_name}",
        "body": """
Dear {contact_name},

<strong style="color:#E30613;">FINAL NOTICE:</strong> Your policy <strong>{policy_number}</strong> 
expires in <strong>7 days</strong> on {renewal_date}.

Failure to renew will result in a lapse of your health insurance coverage.

<strong>Action Required:</strong> Contact your relationship manager TODAY.<br>
<strong>Renewal Premium:</strong> ₦{renewal_premium:,.2f}<br>

Warm regards,<br>
<strong>Leadway Health Insurance Limited</strong>
"""
    },
    "D-0": {
        "subject": "Policy Renewal Due TODAY | {company_name}",
        "body": """
Dear {contact_name},

Your health insurance policy <strong>{policy_number}</strong> expires <strong>TODAY</strong>.

Please make immediate arrangements to renew your coverage.

Warm regards,<br>
<strong>Leadway Health Insurance Limited</strong>
"""
    },
}


def build_html_email(template_key: str, policy: RenewalPolicy) -> tuple:
    tpl = EMAIL_TEMPLATES[template_key]
    ctx = {
        "company_name": policy.company_name,
        "contact_name": policy.contact_name or "Valued Client",
        "policy_number": policy.policy_number,
        "renewal_date": policy.renewal_date.strftime("%d %B %Y"),
        "current_premium": policy.current_premium or 0,
        "renewal_premium": policy.renewal_premium or 0,
        "renewal_rate_pct": policy.renewal_rate_pct or 0,
    }
    subject = tpl["subject"].format(**ctx)
    body = tpl["body"].format(**ctx)

    html = f"""
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body {{ font-family: Arial, sans-serif; color: #333; }}
        .container {{ max-width: 600px; margin: auto; padding: 20px; }}
        .header {{ background: #002F6C; color: white; padding: 20px; text-align: center; }}
        .header h2 {{ margin: 0; }}
        .content {{ padding: 20px; background: #f9f9f9; }}
        .footer {{ background: #002F6C; color: #ccc; padding: 10px; text-align: center; font-size: 11px; }}
        .accent {{ color: #E30613; }}
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h2>LEADWAY HEALTH INSURANCE LIMITED</h2>
          <p style="margin:0;font-size:12px;">Monthly Renewal Automation System</p>
        </div>
        <div class="content">
          {body}
        </div>
        <div class="footer">
          This is an automated message from Leadway MRAS. Please do not reply directly to this email.
        </div>
      </div>
    </body>
    </html>
    """
    return subject, html


def send_email_smtp(
    to_email: str,
    subject: str,
    html_body: str,
    attachment_path: Optional[str] = None,
) -> bool:
    """Send email via SMTP with optional attachment."""
    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = f"{settings.EMAIL_FROM_NAME} <{settings.EMAIL_FROM}>"
    msg["To"] = to_email

    msg.attach(MIMEText(html_body, "html"))

    if attachment_path and os.path.exists(attachment_path):
        with open(attachment_path, "rb") as f:
            part = MIMEBase("application", "octet-stream")
            part.set_payload(f.read())
        encoders.encode_base64(part)
        part.add_header(
            "Content-Disposition",
            f"attachment; filename={os.path.basename(attachment_path)}",
        )
        msg.attach(part)

    with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
        server.starttls()
        server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
        server.sendmail(settings.EMAIL_FROM, to_email, msg.as_string())

    return True


@celery_app.task(bind=True, max_retries=3, default_retry_delay=300)
def send_renewal_email_task(self, policy_id: int, trigger_type: str):
    """Celery task to send renewal email with retry logic."""
    db: Session = SessionLocal()
    try:
        policy = db.query(RenewalPolicy).filter(RenewalPolicy.id == policy_id).first()
        if not policy:
            logger.error(f"Policy {policy_id} not found")
            return

        if not policy.contact_email:
            logger.warning(f"No email for policy {policy_id} — skipping")
            return

        subject, html_body = build_html_email(trigger_type, policy)

        # Log attempt
        email_log = EmailLog(
            policy_id=policy_id,
            recipient_email=policy.contact_email,
            subject=subject,
            trigger_type=trigger_type,
            status="PENDING",
        )
        db.add(email_log)
        db.commit()
        db.refresh(email_log)

        attachment = policy.pdf_path or policy.document_path

        try:
            send_email_smtp(policy.contact_email, subject, html_body, attachment)
            email_log.status = "SENT"
            email_log.sent_at = datetime.utcnow()

            # Update policy email flags
            flag_map = {
                "D-60": ("email_d60_sent", "email_d60_sent_at"),
                "D-30": ("email_d30_sent", "email_d30_sent_at"),
                "D-7":  ("email_d7_sent",  "email_d7_sent_at"),
                "D-0":  ("email_d0_sent",  "email_d0_sent_at"),
            }
            if trigger_type in flag_map:
                flag, ts = flag_map[trigger_type]
                setattr(policy, flag, True)
                setattr(policy, ts, datetime.utcnow())

            db.commit()
            logger.info(f"Email sent: policy={policy_id} trigger={trigger_type}")

        except Exception as send_err:
            email_log.status = "FAILED"
            email_log.error_message = str(send_err)
            email_log.retry_count += 1
            db.commit()
            logger.error(f"Email send failed: {send_err}")
            raise self.retry(exc=send_err)

    finally:
        db.close()


@celery_app.task
def retry_failed_emails():
    """Retry failed emails with retry_count < 3."""
    db = SessionLocal()
    try:
        failed = db.query(EmailLog).filter(
            EmailLog.status == "FAILED",
            EmailLog.retry_count < 3,
        ).all()
        for log in failed:
            send_renewal_email_task.delay(log.policy_id, log.trigger_type)
        logger.info(f"Queued {len(failed)} email retries")
    finally:
        db.close()
