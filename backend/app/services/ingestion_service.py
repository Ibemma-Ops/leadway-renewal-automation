"""
Excel Ingestion Service
-----------------------
Parses Corporate / Retail / TPA sheets.
TPA records are stored with segment=TPA and routed to TPA_ROUTED status —
they do NOT pass through the rate engine or notice generation pipeline.
Discrepancy validation: if workbook LR/COR deviates >1% from computed values,
the record is flagged for Underwriter review.
"""
import pandas as pd
from typing import List, Dict, Any, Optional, Tuple
from datetime import date, datetime
import logging
from sqlalchemy.orm import Session

from app.models.renewal import RenewalPolicy, PolicySegment, RenewalStatus, RiskFlag
from app.models.operations import UploadBatch, ApprovalWorkflow, ApprovalStepType, ApprovalStepStatus
from app.services.metrics_engine import compute_metrics
from app.services.rate_engine import compute_renewal_rate, STEP_ROLE
from app.services.audit_service import log_action

logger = logging.getLogger(__name__)

# ── Column aliasing ───────────────────────────────────────────────────────────
COLUMN_ALIASES: Dict[str, List[str]] = {
    "policy_number":    ["policy_number", "policy no", "policy_no", "policy number", "scheme ref", "scheme_ref"],
    "scheme_ref":       ["scheme_ref", "scheme ref", "group_ref", "group ref"],
    "company_name":     ["company_name", "company", "company name", "client name", "client_name", "employer"],
    "business_sector":  ["business_sector", "business sector", "sector", "industry"],
    "no_of_lives":      ["no_of_lives", "no of lives", "lives", "enrollees", "headcount"],
    "current_premium":  ["current_premium", "current premium", "premium", "annual premium", "current annual premium"],
    "total_claims":     ["total_claims", "total claims", "claims", "claims amount", "paid claims"],
    "total_premium":    ["total_premium", "total premium", "written premium", "earned premium"],
    "workbook_lr":      ["lr", "loss_ratio", "loss ratio", "l/r"],
    "workbook_cor":     ["cor", "combined_ratio", "combined ratio", "c/r"],
    "start_date":       ["start_date", "start date", "inception date", "inception_date", "commencement date"],
    "end_date":         ["end_date", "end date", "renewal_date", "renewal date", "expiry date", "expiry_date"],
    "contact_email":    ["contact_email", "email", "contact email", "client email"],
    "contact_name":     ["contact_name", "contact name", "contact person", "relationship manager"],
    "phone":            ["phone", "phone number", "mobile", "telephone"],
    "has_customised_benefit": ["customised_benefit", "customised benefit", "custom benefit", "bespoke"],
    "anti_selection":   ["anti_selection", "anti selection", "antiselection"],
    "adopted_enrollee_cohort": ["adopted_enrollee", "adopted enrollee", "adopted cohort"],
}

SHEET_SEGMENTS: Dict[str, PolicySegment] = {
    k: v
    for keys, v in [
        (["corporate", "corp"], PolicySegment.CORPORATE),
        (["retail"],            PolicySegment.RETAIL),
        (["tpa"],               PolicySegment.TPA),
    ]
    for k in keys
}

REQUIRED_COLS = ["policy_number", "company_name", "current_premium",
                 "total_claims", "total_premium", "end_date"]


def _normalise_columns(df: pd.DataFrame) -> pd.DataFrame:
    df_cols_lower = {c.lower().strip(): c for c in df.columns}
    col_map = {}
    for standard, aliases in COLUMN_ALIASES.items():
        for alias in aliases:
            if alias.lower() in df_cols_lower:
                col_map[df_cols_lower[alias.lower()]] = standard
                break
    return df.rename(columns=col_map)


def _parse_date(val) -> Optional[date]:
    if val is None:
        return None
    try:
        if pd.isna(val):
            return None
    except Exception:
        pass
    if isinstance(val, datetime):
        return val.date()
    if isinstance(val, date):
        return val
    try:
        return pd.to_datetime(str(val)).date()
    except Exception:
        return None


def _parse_float(val, default: float = 0.0) -> float:
    try:
        if val is None or (isinstance(val, float) and pd.isna(val)):
            return default
        return float(val)
    except Exception:
        return default


def _parse_bool(val) -> bool:
    if val is None:
        return False
    if isinstance(val, bool):
        return val
    return str(val).strip().lower() in ("yes", "true", "1", "y")


def _create_approval_steps(
    policy: RenewalPolicy,
    steps: List[str],
    db: Session,
) -> None:
    """Create the ordered approval workflow rows for a policy."""
    for order, step_type_str in enumerate(steps, start=1):
        step = ApprovalWorkflow(
            policy_id=policy.id,
            step_type=ApprovalStepType(step_type_str),
            step_order=order,
            required_role=STEP_ROLE.get(step_type_str, "SALES_OFFICER"),
            status=ApprovalStepStatus.PENDING,
        )
        db.add(step)


def ingest_excel(
    file_path: str,
    db: Session,
    batch_id: int,
    uploaded_by: int,
) -> Dict[str, Any]:
    results = {
        "total": 0, "processed": 0, "failed": 0,
        "tpa_routed": 0, "flagged": 0,
        "errors": [], "warnings": [],
    }

    try:
        xl = pd.ExcelFile(file_path)
    except Exception as e:
        results["errors"].append(f"Cannot open file: {e}")
        return results

    parsed_sheets: List[Tuple[str, PolicySegment]] = []
    for sheet_name in xl.sheet_names:
        seg = SHEET_SEGMENTS.get(sheet_name.lower().strip())
        if seg is None:
            results["warnings"].append(f"Skipping unrecognised sheet: '{sheet_name}'")
            continue
        parsed_sheets.append((sheet_name, seg))

    if not parsed_sheets:
        results["errors"].append("No recognised sheets (Corporate / Retail / TPA)")
        return results

    for sheet_name, segment in parsed_sheets:
        try:
            df = pd.read_excel(file_path, sheet_name=sheet_name)
            df = _normalise_columns(df)
            df = df.dropna(subset=["policy_number", "company_name"])

            # Validate required columns
            missing = [c for c in REQUIRED_COLS if c not in df.columns]
            if missing:
                results["errors"].append(
                    f"Sheet '{sheet_name}' missing required columns: {missing}"
                )
                continue

            for _, row in df.iterrows():
                results["total"] += 1
                try:
                    policy_number = str(row.get("policy_number", "")).strip()
                    if not policy_number:
                        raise ValueError("Empty policy_number")

                    existing = db.query(RenewalPolicy).filter(
                        RenewalPolicy.policy_number == policy_number
                    ).first()
                    if existing:
                        results["warnings"].append(
                            f"Policy '{policy_number}' already exists — skipped"
                        )
                        results["failed"] += 1
                        continue

                    current_premium = _parse_float(row.get("current_premium"), 0)
                    total_claims    = _parse_float(row.get("total_claims"), 0)
                    total_premium   = _parse_float(row.get("total_premium"), current_premium)
                    end_date        = _parse_date(row.get("end_date"))
                    start_date      = _parse_date(row.get("start_date"))

                    if not end_date:
                        raise ValueError("Invalid or missing end_date")

                    # Workbook-supplied LR/COR for discrepancy check
                    wb_lr_raw  = row.get("workbook_lr")
                    wb_cor_raw = row.get("workbook_cor")
                    workbook_lr  = _parse_float(wb_lr_raw) if wb_lr_raw is not None else None
                    workbook_cor = _parse_float(wb_cor_raw) if wb_cor_raw is not None else None
                    # Normalise: if supplied as percentage (e.g. 82.0) convert to decimal
                    if workbook_lr is not None and workbook_lr > 5:
                        workbook_lr /= 100.0
                    if workbook_cor is not None and workbook_cor > 5:
                        workbook_cor /= 100.0

                    # Other optional fields
                    has_customised  = _parse_bool(row.get("has_customised_benefit"))
                    anti_selection  = _parse_bool(row.get("anti_selection"))
                    adopted_cohort  = _parse_bool(row.get("adopted_enrollee_cohort"))

                    # ── TPA: route away from automated pipeline ───────────
                    if segment == PolicySegment.TPA:
                        policy = RenewalPolicy(
                            batch_id=batch_id,
                            policy_number=policy_number,
                            scheme_ref=str(row.get("scheme_ref", "") or "").strip() or None,
                            company_name=str(row.get("company_name", "")).strip(),
                            business_sector=str(row.get("business_sector", "") or "").strip() or None,
                            segment=PolicySegment.TPA,
                            contact_email=str(row.get("contact_email", "") or "").strip() or None,
                            contact_name=str(row.get("contact_name", "") or "").strip() or None,
                            phone=str(row.get("phone", "") or "").strip() or None,
                            no_of_lives=int(_parse_float(row.get("no_of_lives"), 0)),
                            current_premium=current_premium,
                            total_claims=total_claims,
                            total_premium=total_premium,
                            workbook_lr=workbook_lr,
                            workbook_cor=workbook_cor,
                            start_date=start_date,
                            end_date=end_date,
                            renewal_rate=None,
                            renewal_premium=None,
                            rate_band="TPA — Routed to TPA Desk",
                            approval_route="TPA_DESK",
                            risk_flags=[RiskFlag.TPA_REFERRAL.value],
                            renewal_status=RenewalStatus.TPA_ROUTED,
                        )
                        db.add(policy)
                        db.flush()
                        results["tpa_routed"] += 1
                        results["processed"] += 1
                        log_action(db, "TPA_ROUTED", user_id=uploaded_by,
                                   policy_id=policy.id,
                                   description=f"TPA policy {policy_number} routed to TPA desk")
                        continue

                    # ── Non-TPA: compute metrics ──────────────────────────
                    metrics = compute_metrics(
                        total_claims=total_claims,
                        total_premium=total_premium,
                        end_date=end_date,
                        start_date=start_date,
                        workbook_lr=workbook_lr,
                        workbook_cor=workbook_cor,
                    )

                    # Build risk flags
                    risk_flags: List[str] = []
                    if metrics["discrepancy_flagged"]:
                        risk_flags.append(RiskFlag.LR_COR_DISCREPANCY.value)
                        results["flagged"] += 1
                    if metrics["cor"] > 1.40:
                        risk_flags.append(RiskFlag.HIGH_COR.value)
                    elif metrics["cor"] > 0.95:
                        risk_flags.append(RiskFlag.HIGH_COR.value)
                    if anti_selection:
                        risk_flags.append(RiskFlag.ANTI_SELECTION.value)
                    if adopted_cohort:
                        risk_flags.append(RiskFlag.ADOPTED_ENROLLEE_COHORT.value)
                    if metrics["is_pro_rata"]:
                        risk_flags.append(RiskFlag.PRO_RATA_REVIEW.value)

                    rate_info = compute_renewal_rate(
                        lr=metrics["lr"],
                        cor=metrics["cor"],
                        current_premium=current_premium,
                        has_customised_benefit=has_customised,
                        risk_flags=risk_flags,
                        segment=segment.value,
                    )

                    # Determine initial renewal_status from approval route
                    first_step = (rate_info["approval_steps"] or ["SALES_CONFIRMATION"])[0]
                    status_map = {
                        "SALES_CONFIRMATION":          RenewalStatus.AWAITING_SALES_CONFIRMATION,
                        "UNDERWRITER_APPROVAL":        RenewalStatus.AWAITING_UNDERWRITER_APPROVAL,
                        "UNDERWRITER_ACKNOWLEDGEMENT": RenewalStatus.AWAITING_UNDERWRITER_ACKNOWLEDGEMENT,
                        "HBD_APPROVAL":                RenewalStatus.AWAITING_HBD_APPROVAL,
                        "MD_CEO_CONCURRENCE":          RenewalStatus.AWAITING_MD_CEO_CONCURRENCE,
                    }
                    initial_status = status_map.get(first_step, RenewalStatus.PENDING)

                    # Discrepancy-flagged records go to Underwriter even if COR is low
                    if metrics["discrepancy_flagged"]:
                        initial_status = RenewalStatus.AWAITING_UNDERWRITER_ACKNOWLEDGEMENT
                        if RiskFlag.LR_COR_DISCREPANCY.value not in risk_flags:
                            risk_flags.append(RiskFlag.LR_COR_DISCREPANCY.value)

                    policy = RenewalPolicy(
                        batch_id=batch_id,
                        policy_number=policy_number,
                        scheme_ref=str(row.get("scheme_ref", "") or "").strip() or None,
                        company_name=str(row.get("company_name", "")).strip(),
                        business_sector=str(row.get("business_sector", "") or "").strip() or None,
                        segment=segment,
                        contact_email=str(row.get("contact_email", "") or "").strip() or None,
                        contact_name=str(row.get("contact_name", "") or "").strip() or None,
                        phone=str(row.get("phone", "") or "").strip() or None,
                        no_of_lives=int(_parse_float(row.get("no_of_lives"), 0)),
                        current_premium=current_premium,
                        total_claims=total_claims,
                        total_premium=total_premium,
                        workbook_lr=workbook_lr,
                        workbook_cor=workbook_cor,
                        start_date=start_date,
                        end_date=end_date,
                        days_to_renewal=metrics["days_to_renewal"],
                        policy_months=metrics["policy_months"],
                        is_pro_rata=metrics["is_pro_rata"],
                        earned_premium=metrics["earned_premium"],
                        lr=metrics["lr"],
                        cor=metrics["cor"],
                        lr_cor_discrepancy_pct=metrics["lr_cor_discrepancy_pct"],
                        discrepancy_flagged=metrics["discrepancy_flagged"],
                        renewal_rate=rate_info["renewal_rate"],
                        renewal_premium=rate_info["renewal_premium"],
                        rate_band=rate_info["rate_band"],
                        approval_route=rate_info["approval_route"],
                        has_customised_benefit=has_customised,
                        risk_flags=list(set(risk_flags)),
                        renewal_status=initial_status,
                    )
                    db.add(policy)
                    db.flush()   # get policy.id

                    # Create approval workflow steps
                    if rate_info["approval_steps"]:
                        _create_approval_steps(policy, rate_info["approval_steps"], db)

                    results["processed"] += 1

                except Exception as row_err:
                    results["failed"] += 1
                    results["errors"].append(
                        f"Row error (policy {row.get('policy_number', 'unknown')}): {row_err}"
                    )

        except Exception as sheet_err:
            results["errors"].append(f"Sheet '{sheet_name}' error: {sheet_err}")

    db.commit()
    return results


REQUIRED_COLUMNS = {
    "policy_number": ["policy_number", "policy no", "policy_no", "policy number"],
    "company_name": ["company_name", "company name", "client name", "client_name"],
    "current_premium": ["current_premium", "current premium", "premium", "annual premium"],
    "total_claims": ["total_claims", "total claims", "claims", "claims amount"],
    "total_premium": ["total_premium", "total premium", "written premium"],
    "renewal_date": ["renewal_date", "renewal date", "expiry date", "expiry_date"],
    "contact_email": ["contact_email", "email", "contact email", "client email"],
    "contact_name": ["contact_name", "contact name", "contact person"],
    "phone": ["phone", "phone number", "mobile", "telephone"],
    "inception_date": ["inception_date", "inception date", "start date", "commencement date"],
}

SHEET_TYPES = {
    "Corporate": "CORPORATE",
    "corporate": "CORPORATE",
    "CORPORATE": "CORPORATE",
    "Retail": "RETAIL",
    "retail": "RETAIL",
    "RETAIL": "RETAIL",
    "TPA": "TPA",
    "tpa": "TPA",
    "Tpa": "TPA",
}


def normalize_columns(df: pd.DataFrame) -> pd.DataFrame:
    """Normalize column names to standard format."""
    col_map = {}
    df_cols_lower = {c.lower().strip(): c for c in df.columns}

    for standard_col, aliases in REQUIRED_COLUMNS.items():
        for alias in aliases:
            if alias.lower() in df_cols_lower:
                col_map[df_cols_lower[alias.lower()]] = standard_col
                break

    return df.rename(columns=col_map)


def validate_dataframe(df: pd.DataFrame, sheet_name: str) -> Tuple[bool, List[str]]:
    """Validate required columns exist."""
    errors = []
    required = ["policy_number", "company_name", "current_premium", "total_claims",
                "total_premium", "renewal_date"]
    for col in required:
        if col not in df.columns:
            errors.append(f"Sheet '{sheet_name}': Missing required column '{col}'")
    return len(errors) == 0, errors


def parse_date(val) -> date:
    if pd.isna(val):
        return None
    if isinstance(val, (date, datetime)):
        return val.date() if isinstance(val, datetime) else val
    try:
        return pd.to_datetime(str(val)).date()
    except Exception:
        return None


def ingest_excel(
    file_path: str,
    db: Session,
    batch_id: int,
    uploaded_by: int,
) -> Dict[str, Any]:
    """
    Parse all sheets from the Excel file and store policies in DB.
    Returns summary dict with counts and errors.
    """
    results = {
        "total": 0,
        "processed": 0,
        "failed": 0,
        "errors": [],
        "warnings": [],
    }

    try:
        xl = pd.ExcelFile(file_path)
    except Exception as e:
        results["errors"].append(f"Cannot open file: {str(e)}")
        return results

    parsed_sheets = []
    for sheet_name in xl.sheet_names:
        policy_type = SHEET_TYPES.get(sheet_name)
        if policy_type is None:
            results["warnings"].append(f"Skipping unrecognized sheet: '{sheet_name}'")
            continue
        parsed_sheets.append((sheet_name, policy_type))

    if not parsed_sheets:
        results["errors"].append(
            "No recognized sheets found. Expected: Corporate, Retail, TPA"
        )
        return results

    for sheet_name, policy_type in parsed_sheets:
        try:
            df = pd.read_excel(file_path, sheet_name=sheet_name)
            df = normalize_columns(df)
            valid, errors = validate_dataframe(df, sheet_name)
            if not valid:
                results["errors"].extend(errors)
                continue

            # Drop empty rows
            df = df.dropna(subset=["policy_number", "company_name"])

            for _, row in df.iterrows():
                results["total"] += 1
                try:
                    policy_number = str(row.get("policy_number", "")).strip()
                    if not policy_number:
                        raise ValueError("Empty policy number")

                    # Check for duplicate
                    existing = db.query(RenewalPolicy).filter(
                        RenewalPolicy.policy_number == policy_number
                    ).first()
                    if existing:
                        results["warnings"].append(
                            f"Policy {policy_number} already exists — skipping"
                        )
                        results["failed"] += 1
                        continue

                    current_premium = float(row.get("current_premium", 0) or 0)
                    total_claims = float(row.get("total_claims", 0) or 0)
                    total_premium = float(row.get("total_premium", 0) or current_premium)
                    renewal_date = parse_date(row.get("renewal_date"))

                    if not renewal_date:
                        raise ValueError(f"Invalid renewal_date for policy {policy_number}")

                    metrics = compute_metrics(
                        total_claims=total_claims,
                        total_premium=total_premium,
                        renewal_date=renewal_date,
                    )
                    rate_info = compute_renewal_rate(
                        loss_ratio=metrics["loss_ratio"],
                        cor=metrics["combined_operating_ratio"],
                        current_premium=current_premium,
                    )

                    policy = RenewalPolicy(
                        batch_id=batch_id,
                        policy_number=policy_number,
                        company_name=str(row.get("company_name", "")).strip(),
                        policy_type=policy_type,
                        contact_email=str(row.get("contact_email", "") or "").strip() or None,
                        contact_name=str(row.get("contact_name", "") or "").strip() or None,
                        phone=str(row.get("phone", "") or "").strip() or None,
                        current_premium=current_premium,
                        total_claims=total_claims,
                        total_premium=total_premium,
                        inception_date=parse_date(row.get("inception_date")),
                        renewal_date=renewal_date,
                        days_to_renewal=metrics["days_to_renewal"],
                        loss_ratio=metrics["loss_ratio"],
                        combined_operating_ratio=metrics["combined_operating_ratio"],
                        renewal_rate_pct=rate_info["renewal_rate_pct"],
                        renewal_premium=rate_info["renewal_premium"],
                        rate_band=rate_info["rate_band"],
                        requires_approval=rate_info["requires_approval"],
                    )
                    db.add(policy)
                    results["processed"] += 1

                except Exception as row_err:
                    results["failed"] += 1
                    results["errors"].append(
                        f"Row error (policy {row.get('policy_number', 'unknown')}): {str(row_err)}"
                    )

        except Exception as sheet_err:
            results["errors"].append(f"Sheet '{sheet_name}' error: {str(sheet_err)}")

    db.commit()
    return results
