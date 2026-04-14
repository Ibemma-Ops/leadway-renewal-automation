# Leadway Health MRAS
## Monthly Renewal Automation System — Corrected Implementation

> Production-grade internal platform implementing the full Leadway MRAS specification.
> This README documents the **actual implemented behaviour** — not aspirational features.

---

## Approval Matrix (Exact Specification)

This is the core business logic. Every entry is enforced server-side — no bypass is possible through the UI or API.

| COR Scenario | Rate Adjustment | Required Approval Chain |
|---|---|---|
| COR < 80% | 0% — Same Rate | Automated — No approval required
| COR 80% – 114% | Up to 35% | Sales Officer confirmation |
| COR 115% – 140% | 35% – 60% | Sales Officer confirmation → Underwriter approval (joint sign-off) |
| COR > 140% (standard) | ≥ 60% / escalation | HBD approval |
| COR > 140% + customised benefit | ≥ 60% | HBD approval → MD/CEO concurrence |
| Anti-selection / adopted enrollee cohort | Any rate | Underwriter must acknowledge + document concession rationale before chain proceeds |
| TPA segment | N/A — not rated | Removed from automated pipeline; routed to TPA Desk workflow |

### Rules enforced in code
- No renewal notice is generated unless `renewal_status == APPROVED`
- Email dispatch is blocked unless `renewal_status` is `APPROVED`, `NOTICE_SENT`, or `CONFIRMED`
- Approval steps must be actioned in `step_order` sequence — earlier steps cannot be skipped
- Role check is performed server-side on every action endpoint — API-level bypass is not possible
- TPA records receive no rate computation and enter `TPA_ROUTED` status immediately on upload
- Discrepancy-flagged records (LR/COR mismatch > 1%) enter `AWAITING_UNDERWRITER_ACKNOWLEDGEMENT` regardless of COR band

---

## Renewal Status Lifecycle

```
PENDING
  ↓ (after ingestion, based on COR band)
AWAITING_SALES_CONFIRMATION
  ↓ (Sales Officer approves)
AWAITING_UNDERWRITER_APPROVAL       ← only for COR 115–140%
  ↓ (Underwriter approves)
AWAITING_HBD_APPROVAL               ← only for COR > 140%
  ↓ (HBD approves)
AWAITING_MD_CEO_CONCURRENCE         ← only for COR > 140% + customised benefit
  ↓ (MD/CEO concurs)
APPROVED                            ← notice generation and email dispatch now permitted
  ↓
NOTICE_SENT → CONFIRMED

TPA policies: always TPA_ROUTED (separate pipeline)
Discrepancy-flagged: AWAITING_UNDERWRITER_ACKNOWLEDGEMENT first, then normal chain
Any rejection at any step: REJECTED (terminal)
Past end_date with no confirmation: LAPSED (auto-set by scheduler)
```

---

## TPA Handling

TPA records are identified by the sheet name `TPA` in the uploaded workbook.

- Stored with `segment = TPA`
- No LR, COR, or rate computation is performed
- Status set to `TPA_ROUTED` immediately on import
- Excluded from all automated rate, notice, and email pipelines
- Visible in a dedicated TPA Desk queue in the Approvals page
- Filtered separately in Dashboard and Renewals pages
- Count shown distinctly in upload batch results and dashboard KPIs

---

## LR/COR Discrepancy Validation

On workbook upload, the system recomputes LR and COR from raw `total_claims` and `total_premium` (or `earned_premium` for pro-rata schemes).

If the workbook contains `lr` or `cor` columns, the system compares:
- `|computed_lr – workbook_lr| > 1%` → `discrepancy_flagged = True`
- `|computed_cor – workbook_cor| > 1%` → `discrepancy_flagged = True`

When flagged:
- `risk_flags` array includes `LR_COR_DISCREPANCY`
- `renewal_status` is set to `AWAITING_UNDERWRITER_ACKNOWLEDGEMENT` regardless of COR band
- Discrepancy % stored in `lr_cor_discrepancy_pct` field
- Visible on Dashboard (alert card + heatmap), Renewals table, and policy detail modal

---

## Pro-Rata Support

For schemes with policy periods shorter than 12 months:
- `policy_months` = actual period in months (derived from `start_date` to `end_date`)
- `is_pro_rata = True` if period is outside 11.5–12.5 months
- `earned_premium` is annualised: `total_premium × (12 / policy_months)`
- LR is computed against annualised earned premium
- `PRO_RATA_REVIEW` risk flag is set
- Displayed in renewal notice and policy detail

---

## Risk Flags

Risk flags are stored as a JSON array on each policy. All flags are visible in dashboard tables, policy detail, and approval queues.

| Flag | Trigger | Effect |
|---|---|---|
| `HIGH_COR` | COR ≥ 80% | Visual indicator |
| `ANTI_SELECTION` | `anti_selection` column in workbook | Prepends `UNDERWRITER_ACKNOWLEDGEMENT` step |
| `ADOPTED_ENROLLEE_COHORT` | `adopted_enrollee_cohort` column | Same as anti-selection |
| `TPA_REFERRAL` | TPA segment | Routes to TPA desk |
| `LR_COR_DISCREPANCY` | Computed vs workbook diff > 1% | Routes to Underwriter acknowledgement |
| `PRO_RATA_REVIEW` | Policy period ≠ 12 months | Manual review flag |
| `CUSTOMISED_BENEFIT` | `customised_benefit` column | Upgrades COR > 140% route to HBD + MD/CEO |

---

## Data Model (Canonical Field Names)

| Field | Type | Description |
|---|---|---|
| `policy_number` | String | Unique policy identifier |
| `scheme_ref` | String | Alternate scheme/group reference |
| `company_name` | String | Client company (spec: "company") |
| `business_sector` | String | Industry sector |
| `segment` | Enum | CORPORATE / RETAIL / TPA |
| `no_of_lives` | Integer | Number of enrolled lives |
| `current_premium` | Float | Current year annual premium |
| `total_premium` | Float | Written/earned premium for LR computation |
| `total_claims` | Float | Total claims paid |
| `earned_premium` | Float | Annualised earned (pro-rata adjusted) |
| `lr` | Float | Loss ratio (decimal, e.g. 0.82 = 82%) |
| `cor` | Float | Combined operating ratio (= LR + 0.15) |
| `workbook_lr` | Float | LR from uploaded workbook (for discrepancy check) |
| `workbook_cor` | Float | COR from uploaded workbook |
| `lr_cor_discrepancy_pct` | Float | Discrepancy percentage |
| `start_date` | Date | Policy inception date |
| `end_date` | Date | Policy expiry / renewal date |
| `days_to_renewal` | Integer | Days until end_date from today |
| `renewal_rate` | Float | Rate adjustment % (e.g. 35.0) |
| `renewal_premium` | Float | Proposed renewal premium |
| `approval_route` | String | Which approval chain applies |
| `risk_flags` | JSON Array | List of RiskFlag values |
| `renewal_status` | Enum | Current position in lifecycle |

---

## Excel Upload Format

The workbook must contain sheets named **Corporate**, **Retail**, and/or **TPA**.

### Required columns (all sheets)

| Column | Notes |
|---|---|
| `policy_number` | Unique identifier |
| `company` or `company_name` | Client name |
| `current_premium` | Current annual premium |
| `total_claims` | Total claims amount |
| `total_premium` | Written or earned premium |
| `end_date` or `renewal_date` | Renewal/expiry date |

### Optional columns

| Column | Purpose |
|---|---|
| `scheme_ref` | Alternate scheme reference |
| `business_sector` | Industry sector for heatmap |
| `no_of_lives` | Enrolled lives count |
| `start_date` | For pro-rata computation |
| `contact_email`, `contact_name`, `phone` | Client contact |
| `lr`, `cor` | Workbook-supplied values for discrepancy validation |
| `customised_benefit` | yes/no — triggers HBD + MD/CEO route for COR > 140% |
| `anti_selection` | yes/no — triggers Underwriter acknowledgement |
| `adopted_enrollee_cohort` | yes/no — triggers Underwriter acknowledgement |

---

## User Roles

| Role | Permissions |
|---|---|
| `SALES_OFFICER` | Upload; view policies; action `SALES_CONFIRMATION` steps; trigger emails for approved policies |
| `UNDERWRITER` | All above + action `UNDERWRITER_APPROVAL` and `UNDERWRITER_ACKNOWLEDGEMENT` steps |
| `HBD` | All above + action `HBD_APPROVAL` steps |
| `MD_CEO` | All above + action `MD_CEO_CONCURRENCE` steps; view all queues |
| `ADMIN` | Full access including user management; can action any step |

---

## Tech Stack

```
Backend:   Python 3.11 · FastAPI · PostgreSQL · SQLAlchemy
Scheduler: Celery + Redis + celery-beat (daily 08:00 WAT)
Frontend:  React 18 · Vite · Tailwind CSS · Recharts
Infra:     Docker · Docker Compose · Nginx · Render
Documents: python-docx · LibreOffice PDF conversion
Email:     SMTP (Gmail compatible) / SendGrid
```

---

## Local Setup

```bash
git clone https://github.com/your-org/leadway-mras.git
cd leadway-mras
cp .env.example .env          # fill in SECRET_KEY and SMTP credentials
docker-compose up --build
# seed admin:
curl -X POST http://localhost:8000/api/v1/auth/seed-admin
```

- **Frontend:** http://localhost:5173
- **API Docs:** http://localhost:8000/api/docs
- **Default admin:** `admin@leadwayhealth.com` / `Admin@2024!`

---

## Render Deployment

1. Push to GitHub
2. Create PostgreSQL + Redis on Render
3. Deploy backend as **Web Service** — root `backend`, start command `uvicorn main:app --host 0.0.0.0 --port $PORT`
4. Deploy Celery worker as **Background Worker** — same root, command `celery -A app.core.celery_app worker --loglevel=info`
5. Deploy Celery beat as **Background Worker** — command `celery -A app.core.celery_app beat --loglevel=info`
6. Deploy frontend as **Static Site** — root `frontend`, build `npm install && npm run build`, publish `dist`
7. Set all env vars (see `.env.example`)
8. Seed admin after deployment

---

## Email Schedule (Celery Beat)

Runs daily at 08:00 WAT. Emails are dispatched **only** for policies with `renewal_status` in `APPROVED`, `NOTICE_SENT`, or `CONFIRMED`.

| Trigger | Days Before Renewal | Template |
|---|---|---|
| D-60 | 60 days | Courtesy notice |
| D-30 | 30 days | Urgent follow-up |
| D-7 | 7 days | Final notice |
| D-0 | Renewal day | Last chance |

Failed emails retry up to 3 times at 5-minute intervals.

---

© 2024 Leadway Health Insurance Limited — Internal Use Only
