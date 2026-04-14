import { clsx } from "clsx";

export const cn = (...args) => clsx(...args);

export const formatCurrency = (val) =>
  val == null ? "—" : `₦${Number(val).toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export const formatPct = (val, decimals = 1) =>
  val == null ? "—" : `${Number(val).toFixed(decimals)}%`;

export const formatDate = (val) => {
  if (!val) return "—";
  return new Date(val).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
};

export const formatDateTime = (val) => {
  if (!val) return "—";
  return new Date(val).toLocaleString("en-GB", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
};

export const downloadBlob = (blob, filename) => {
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  window.URL.revokeObjectURL(url);
};

// ── Canonical renewal_status values from spec ─────────────────────────────
export const RENEWAL_STATUS_META = {
  PENDING:                              { label: "Pending",                       cls: "bg-gray-100 text-gray-600" },
  AWAITING_SALES_CONFIRMATION:          { label: "Awaiting Sales Confirmation",   cls: "bg-yellow-100 text-yellow-800" },
  AWAITING_UNDERWRITER_ACKNOWLEDGEMENT: { label: "Awaiting UW Acknowledgement",   cls: "bg-orange-100 text-orange-800" },
  AWAITING_UNDERWRITER_APPROVAL:        { label: "Awaiting Underwriter Approval", cls: "bg-blue-100 text-blue-800" },
  AWAITING_HBD_APPROVAL:                { label: "Awaiting HBD Approval",         cls: "bg-purple-100 text-purple-800" },
  AWAITING_MD_CEO_CONCURRENCE:          { label: "Awaiting MD/CEO Concurrence",   cls: "bg-indigo-100 text-indigo-800" },
  TPA_ROUTED:                           { label: "TPA Routed",                    cls: "bg-teal-100 text-teal-800" },
  APPROVED:                             { label: "Approved",                      cls: "bg-green-100 text-green-800" },
  NOTICE_SENT:                          { label: "Notice Sent",                   cls: "bg-emerald-100 text-emerald-800" },
  CONFIRMED:                            { label: "Confirmed",                     cls: "bg-green-200 text-green-900" },
  REJECTED:                             { label: "Rejected",                      cls: "bg-red-100 text-red-800" },
  LAPSED:                               { label: "Lapsed",                        cls: "bg-gray-200 text-gray-600" },
};

export const STEP_TYPE_META = {
  SALES_CONFIRMATION:          { label: "Sales Confirmation",        role: "SALES_OFFICER", cls: "bg-yellow-100 text-yellow-800" },
  UNDERWRITER_ACKNOWLEDGEMENT: { label: "UW Acknowledgement",        role: "UNDERWRITER",   cls: "bg-orange-100 text-orange-800" },
  UNDERWRITER_APPROVAL:        { label: "Underwriter Approval",      role: "UNDERWRITER",   cls: "bg-blue-100 text-blue-800" },
  HBD_APPROVAL:                { label: "HBD Approval",              role: "HBD",           cls: "bg-purple-100 text-purple-800" },
  MD_CEO_CONCURRENCE:          { label: "MD/CEO Concurrence",        role: "MD_CEO",        cls: "bg-indigo-100 text-indigo-800" },
};

export const STEP_STATUS_META = {
  PENDING:      { label: "Pending",      cls: "bg-yellow-100 text-yellow-800" },
  APPROVED:     { label: "Approved",     cls: "bg-green-100 text-green-800" },
  ACKNOWLEDGED: { label: "Acknowledged", cls: "bg-blue-100 text-blue-800" },
  REJECTED:     { label: "Rejected",     cls: "bg-red-100 text-red-800" },
};

export const RISK_FLAG_META = {
  HIGH_COR:                { label: "High COR",             cls: "bg-red-100 text-red-700" },
  ANTI_SELECTION:          { label: "Anti-Selection",       cls: "bg-orange-100 text-orange-800" },
  ADOPTED_ENROLLEE_COHORT: { label: "Adopted Enrollee",     cls: "bg-orange-100 text-orange-800" },
  TPA_REFERRAL:            { label: "TPA Referral",         cls: "bg-teal-100 text-teal-700" },
  LR_COR_DISCREPANCY:      { label: "LR/COR Discrepancy",  cls: "bg-rose-100 text-rose-800" },
  PRO_RATA_REVIEW:         { label: "Pro-rata Review",      cls: "bg-yellow-100 text-yellow-700" },
  CUSTOMISED_BENEFIT:      { label: "Customised Benefit",   cls: "bg-purple-100 text-purple-800" },
};

// COR as percent number (e.g. 87.5)
export const COR_COLOR = (cor) => {
  if (cor < 80)  return "text-green-600";
  if (cor < 95)  return "text-yellow-600";
  if (cor < 115) return "text-orange-500";
  return "text-red-600";
};

// Which step types a given user role can action
export const ROLE_ACTIONABLE_STEPS = {
  SALES_OFFICER: ["SALES_CONFIRMATION"],
  UNDERWRITER:   ["UNDERWRITER_ACKNOWLEDGEMENT", "UNDERWRITER_APPROVAL"],
  HBD:           ["HBD_APPROVAL"],
  MD_CEO:        ["MD_CEO_CONCURRENCE"],
  ADMIN:         ["SALES_CONFIRMATION","UNDERWRITER_ACKNOWLEDGEMENT","UNDERWRITER_APPROVAL","HBD_APPROVAL","MD_CEO_CONCURRENCE"],
};

// Whether a policy status permits email dispatch
export const canDispatchEmail = (status) =>
  ["APPROVED","NOTICE_SENT","CONFIRMED"].includes(status);

// Whether a policy status permits document generation
export const canGenerateDoc = (status) =>
  status === "APPROVED";
