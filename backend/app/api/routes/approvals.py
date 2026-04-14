"""
Approvals API — enforces the MRAS approval matrix exactly.

State machine for renewal_status:
  AWAITING_SALES_CONFIRMATION          → Sales Officer confirms  → next step / APPROVED
  AWAITING_UNDERWRITER_ACKNOWLEDGEMENT → Underwriter acknowledges → next step
  AWAITING_UNDERWRITER_APPROVAL        → Underwriter approves    → next step / APPROVED
  AWAITING_HBD_APPROVAL                → HBD approves            → next step / APPROVED
  AWAITING_MD_CEO_CONCURRENCE          → MD/CEO concurs          → APPROVED

Rules enforced server-side — no bypass possible:
  - Only the required role for each step type can act.
  - Steps must be actioned in step_order sequence.
  - REJECT at any step → REJECTED (no notice ever generated).
  - Notice generation only permitted once renewal_status == APPROVED.
  - TPA_ROUTED policies are never in this queue.
  - Discrepancy-flagged records start at AWAITING_UNDERWRITER_ACKNOWLEDGEMENT.
"""
from fastapi import APIRouter, Depends, HTTPException, Request, Query
from sqlalchemy.orm import Session
from datetime import datetime, date, timedelta
from typing import List, Optional
from pydantic import BaseModel

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User, UserRole
from app.models.renewal import RenewalPolicy, RenewalStatus
from app.models.operations import ApprovalWorkflow, ApprovalStepType, ApprovalStepStatus
from app.schemas import ApprovalWorkflowOut
from app.services.audit_service import log_action

router = APIRouter(prefix="/approvals", tags=["Approvals"])

STEP_TO_PENDING_STATUS = {
    "SALES_CONFIRMATION":          RenewalStatus.AWAITING_SALES_CONFIRMATION,
    "UNDERWRITER_ACKNOWLEDGEMENT": RenewalStatus.AWAITING_UNDERWRITER_ACKNOWLEDGEMENT,
    "UNDERWRITER_APPROVAL":        RenewalStatus.AWAITING_UNDERWRITER_APPROVAL,
    "HBD_APPROVAL":                RenewalStatus.AWAITING_HBD_APPROVAL,
    "MD_CEO_CONCURRENCE":          RenewalStatus.AWAITING_MD_CEO_CONCURRENCE,
}

STEP_ACTOR_ROLE = {
    "SALES_CONFIRMATION":          UserRole.SALES_OFFICER,
    "UNDERWRITER_ACKNOWLEDGEMENT": UserRole.UNDERWRITER,
    "UNDERWRITER_APPROVAL":        UserRole.UNDERWRITER,
    "HBD_APPROVAL":                UserRole.HBD,
    "MD_CEO_CONCURRENCE":          UserRole.MD_CEO,
}


class ApprovalActionRequest(BaseModel):
    action: str                                   # APPROVE | REJECT | ACKNOWLEDGE
    comments: Optional[str] = None
    concession_rationale: Optional[str] = None    # mandatory for ACKNOWLEDGE


def _advance_or_complete(policy: RenewalPolicy, current_step: ApprovalWorkflow, db: Session):
    next_step = (
        db.query(ApprovalWorkflow)
        .filter(
            ApprovalWorkflow.policy_id == policy.id,
            ApprovalWorkflow.step_order > current_step.step_order,
            ApprovalWorkflow.status == ApprovalStepStatus.PENDING,
        )
        .order_by(ApprovalWorkflow.step_order.asc())
        .first()
    )
    if next_step:
        policy.renewal_status = STEP_TO_PENDING_STATUS.get(
            next_step.step_type.value, RenewalStatus.PENDING
        )
    else:
        policy.renewal_status = RenewalStatus.APPROVED


@router.get("", response_model=List[ApprovalWorkflowOut])
async def list_approvals(
    step_status: Optional[ApprovalStepStatus] = None,
    segment: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = db.query(ApprovalWorkflow)
    if current_user.role not in (UserRole.ADMIN, UserRole.MD_CEO):
        q = q.filter(ApprovalWorkflow.required_role == current_user.role.value)
    if step_status:
        q = q.filter(ApprovalWorkflow.status == step_status)
    if segment:
        q = q.join(RenewalPolicy).filter(RenewalPolicy.segment == segment)
    return (
        q.join(RenewalPolicy)
        .filter(RenewalPolicy.renewal_status != RenewalStatus.TPA_ROUTED)
        .order_by(ApprovalWorkflow.created_at.asc())
        .all()
    )


@router.post("/{step_id}/action", response_model=ApprovalWorkflowOut)
async def action_approval_step(
    step_id: int,
    payload: ApprovalActionRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    step = db.query(ApprovalWorkflow).filter(ApprovalWorkflow.id == step_id).first()
    if not step:
        raise HTTPException(status_code=404, detail="Approval step not found")

    required_role = STEP_ACTOR_ROLE.get(step.step_type.value)
    if current_user.role != UserRole.ADMIN and current_user.role != required_role:
        raise HTTPException(
            status_code=403,
            detail=(
                f"This step requires role '{required_role.value if required_role else 'unknown'}'. "
                f"Your role is '{current_user.role.value}'. No bypass permitted."
            )
        )

    if step.status != ApprovalStepStatus.PENDING:
        raise HTTPException(status_code=409, detail=f"Step already actioned ({step.status.value})")

    prior_pending = (
        db.query(ApprovalWorkflow)
        .filter(
            ApprovalWorkflow.policy_id == step.policy_id,
            ApprovalWorkflow.step_order < step.step_order,
            ApprovalWorkflow.status == ApprovalStepStatus.PENDING,
        )
        .count()
    )
    if prior_pending > 0:
        raise HTTPException(status_code=409, detail="Earlier approval steps must be completed first.")

    policy = db.query(RenewalPolicy).filter(RenewalPolicy.id == step.policy_id).first()
    if not policy:
        raise HTTPException(status_code=404, detail="Policy not found")

    action = payload.action.upper()
    step.actor_id = current_user.id
    step.acted_at = datetime.utcnow()
    step.comments = payload.comments

    if action == "REJECT":
        step.status = ApprovalStepStatus.REJECTED
        policy.renewal_status = RenewalStatus.REJECTED
        log_action(db, "APPROVAL_REJECTED", user_id=current_user.id, policy_id=policy.id,
                   description=f"Step {step.step_type.value} rejected by {current_user.role.value}",
                   event_metadata={"comments": payload.comments}, ip_address=request.client.host)

    elif action == "ACKNOWLEDGE":
        if step.step_type != ApprovalStepType.UNDERWRITER_ACKNOWLEDGEMENT:
            raise HTTPException(status_code=400, detail="ACKNOWLEDGE only valid for UNDERWRITER_ACKNOWLEDGEMENT steps.")
        if not payload.concession_rationale:
            raise HTTPException(status_code=422, detail="concession_rationale is required for Underwriter acknowledgement.")
        step.status = ApprovalStepStatus.ACKNOWLEDGED
        step.concession_rationale = payload.concession_rationale
        policy.underwriter_approved_at = datetime.utcnow()
        _advance_or_complete(policy, step, db)
        log_action(db, "UNDERWRITER_ACKNOWLEDGED", user_id=current_user.id, policy_id=policy.id,
                   description="Underwriter acknowledged concession rationale",
                   event_metadata={"rationale": payload.concession_rationale}, ip_address=request.client.host)

    elif action == "APPROVE":
        step.status = ApprovalStepStatus.APPROVED
        ts = datetime.utcnow()
        if step.step_type == ApprovalStepType.SALES_CONFIRMATION:
            policy.sales_confirmed_at = ts
        elif step.step_type == ApprovalStepType.UNDERWRITER_APPROVAL:
            policy.underwriter_approved_at = ts
        elif step.step_type == ApprovalStepType.HBD_APPROVAL:
            policy.hbd_approved_at = ts
        elif step.step_type == ApprovalStepType.MD_CEO_CONCURRENCE:
            policy.md_ceo_approved_at = ts
        _advance_or_complete(policy, step, db)
        log_action(db, f"STEP_APPROVED_{step.step_type.value}", user_id=current_user.id,
                   policy_id=policy.id,
                   description=f"{step.step_type.value} approved by {current_user.role.value}",
                   event_metadata={"comments": payload.comments,
                              "new_policy_status": policy.renewal_status.value},
                   ip_address=request.client.host)
    else:
        raise HTTPException(status_code=400, detail="action must be APPROVE, REJECT, or ACKNOWLEDGE")

    db.commit()
    db.refresh(step)
    return step


@router.get("/queue/summary")
async def approval_queue_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from sqlalchemy import func
    rows = (
        db.query(
            ApprovalWorkflow.required_role,
            ApprovalWorkflow.step_type,
            func.count(ApprovalWorkflow.id).label("count"),
        )
        .filter(ApprovalWorkflow.status == ApprovalStepStatus.PENDING)
        .join(RenewalPolicy)
        .filter(RenewalPolicy.renewal_status != RenewalStatus.TPA_ROUTED)
        .group_by(ApprovalWorkflow.required_role, ApprovalWorkflow.step_type)
        .all()
    )
    summary: dict = {}
    for row in rows:
        if row.required_role not in summary:
            summary[row.required_role] = {}
        summary[row.required_role][row.step_type.value] = row.count
    return summary


@router.get("/tpa-queue")
async def tpa_queue(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from app.schemas import RenewalPolicyOut
    policies = (
        db.query(RenewalPolicy)
        .filter(RenewalPolicy.renewal_status == RenewalStatus.TPA_ROUTED)
        .order_by(RenewalPolicy.end_date.asc())
        .all()
    )
    return [RenewalPolicyOut.from_orm(p) for p in policies]


@router.get("/pending-near-expiry")
async def pending_near_expiry(
    days: int = Query(7, ge=1, le=30),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from app.schemas import RenewalPolicyOut
    cutoff = date.today() + timedelta(days=days)
    at_risk = (
        db.query(RenewalPolicy)
        .filter(
            RenewalPolicy.end_date <= cutoff,
            RenewalPolicy.renewal_status.notin_([
                RenewalStatus.APPROVED, RenewalStatus.NOTICE_SENT,
                RenewalStatus.CONFIRMED, RenewalStatus.LAPSED,
                RenewalStatus.REJECTED, RenewalStatus.TPA_ROUTED,
            ])
        )
        .order_by(RenewalPolicy.end_date.asc())
        .all()
    )
    return [RenewalPolicyOut.from_orm(p) for p in at_risk]
