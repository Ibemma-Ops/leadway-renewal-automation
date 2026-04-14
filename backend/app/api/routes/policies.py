from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import FileResponse, StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import or_
from typing import Optional
import csv, io

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User, UserRole
from app.models.renewal import RenewalPolicy, RenewalStatus, PolicySegment
from app.schemas import RenewalPolicyOut, RenewalPolicyUpdate, PaginatedResponse
from app.services.audit_service import log_action
from app.services.document_service import generate_renewal_notice

router = APIRouter(prefix="/policies", tags=["Policies"])


@router.get("", response_model=PaginatedResponse)
async def list_policies(
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=100),
    search: Optional[str] = None,
    renewal_status: Optional[RenewalStatus] = None,
    segment: Optional[PolicySegment] = None,
    discrepancy_flagged: Optional[bool] = None,
    has_risk_flag: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = db.query(RenewalPolicy)
    if search:
        q = q.filter(or_(
            RenewalPolicy.company_name.ilike(f"%{search}%"),
            RenewalPolicy.policy_number.ilike(f"%{search}%"),
            RenewalPolicy.scheme_ref.ilike(f"%{search}%"),
        ))
    if renewal_status:
        q = q.filter(RenewalPolicy.renewal_status == renewal_status)
    if segment:
        q = q.filter(RenewalPolicy.segment == segment)
    if discrepancy_flagged is not None:
        q = q.filter(RenewalPolicy.discrepancy_flagged == discrepancy_flagged)
    if has_risk_flag:
        q = q.filter(RenewalPolicy.risk_flags.contains([has_risk_flag]))

    total = q.count()
    items = q.order_by(RenewalPolicy.end_date.asc()).offset((page - 1) * page_size).limit(page_size).all()
    return PaginatedResponse(
        items=[RenewalPolicyOut.from_orm(p) for p in items],
        total=total, page=page, page_size=page_size,
        pages=(total + page_size - 1) // page_size,
    )


@router.get("/export/csv")
async def export_csv(
    renewal_status: Optional[RenewalStatus] = None,
    segment: Optional[PolicySegment] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = db.query(RenewalPolicy)
    if renewal_status:
        q = q.filter(RenewalPolicy.renewal_status == renewal_status)
    if segment:
        q = q.filter(RenewalPolicy.segment == segment)
    policies = q.all()

    output = io.StringIO()
    w = csv.writer(output)
    w.writerow([
        "Policy Number", "Scheme Ref", "Company", "Sector", "Segment", "Lives",
        "Contact Email", "Start Date", "End Date", "Days to Renewal",
        "Current Premium", "Total Claims", "Total Premium", "Earned Premium",
        "LR %", "COR %", "Workbook LR %", "Workbook COR %", "Discrepancy Flagged",
        "Renewal Rate %", "Renewal Premium", "Rate Band", "Approval Route",
        "Risk Flags", "Renewal Status",
        "Sales Confirmed", "UW Approved", "HBD Approved", "MD CEO Approved",
        "Notice Dispatched",
        "D-60 Sent", "D-30 Sent", "D-7 Sent", "D-0 Sent",
    ])
    for p in policies:
        w.writerow([
            p.policy_number, p.scheme_ref or "", p.company_name,
            p.business_sector or "", p.segment.value, p.no_of_lives or 0,
            p.contact_email or "", p.start_date or "", p.end_date,
            p.days_to_renewal or "",
            p.current_premium, p.total_claims, p.total_premium,
            p.earned_premium or "",
            f"{(p.lr or 0)*100:.2f}", f"{(p.cor or 0)*100:.2f}",
            f"{(p.workbook_lr or 0)*100:.2f}" if p.workbook_lr is not None else "",
            f"{(p.workbook_cor or 0)*100:.2f}" if p.workbook_cor is not None else "",
            p.discrepancy_flagged,
            p.renewal_rate or "", p.renewal_premium or "",
            p.rate_band or "", p.approval_route or "",
            "|".join(p.risk_flags or []),
            p.renewal_status.value,
            p.sales_confirmed_at or "", p.underwriter_approved_at or "",
            p.hbd_approved_at or "", p.md_ceo_approved_at or "",
            p.notice_dispatched_at or "",
            p.email_d60_sent, p.email_d30_sent, p.email_d7_sent, p.email_d0_sent,
        ])
    output.seek(0)
    log_action(db, "EXPORT_CSV", user_id=current_user.id,
               description=f"Exported {len(policies)} policies to CSV")
    return StreamingResponse(
        iter([output.getvalue()]), media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=mras_renewals_export.csv"},
    )


@router.get("/{policy_id}", response_model=RenewalPolicyOut)
async def get_policy(
    policy_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    p = db.query(RenewalPolicy).filter(RenewalPolicy.id == policy_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Policy not found")
    return p


@router.patch("/{policy_id}", response_model=RenewalPolicyOut)
async def update_policy(
    policy_id: int,
    payload: RenewalPolicyUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    p = db.query(RenewalPolicy).filter(RenewalPolicy.id == policy_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Policy not found")
    changes = {}
    for field, value in payload.model_dump(exclude_none=True).items():
        if getattr(p, field) != value:
            changes[field] = {"old": str(getattr(p, field)), "new": str(value)}
            setattr(p, field, value)
    db.commit()
    db.refresh(p)
    if changes:
        log_action(db, "POLICY_UPDATED", user_id=current_user.id,
                   policy_id=policy_id, event_metadata={"changes": changes},
                   ip_address=request.client.host)
    return p


@router.post("/{policy_id}/generate-document", response_model=RenewalPolicyOut)
async def generate_document(
    policy_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Generate renewal notice ONLY if the policy is APPROVED.
    TPA-routed and any policy with pending approval steps are blocked.
    """
    p = db.query(RenewalPolicy).filter(RenewalPolicy.id == policy_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Policy not found")

    if p.renewal_status == RenewalStatus.TPA_ROUTED:
        raise HTTPException(
            status_code=400,
            detail="TPA policies are not eligible for automated notice generation. Route to TPA desk."
        )
    if p.renewal_status != RenewalStatus.APPROVED:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Notice cannot be generated until all approval steps are complete. "
                f"Current status: {p.renewal_status.value}"
            )
        )

    result = generate_renewal_notice(p, db)
    p.document_path = result["docx_path"]
    if result.get("pdf_path"):
        p.pdf_path = result["pdf_path"]
    db.commit()
    db.refresh(p)
    log_action(db, "DOCUMENT_GENERATED", user_id=current_user.id,
               policy_id=policy_id, description="Renewal notice generated post-approval")
    return p


@router.get("/{policy_id}/download-document")
async def download_document(
    policy_id: int,
    file_type: str = Query("docx", pattern="^(docx|pdf)$"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    import os
    p = db.query(RenewalPolicy).filter(RenewalPolicy.id == policy_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Policy not found")
    path = p.pdf_path if file_type == "pdf" else p.document_path
    if not path or not os.path.exists(path):
        raise HTTPException(status_code=404, detail="Document not yet generated")
    return FileResponse(
        path,
        media_type=(
            "application/pdf" if file_type == "pdf"
            else "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        ),
        filename=f"renewal_{p.policy_number}.{file_type}",
    )


@router.post("/{policy_id}/trigger-email")
async def trigger_email(
    policy_id: int,
    trigger_type: str = Query(..., pattern="^(D-60|D-30|D-7|D-0)$"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Email dispatch only allowed for APPROVED or NOTICE_SENT policies."""
    p = db.query(RenewalPolicy).filter(RenewalPolicy.id == policy_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Policy not found")
    if p.renewal_status not in (RenewalStatus.APPROVED, RenewalStatus.NOTICE_SENT, RenewalStatus.CONFIRMED):
        raise HTTPException(
            status_code=400,
            detail=f"Email dispatch not permitted. Status: {p.renewal_status.value}. Policy must be APPROVED first."
        )
    from app.services.email_service import send_renewal_email_task
    send_renewal_email_task.delay(policy_id, trigger_type)
    log_action(db, f"MANUAL_EMAIL_{trigger_type}", user_id=current_user.id,
               policy_id=policy_id, description=f"Manual email trigger: {trigger_type}")
    return {"queued": True, "policy_id": policy_id, "trigger": trigger_type}
