"""
Rate Engine — implements the MRAS approval matrix exactly as specified:

  COR < 80%           → SAME RATE, no approver — Sales Officer confirms dispatch only
  COR 81%–114%        → up to 35% increase, Sales Officer confirmation required
  COR 115%–140%       → 35–60% increase, Sales Officer + Underwriter joint sign-off
  COR > 140%          → >60% / escalation, HBD approval required
  COR > 140% + custom benefit → HBD approval AND MD/CEO concurrence
  TPA segment         → routed out of automated pipeline entirely (not rated here)
  Anti-selection / adopted enrollee cohort → Underwriter must acknowledge first

Approval route keys map to the sequence of ApprovalStepType values that must be
completed (in order) before a notice can be generated and dispatched.
"""
from typing import Dict, Any, List, Optional


# ── Rate band definitions ────────────────────────────────────────────────────
# (cor_min_exclusive, cor_max_inclusive, rate_increase_pct, approval_route_key, label)
# All COR values are decimals (0.80 = 80%).
_BANDS = [
    # COR < 0.80  → same rate
    (None,  0.80,  0.0,  "SALES_CONFIRMATION",        "< 80% — Same Rate"),
    # COR 0.80–1.14 → up to 35% — Sales Officer confirmation
    (0.80,  1.14,  35.0, "SALES_CONFIRMATION",        "80–114% — Up to 35% Increase (Sales Confirmation)"),
    # COR 1.15–1.40 → 35–60% — Sales Officer + Underwriter joint sign-off
    (1.14,  1.40,  60.0, "SALES_AND_UNDERWRITER",     "115–140% — 35–60% Increase (Sales + Underwriter)"),
    # COR > 1.40 (standard)    → HBD approval
    (1.40,  None,  60.0, "HBD_APPROVAL",              "> 140% — HBD Approval Required"),
]

# Approval route → ordered list of ApprovalStepType values that must complete
APPROVAL_ROUTES: Dict[str, List[str]] = {
    # COR < 80% and 80–114%: only Sales Officer confirmation needed
    "SALES_CONFIRMATION":    ["SALES_CONFIRMATION"],
    # COR 115–140%: Sales confirms first, then Underwriter approves
    "SALES_AND_UNDERWRITER": ["SALES_CONFIRMATION", "UNDERWRITER_APPROVAL"],
    # COR > 140% standard: HBD approval
    "HBD_APPROVAL":          ["HBD_APPROVAL"],
    # COR > 140% with customised benefit: HBD then MD/CEO
    "HBD_AND_MD_CEO":        ["HBD_APPROVAL", "MD_CEO_CONCURRENCE"],
    # Anti-selection / adopted enrollee: Underwriter acknowledges first, then normal chain
    "UNDERWRITER_ACK_THEN_SALES": ["UNDERWRITER_ACKNOWLEDGEMENT", "SALES_CONFIRMATION"],
    # TPA — should never reach rate engine; handled at ingestion
    "TPA_DESK":              [],
}

# Required role per step type
STEP_ROLE: Dict[str, str] = {
    "SALES_CONFIRMATION":          "SALES_OFFICER",
    "UNDERWRITER_APPROVAL":        "UNDERWRITER",
    "UNDERWRITER_ACKNOWLEDGEMENT": "UNDERWRITER",
    "HBD_APPROVAL":                "HBD",
    "MD_CEO_CONCURRENCE":          "MD_CEO",
}


def compute_renewal_rate(
    lr: float,
    cor: float,
    current_premium: float,
    has_customised_benefit: bool = False,
    risk_flags: Optional[List[str]] = None,
    segment: str = "CORPORATE",
) -> Dict[str, Any]:
    """
    Determine renewal rate, rate band, and required approval route.

    Parameters use decimal representations (cor=0.85 means 85%).
    Returns:
        renewal_rate        – adjustment percentage (e.g. 35.0 for 35%)
        renewal_premium     – proposed renewed premium (₦)
        rate_band           – human-readable band label
        approval_route      – key into APPROVAL_ROUTES
        approval_steps      – ordered list of step type strings for this policy
        notice_blocked      – True if notice must not be generated until steps complete
    """
    flags = risk_flags or []

    # TPA segment: out of automated pipeline
    if segment == "TPA":
        return {
            "renewal_rate":    None,
            "renewal_premium": None,
            "rate_band":       "TPA — Routed to TPA Desk",
            "approval_route":  "TPA_DESK",
            "approval_steps":  [],
            "notice_blocked":  True,
        }

    # Determine base band
    rate_pct = 0.0
    route_key = "SALES_CONFIRMATION"
    band_label = "< 80% — Same Rate"

    for cor_min, cor_max, pct, route, label in _BANDS:
        above_min = (cor_min is None) or (cor > cor_min)
        at_or_below_max = (cor_max is None) or (cor <= cor_max)
        if above_min and at_or_below_max:
            rate_pct   = pct
            route_key  = route
            band_label = label
            break

    # Upgrade route for customised benefit at > 140%
    if cor > 1.40 and has_customised_benefit:
        route_key  = "HBD_AND_MD_CEO"
        band_label = "> 140% + Customised Benefit — HBD + MD/CEO Required"

    # Anti-selection / adopted enrollee: prepend Underwriter acknowledgement
    needs_uw_ack = (
        "ANTI_SELECTION" in flags or
        "ADOPTED_ENROLLEE_COHORT" in flags
    )
    if needs_uw_ack:
        if route_key == "SALES_CONFIRMATION":
            route_key = "UNDERWRITER_ACK_THEN_SALES"
        elif route_key == "SALES_AND_UNDERWRITER":
            # Already includes underwriter — change to acknowledgement first
            # (UNDERWRITER_ACKNOWLEDGEMENT, SALES_CONFIRMATION, UNDERWRITER_APPROVAL)
            # Store as custom override
            route_key = "UNDERWRITER_ACK_SALES_AND_UW"
            APPROVAL_ROUTES["UNDERWRITER_ACK_SALES_AND_UW"] = [
                "UNDERWRITER_ACKNOWLEDGEMENT",
                "SALES_CONFIRMATION",
                "UNDERWRITER_APPROVAL",
            ]

    approval_steps = APPROVAL_ROUTES.get(route_key, [])

    # A notice is blocked until every required step is APPROVED/ACKNOWLEDGED
    notice_blocked = len(approval_steps) > 0

    renewal_premium = round(current_premium * (1 + rate_pct / 100), 2)

    return {
        "renewal_rate":    rate_pct,
        "renewal_premium": renewal_premium,
        "rate_band":       band_label,
        "approval_route":  route_key,
        "approval_steps":  approval_steps,
        "notice_blocked":  notice_blocked,
    }


def get_rate_band_reference() -> list:
    """Return the rate band reference table for UI/README."""
    return [
        {"cor_range": "< 80%",      "rate_adjustment": "0% (Same Rate)",    "approval_required": "Sales Officer confirmation"},
        {"cor_range": "80% – 114%", "rate_adjustment": "Up to 35%",         "approval_required": "Sales Officer confirmation"},
        {"cor_range": "115% – 140%","rate_adjustment": "35% – 60%",         "approval_required": "Sales Officer + Underwriter joint sign-off"},
        {"cor_range": "> 140%",     "rate_adjustment": "≥ 60% / Escalation","approval_required": "HBD approval"},
        {"cor_range": "> 140% + customised benefit", "rate_adjustment": "≥ 60%", "approval_required": "HBD + MD/CEO concurrence"},
        {"cor_range": "TPA",        "rate_adjustment": "N/A",               "approval_required": "TPA Desk routing"},
    ]

