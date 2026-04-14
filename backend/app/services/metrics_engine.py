from datetime import date
from typing import Dict, Any, Optional

# How much the computed LR/COR can differ from the workbook value before flagging
DISCREPANCY_THRESHOLD = 0.01   # 1 percentage point (as decimal)


def compute_earned_premium(
    total_premium: float,
    start_date: Optional[date],
    end_date: Optional[date],
) -> Dict[str, Any]:
    """
    Compute earned premium with pro-rata support.

    For annual (12-month) schemes, earned_premium == total_premium.
    For mid-year / partial-period schemes the premium is annualised:
        earned = total_premium * (12 / actual_months)
    Returns actual months, is_pro_rata flag, and earned premium.
    """
    if start_date and end_date and start_date < end_date:
        # Calculate months between start and end (fractional)
        delta_days = (end_date - start_date).days
        actual_months = round(delta_days / 30.4375, 4)   # average days/month
    else:
        actual_months = 12.0

    is_pro_rata = not (11.5 <= actual_months <= 12.5)

    if is_pro_rata and actual_months > 0:
        earned_premium = total_premium * (12.0 / actual_months)
    else:
        earned_premium = total_premium
        actual_months = 12.0

    return {
        "policy_months": actual_months,
        "is_pro_rata": is_pro_rata,
        "earned_premium": round(earned_premium, 2),
    }


def compute_metrics(
    total_claims: float,
    total_premium: float,
    end_date: date,                         # spec name: end_date (= renewal/expiry)
    start_date: Optional[date] = None,
    workbook_lr: Optional[float] = None,    # decimal from workbook, e.g. 0.82
    workbook_cor: Optional[float] = None,
) -> Dict[str, Any]:
    """
    Compute LR, COR, days_to_renewal, discrepancy flags.

    LR  = total_claims / earned_premium
    COR = LR + 0.15

    If workbook_lr / workbook_cor supplied, compare against computed values.
    If |computed - workbook| > 1%, set discrepancy_flagged = True.
    """
    pro_rata = compute_earned_premium(total_premium, start_date, end_date)
    earned = pro_rata["earned_premium"]

    lr  = round(total_claims / earned, 6) if earned > 0 else 0.0
    cor = round(lr + 0.15, 6)

    # Days to renewal
    today = date.today()
    days_to_renewal = (end_date - today).days

    # Discrepancy check
    discrepancy_pct = None
    discrepancy_flagged = False

    if workbook_lr is not None:
        lr_diff = abs(lr - workbook_lr)
        if lr_diff > DISCREPANCY_THRESHOLD:
            discrepancy_flagged = True
            discrepancy_pct = round(lr_diff * 100, 3)

    if workbook_cor is not None and not discrepancy_flagged:
        cor_diff = abs(cor - workbook_cor)
        if cor_diff > DISCREPANCY_THRESHOLD:
            discrepancy_flagged = True
            discrepancy_pct = round(cor_diff * 100, 3)

    return {
        "lr": lr,
        "cor": cor,
        "earned_premium": earned,
        "policy_months": pro_rata["policy_months"],
        "is_pro_rata": pro_rata["is_pro_rata"],
        "days_to_renewal": days_to_renewal,
        "discrepancy_flagged": discrepancy_flagged,
        "lr_cor_discrepancy_pct": discrepancy_pct,
    }

