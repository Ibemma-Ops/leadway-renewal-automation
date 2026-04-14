from sqlalchemy import (
    Column, Integer, String, Float, DateTime, Boolean,
    Enum as SAEnum, ForeignKey, Text, JSON
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import enum
from app.core.database import Base


class UploadBatch(Base):
    __tablename__ = "upload_batches"

    id = Column(Integer, primary_key=True, index=True)
    filename = Column(String, nullable=False)
    uploaded_by = Column(Integer, ForeignKey("users.id"))
    total_records = Column(Integer, default=0)
    processed_records = Column(Integer, default=0)
    failed_records = Column(Integer, default=0)
    tpa_routed = Column(Integer, default=0)       # count of TPA records routed away
    flagged_records = Column(Integer, default=0)  # count of discrepancy-flagged records
    status = Column(String, default="PROCESSING") # PROCESSING | SUCCESS | PARTIAL | FAILED
    error_details = Column(JSON)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    uploaded_by_user = relationship("User", back_populates="uploads")
    policies = relationship("RenewalPolicy", back_populates="batch")


class ApprovalStepType(str, enum.Enum):
    """Matches every step in the MRAS approval matrix."""
    SALES_CONFIRMATION              = "SALES_CONFIRMATION"
    UNDERWRITER_APPROVAL            = "UNDERWRITER_APPROVAL"
    UNDERWRITER_ACKNOWLEDGEMENT     = "UNDERWRITER_ACKNOWLEDGEMENT"   # anti-selection / adopted cohort
    HBD_APPROVAL                    = "HBD_APPROVAL"
    MD_CEO_CONCURRENCE              = "MD_CEO_CONCURRENCE"


class ApprovalStepStatus(str, enum.Enum):
    PENDING  = "PENDING"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    ACKNOWLEDGED = "ACKNOWLEDGED"   # for underwriter acknowledgement steps


class ApprovalWorkflow(Base):
    """
    One row per approval step per policy.
    Multiple rows exist for policies that need a chain
    (e.g. UNDERWRITER_APPROVAL then HBD_APPROVAL).
    step_order controls the sequence: lower = earlier.
    """
    __tablename__ = "approval_workflows"

    id            = Column(Integer, primary_key=True, index=True)
    policy_id     = Column(Integer, ForeignKey("renewal_policies.id"), nullable=False)
    step_type     = Column(SAEnum(ApprovalStepType), nullable=False)
    step_order    = Column(Integer, nullable=False, default=1)
    required_role = Column(String, nullable=False)   # UserRole value of who must act
    status        = Column(SAEnum(ApprovalStepStatus), default=ApprovalStepStatus.PENDING)
    actor_id      = Column(Integer, ForeignKey("users.id"), nullable=True)  # who acted
    comments      = Column(Text)
    concession_rationale = Column(Text)              # for underwriter acknowledgements
    acted_at      = Column(DateTime(timezone=True))
    created_at    = Column(DateTime(timezone=True), server_default=func.now())

    policy   = relationship("RenewalPolicy", back_populates="approval_workflows")
    actor = relationship(
    "User",
    foreign_keys=[actor_id],
    back_populates="approvals"
)


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id         = Column(Integer, primary_key=True, index=True)
    user_id    = Column(Integer, ForeignKey("users.id"), nullable=True)
    policy_id  = Column(Integer, ForeignKey("renewal_policies.id"), nullable=True)
    action     = Column(String, nullable=False)
    description = Column(Text)
    event_metadata   = Column(JSON)
    ip_address = Column(String)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user   = relationship("User", back_populates="audit_logs")
    policy = relationship("RenewalPolicy", back_populates="audit_logs")


class EmailLog(Base):
    __tablename__ = "email_logs"

    id              = Column(Integer, primary_key=True, index=True)
    policy_id       = Column(Integer, ForeignKey("renewal_policies.id"), nullable=False)
    recipient_email = Column(String, nullable=False)
    subject         = Column(String)
    trigger_type    = Column(String)   # D-60 | D-30 | D-7 | D-0
    status          = Column(String, default="PENDING")  # PENDING | SENT | FAILED
    error_message   = Column(Text)
    retry_count     = Column(Integer, default=0)
    sent_at         = Column(DateTime(timezone=True))
    created_at      = Column(DateTime(timezone=True), server_default=func.now())

    policy = relationship("RenewalPolicy", back_populates="email_logs")
