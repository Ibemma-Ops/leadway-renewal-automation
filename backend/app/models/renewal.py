from sqlalchemy import (
    Column, Integer, String, Float, Date, DateTime,
    Enum as SAEnum, ForeignKey, Text, Boolean, JSON
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import enum
from app.core.database import Base


class PolicySegment(str, enum.Enum):
    CORPORATE = "CORPORATE"
    RETAIL = "RETAIL"
    TPA = "TPA"


# ── Canonical renewal status set matching the MRAS spec ─────────────────────
class RenewalStatus(str, enum.Enum):
    PENDING                        = "PENDING"
    # COR < 80%: automated, no approver — but Sales Officer still confirms dispatch
    AWAITING_SALES_CONFIRMATION    = "AWAITING_SALES_CONFIRMATION"
    # COR 81–114%: Sales Officer confirmation required
    # (reuses AWAITING_SALES_CONFIRMATION — same queue, same role)
    # COR 115–140%: Sales Officer + Underwriter joint sign-off
    AWAITING_UNDERWRITER_APPROVAL  = "AWAITING_UNDERWRITER_APPROVAL"
    # COR > 140%: HBD approval required
    AWAITING_HBD_APPROVAL          = "AWAITING_HBD_APPROVAL"
    # COR > 140% with customised benefit: HBD + MD/CEO concurrence
    AWAITING_MD_CEO_CONCURRENCE    = "AWAITING_MD_CEO_CONCURRENCE"
    # TPA segment: removed from automated pipeline
    TPA_ROUTED                     = "TPA_ROUTED"
    # Anti-selection / adopted enrollee: Underwriter must acknowledge
    AWAITING_UNDERWRITER_ACKNOWLEDGEMENT = "AWAITING_UNDERWRITER_ACKNOWLEDGEMENT"
    APPROVED                       = "APPROVED"
    NOTICE_SENT                    = "NOTICE_SENT"
    CONFIRMED                      = "CONFIRMED"
    REJECTED                       = "REJECTED"
    LAPSED                         = "LAPSED"


# ── Risk flags stored as JSON array on each policy ───────────────────────────
class RiskFlag(str, enum.Enum):
    HIGH_COR                  = "HIGH_COR"
    ANTI_SELECTION            = "ANTI_SELECTION"
    ADOPTED_ENROLLEE_COHORT   = "ADOPTED_ENROLLEE_COHORT"
    TPA_REFERRAL              = "TPA_REFERRAL"
    LR_COR_DISCREPANCY        = "LR_COR_DISCREPANCY"
    PRO_RATA_REVIEW           = "PRO_RATA_REVIEW"
    CUSTOMISED_BENEFIT        = "CUSTOMISED_BENEFIT"


class RenewalPolicy(Base):
    __tablename__ = "renewal_policies"

    id = Column(Integer, primary_key=True, index=True)
    batch_id = Column(Integer, ForeignKey("upload_batches.id"), nullable=False)

    # ── Identifiers ──────────────────────────────────────────────────────────
    policy_number   = Column(String, unique=True, index=True, nullable=False)
    scheme_ref      = Column(String, index=True)           # alternate scheme/group ref
    company_name    = Column(String, nullable=False)       # canonical: "company"
    business_sector = Column(String)

    # ── Segment (replaces policy_type to match spec field name) ─────────────
    segment = Column(SAEnum(PolicySegment), nullable=False)

    # ── Contact ──────────────────────────────────────────────────────────────
    contact_email   = Column(String)
    contact_name    = Column(String)
    phone           = Column(String)
    assigned_sales_officer_id = Column(Integer, ForeignKey("users.id"), nullable=True)

    # ── Lives ────────────────────────────────────────────────────────────────
    no_of_lives     = Column(Integer, default=0)

    # ── Premium & Claims (canonical spec field names) ─────────────────────────
    current_premium  = Column(Float, nullable=False)   # current year premium
    total_premium    = Column(Float, nullable=False)   # written/earned premium for LR calc
    total_claims     = Column(Float, default=0.0)

    # Workbook-supplied LR/COR (for discrepancy validation)
    workbook_lr      = Column(Float, nullable=True)    # as decimal (0.0–1.0+)
    workbook_cor     = Column(Float, nullable=True)

    # ── Dates ────────────────────────────────────────────────────────────────
    start_date       = Column(Date)                    # canonical: "start_date" = inception
    end_date         = Column(Date)                    # canonical: "end_date"   = renewal/expiry
    days_to_renewal  = Column(Integer)

    # ── Pro-rata support ─────────────────────────────────────────────────────
    policy_months    = Column(Float, default=12.0)     # actual policy period in months
    is_pro_rata      = Column(Boolean, default=False)
    earned_premium   = Column(Float)                   # annualised or pro-rata earned

    # ── Computed Metrics (canonical spec names) ───────────────────────────────
    lr               = Column(Float)                   # loss_ratio  (decimal)
    cor              = Column(Float)                   # combined_operating_ratio (decimal)
    lr_cor_discrepancy_pct = Column(Float)             # % discrepancy vs workbook
    discrepancy_flagged    = Column(Boolean, default=False)

    # ── Rate Engine ──────────────────────────────────────────────────────────
    renewal_rate     = Column(Float)                   # rate adjustment % (e.g. 15.0 for 15%)
    renewal_premium  = Column(Float)
    rate_band        = Column(String)
    approval_route   = Column(String)                  # which approval chain is needed

    # Flags
    has_customised_benefit = Column(Boolean, default=False)
    risk_flags       = Column(JSON, default=list)      # list of RiskFlag values

    # ── Approval / Dispatch timestamps ───────────────────────────────────────
    sales_confirmed_at       = Column(DateTime(timezone=True))
    underwriter_approved_at  = Column(DateTime(timezone=True))
    hbd_approved_at          = Column(DateTime(timezone=True))
    md_ceo_approved_at       = Column(DateTime(timezone=True))
    notice_dispatched_at     = Column(DateTime(timezone=True))

    # ── Status ───────────────────────────────────────────────────────────────
    renewal_status   = Column(SAEnum(RenewalStatus), default=RenewalStatus.PENDING)

    # ── Document ─────────────────────────────────────────────────────────────
    document_path    = Column(String)
    pdf_path         = Column(String)

    # ── Email tracking ───────────────────────────────────────────────────────
    email_d60_sent   = Column(Boolean, default=False)
    email_d30_sent   = Column(Boolean, default=False)
    email_d7_sent    = Column(Boolean, default=False)
    email_d0_sent    = Column(Boolean, default=False)
    email_d60_sent_at = Column(DateTime(timezone=True))
    email_d30_sent_at = Column(DateTime(timezone=True))
    email_d7_sent_at  = Column(DateTime(timezone=True))
    email_d0_sent_at  = Column(DateTime(timezone=True))

    created_at       = Column(DateTime(timezone=True), server_default=func.now())
    updated_at       = Column(DateTime(timezone=True), onupdate=func.now())

    # ── Relationships ─────────────────────────────────────────────────────────
    batch                  = relationship("UploadBatch", back_populates="policies")
    approval_workflows     = relationship("ApprovalWorkflow", back_populates="policy",
                                          cascade="all, delete-orphan")
    audit_logs             = relationship("AuditLog", back_populates="policy")
    email_logs             = relationship("EmailLog", back_populates="policy")
    assigned_sales_officer = relationship("User", foreign_keys=[assigned_sales_officer_id])
