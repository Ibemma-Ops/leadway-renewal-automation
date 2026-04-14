from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List, Any
from datetime import date, datetime
from app.models.user import UserRole
from app.models.renewal import PolicySegment, RenewalStatus, RiskFlag
from app.models.operations import ApprovalStepType, ApprovalStepStatus


# ─── Auth ─────────────────────────────────────────────────────────────────────

class Token(BaseModel):
    access_token: str
    token_type: str
    user: "UserOut"


class TokenData(BaseModel):
    user_id: Optional[int] = None


# ─── User ─────────────────────────────────────────────────────────────────────

class UserCreate(BaseModel):
    email: EmailStr
    full_name: str
    password: str = Field(min_length=8)
    role: UserRole = UserRole.SALES_OFFICER


class UserOut(BaseModel):
    id: int
    email: str
    full_name: str
    role: UserRole
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    role: Optional[UserRole] = None
    is_active: Optional[bool] = None


# ─── Renewal Policy ──────────────────────────────────────────────────────────

class RenewalPolicyOut(BaseModel):
    id: int
    policy_number: str
    scheme_ref: Optional[str]
    company_name: str
    business_sector: Optional[str]
    segment: PolicySegment
    contact_email: Optional[str]
    contact_name: Optional[str]
    phone: Optional[str]
    no_of_lives: Optional[int]

    # Financials
    current_premium: float
    total_claims: float
    total_premium: float
    earned_premium: Optional[float]

    # Workbook supplied (for discrepancy display)
    workbook_lr: Optional[float]
    workbook_cor: Optional[float]

    # Dates (canonical spec names)
    start_date: Optional[date]
    end_date: date
    days_to_renewal: Optional[int]

    # Pro-rata
    policy_months: Optional[float]
    is_pro_rata: Optional[bool]

    # Computed metrics (canonical spec names)
    lr: Optional[float]
    cor: Optional[float]
    lr_cor_discrepancy_pct: Optional[float]
    discrepancy_flagged: Optional[bool]

    # Rate engine
    renewal_rate: Optional[float]
    renewal_premium: Optional[float]
    rate_band: Optional[str]
    approval_route: Optional[str]

    # Flags
    has_customised_benefit: bool
    risk_flags: Optional[List[str]]

    # Status
    renewal_status: RenewalStatus

    # Approval timestamps
    sales_confirmed_at: Optional[datetime]
    underwriter_approved_at: Optional[datetime]
    hbd_approved_at: Optional[datetime]
    md_ceo_approved_at: Optional[datetime]
    notice_dispatched_at: Optional[datetime]

    # Document
    document_path: Optional[str]
    pdf_path: Optional[str]

    # Email tracking
    email_d60_sent: bool
    email_d30_sent: bool
    email_d7_sent: bool
    email_d0_sent: bool

    created_at: datetime
    updated_at: Optional[datetime]

    class Config:
        from_attributes = True


class RenewalPolicyUpdate(BaseModel):
    contact_email: Optional[str] = None
    contact_name: Optional[str] = None
    phone: Optional[str] = None
    renewal_rate: Optional[float] = None
    renewal_status: Optional[RenewalStatus] = None
    has_customised_benefit: Optional[bool] = None


# ─── Upload ──────────────────────────────────────────────────────────────────

class UploadBatchOut(BaseModel):
    id: int
    filename: str
    total_records: int
    processed_records: int
    failed_records: int
    tpa_routed: int
    flagged_records: int
    status: str
    error_details: Optional[Any]
    created_at: datetime

    class Config:
        from_attributes = True


# ─── Approval Workflow ───────────────────────────────────────────────────────

class ApprovalWorkflowOut(BaseModel):
    id: int
    policy_id: int
    step_type: ApprovalStepType
    step_order: int
    required_role: str
    status: ApprovalStepStatus
    actor_id: Optional[int]
    comments: Optional[str]
    concession_rationale: Optional[str]
    acted_at: Optional[datetime]
    created_at: datetime
    policy: Optional[RenewalPolicyOut] = None
    actor: Optional[UserOut] = None

    class Config:
        from_attributes = True


# ─── Audit Log ───────────────────────────────────────────────────────────────

class AuditLogOut(BaseModel):
    id: int
    user_id: Optional[int]
    policy_id: Optional[int]
    action: str
    description: Optional[str]
    event_metadata: Optional[Any]
    ip_address: Optional[str]
    created_at: datetime
    user: Optional[UserOut] = None

    class Config:
        from_attributes = True


# ─── Dashboard ───────────────────────────────────────────────────────────────

class DashboardStats(BaseModel):
    total_policies: int
    tpa_routed: int
    awaiting_sales: int
    awaiting_underwriter: int
    awaiting_hbd: int
    awaiting_md_ceo: int
    approved: int
    notice_sent: int
    lapsed: int
    rejected: int
    discrepancy_flagged: int
    total_premium_at_risk: float
    avg_lr: float
    renewals_due_30_days: int
    renewals_due_7_days: int
    pending_at_risk_7d: int    # still in approval chain with <7d to renewal


class HeatmapItem(BaseModel):
    company_name: str
    policy_number: str
    business_sector: Optional[str]
    lr: float
    cor: float
    end_date: date
    renewal_status: RenewalStatus
    risk_flags: Optional[List[str]]
    discrepancy_flagged: bool


class PortfolioSummary(BaseModel):
    segment: str
    count: int
    total_premium: float
    avg_lr: float


# ─── Email Log ───────────────────────────────────────────────────────────────

class EmailLogOut(BaseModel):
    id: int
    policy_id: int
    recipient_email: str
    subject: Optional[str]
    trigger_type: str
    status: str
    error_message: Optional[str]
    retry_count: int
    sent_at: Optional[datetime]
    created_at: datetime

    class Config:
        from_attributes = True


# ─── Pagination ──────────────────────────────────────────────────────────────

class PaginatedResponse(BaseModel):
    items: List[Any]
    total: int
    page: int
    page_size: int
    pages: int
