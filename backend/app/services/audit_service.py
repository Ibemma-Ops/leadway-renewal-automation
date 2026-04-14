from typing import Optional, Dict, Any
from sqlalchemy.orm import Session
from app.models.operations import AuditLog


def log_action(
    db: Session,
    action: str,
    user_id: Optional[int] = None,
    policy_id: Optional[int] = None,
    description: Optional[str] = None,
    event_metadata: Optional[Dict[str, Any]] = None,
    ip_address: Optional[str] = None,
):
    """Create an audit log entry."""
    entry = AuditLog(
        user_id=user_id,
        policy_id=policy_id,
        action=action,
        description=description,
        event_metadata=event_metadata or {},
        ip_address=ip_address,
    )
    db.add(entry)
    db.commit()
    return entry
