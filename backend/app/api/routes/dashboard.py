from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, case
from datetime import date, timedelta
from typing import List, Optional

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.models.renewal import RenewalPolicy, RenewalStatus, PolicySegment
from app.schemas import DashboardStats, HeatmapItem, PortfolioSummary

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


@router.get("/stats", response_model=DashboardStats)
async def get_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    today = date.today()
    def cnt(s): return db.query(func.count(RenewalPolicy.id)).filter(RenewalPolicy.renewal_status == s).scalar() or 0

    total    = db.query(func.count(RenewalPolicy.id)).scalar() or 0
    tpa      = cnt(RenewalStatus.TPA_ROUTED)
    aw_sales = cnt(RenewalStatus.AWAITING_SALES_CONFIRMATION)
    aw_uw    = (cnt(RenewalStatus.AWAITING_UNDERWRITER_APPROVAL) +
                cnt(RenewalStatus.AWAITING_UNDERWRITER_ACKNOWLEDGEMENT))
    aw_hbd   = cnt(RenewalStatus.AWAITING_HBD_APPROVAL)
    aw_md    = cnt(RenewalStatus.AWAITING_MD_CEO_CONCURRENCE)
    approved = cnt(RenewalStatus.APPROVED)
    sent     = cnt(RenewalStatus.NOTICE_SENT) + cnt(RenewalStatus.CONFIRMED)
    lapsed   = cnt(RenewalStatus.LAPSED)
    rejected = cnt(RenewalStatus.REJECTED)

    discrepancy = db.query(func.count(RenewalPolicy.id)).filter(
        RenewalPolicy.discrepancy_flagged == True
    ).scalar() or 0

    premium_at_risk = db.query(
        func.coalesce(func.sum(RenewalPolicy.renewal_premium), 0)
    ).filter(
        RenewalPolicy.renewal_status.notin_([
            RenewalStatus.NOTICE_SENT, RenewalStatus.CONFIRMED,
            RenewalStatus.LAPSED, RenewalStatus.REJECTED, RenewalStatus.TPA_ROUTED,
        ])
    ).scalar() or 0

    avg_lr = db.query(func.avg(RenewalPolicy.lr)).filter(
        RenewalPolicy.segment != PolicySegment.TPA
    ).scalar() or 0.0

    due_30 = db.query(func.count(RenewalPolicy.id)).filter(
        RenewalPolicy.end_date.between(today, today + timedelta(days=30)),
        RenewalPolicy.renewal_status != RenewalStatus.LAPSED,
        RenewalPolicy.renewal_status != RenewalStatus.TPA_ROUTED,
    ).scalar() or 0

    due_7 = db.query(func.count(RenewalPolicy.id)).filter(
        RenewalPolicy.end_date.between(today, today + timedelta(days=7)),
        RenewalPolicy.renewal_status != RenewalStatus.LAPSED,
        RenewalPolicy.renewal_status != RenewalStatus.TPA_ROUTED,
    ).scalar() or 0

    # Still in approval chain with <7 days to renewal
    pending_at_risk = db.query(func.count(RenewalPolicy.id)).filter(
        RenewalPolicy.end_date <= today + timedelta(days=7),
        RenewalPolicy.renewal_status.in_([
            RenewalStatus.AWAITING_SALES_CONFIRMATION,
            RenewalStatus.AWAITING_UNDERWRITER_ACKNOWLEDGEMENT,
            RenewalStatus.AWAITING_UNDERWRITER_APPROVAL,
            RenewalStatus.AWAITING_HBD_APPROVAL,
            RenewalStatus.AWAITING_MD_CEO_CONCURRENCE,
        ])
    ).scalar() or 0

    return DashboardStats(
        total_policies=total,
        tpa_routed=tpa,
        awaiting_sales=aw_sales,
        awaiting_underwriter=aw_uw,
        awaiting_hbd=aw_hbd,
        awaiting_md_ceo=aw_md,
        approved=approved,
        notice_sent=sent,
        lapsed=lapsed,
        rejected=rejected,
        discrepancy_flagged=discrepancy,
        total_premium_at_risk=float(premium_at_risk),
        avg_lr=round(float(avg_lr) * 100, 2),
        renewals_due_30_days=due_30,
        renewals_due_7_days=due_7,
        pending_at_risk_7d=pending_at_risk,
    )


@router.get("/heatmap", response_model=List[HeatmapItem])
async def get_heatmap(
    segment: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = db.query(RenewalPolicy).filter(
        RenewalPolicy.lr.isnot(None),
        RenewalPolicy.segment != PolicySegment.TPA,
    )
    if segment:
        q = q.filter(RenewalPolicy.segment == segment)
    policies = q.order_by(RenewalPolicy.cor.desc()).limit(100).all()
    return [
        HeatmapItem(
            company_name=p.company_name,
            policy_number=p.policy_number,
            business_sector=p.business_sector,
            lr=round((p.lr or 0) * 100, 2),
            cor=round((p.cor or 0) * 100, 2),
            end_date=p.end_date,
            renewal_status=p.renewal_status,
            risk_flags=p.risk_flags or [],
            discrepancy_flagged=bool(p.discrepancy_flagged),
        )
        for p in policies
    ]


@router.get("/portfolio", response_model=List[PortfolioSummary])
async def get_portfolio_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    rows = (
        db.query(
            RenewalPolicy.segment,
            func.count(RenewalPolicy.id).label("count"),
            func.coalesce(func.sum(RenewalPolicy.current_premium), 0).label("total_premium"),
            func.coalesce(func.avg(RenewalPolicy.lr), 0).label("avg_lr"),
        )
        .group_by(RenewalPolicy.segment)
        .all()
    )
    return [
        PortfolioSummary(
            segment=r.segment.value,
            count=r.count,
            total_premium=float(r.total_premium),
            avg_lr=round(float(r.avg_lr) * 100, 2),
        )
        for r in rows
    ]


@router.get("/renewal-timeline")
async def renewal_timeline(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    today = date.today()
    rows = (
        db.query(
            func.date_trunc("month", RenewalPolicy.end_date).label("month"),
            func.count(RenewalPolicy.id).label("count"),
            func.coalesce(func.sum(RenewalPolicy.renewal_premium), 0).label("premium"),
        )
        .filter(
            RenewalPolicy.end_date >= today,
            RenewalPolicy.renewal_status != RenewalStatus.TPA_ROUTED,
        )
        .group_by("month")
        .order_by("month")
        .limit(12)
        .all()
    )
    return [{"month": str(r.month)[:7], "count": r.count, "premium": float(r.premium or 0)} for r in rows]


@router.get("/rate-distribution")
async def rate_distribution(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    rows = (
        db.query(RenewalPolicy.rate_band, func.count(RenewalPolicy.id).label("count"))
        .filter(
            RenewalPolicy.rate_band.isnot(None),
            RenewalPolicy.segment != PolicySegment.TPA,
        )
        .group_by(RenewalPolicy.rate_band)
        .all()
    )
    return [{"band": r.rate_band, "count": r.count} for r in rows]


@router.get("/risk-flags")
async def risk_flag_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Count of policies per risk flag for dashboard indicators."""
    from app.models.renewal import RiskFlag
    result = {}
    for flag in RiskFlag:
        count = db.query(func.count(RenewalPolicy.id)).filter(
            RenewalPolicy.risk_flags.contains([flag.value])
        ).scalar() or 0
        result[flag.value] = count
    return result


@router.get("/sector-lr")
async def sector_lr(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Average LR by business sector for heatmap."""
    rows = (
        db.query(
            RenewalPolicy.business_sector,
            func.avg(RenewalPolicy.lr).label("avg_lr"),
            func.count(RenewalPolicy.id).label("count"),
        )
        .filter(
            RenewalPolicy.business_sector.isnot(None),
            RenewalPolicy.segment != PolicySegment.TPA,
        )
        .group_by(RenewalPolicy.business_sector)
        .order_by(func.avg(RenewalPolicy.lr).desc())
        .limit(20)
        .all()
    )
    return [
        {"sector": r.business_sector, "avg_lr": round((r.avg_lr or 0)*100, 2), "count": r.count}
        for r in rows
    ]
