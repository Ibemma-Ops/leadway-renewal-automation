import { cn, RENEWAL_STATUS_META, STEP_TYPE_META, STEP_STATUS_META, RISK_FLAG_META } from "../../utils/helpers";
import { Loader2, AlertCircle, ChevronLeft, ChevronRight, AlertTriangle } from "lucide-react";

// ── Status badge for renewal_status ──────────────────────────────────────────
export function RenewalStatusBadge({ status }) {
  const meta = RENEWAL_STATUS_META[status] || { label: status, cls: "bg-gray-100 text-gray-600" };
  return <span className={cn("badge", meta.cls)}>{meta.label}</span>;
}

// ── Legacy alias (keeps any remaining callers working) ────────────────────────
export const StatusBadge = RenewalStatusBadge;

// ── Step type badge ───────────────────────────────────────────────────────────
export function StepTypeBadge({ stepType }) {
  const meta = STEP_TYPE_META[stepType] || { label: stepType, cls: "bg-gray-100 text-gray-600" };
  return <span className={cn("badge", meta.cls)}>{meta.label}</span>;
}

// ── Step status badge ─────────────────────────────────────────────────────────
export function StepStatusBadge({ status }) {
  const meta = STEP_STATUS_META[status] || { label: status, cls: "bg-gray-100 text-gray-600" };
  return <span className={cn("badge", meta.cls)}>{meta.label}</span>;
}

// ── Risk flag chips ───────────────────────────────────────────────────────────
export function RiskFlagChips({ flags = [] }) {
  if (!flags || flags.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1 mt-1">
      {flags.map(flag => {
        const meta = RISK_FLAG_META[flag] || { label: flag, cls: "bg-gray-100 text-gray-500" };
        return (
          <span key={flag} className={cn("inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium", meta.cls)}>
            <AlertTriangle size={10} />
            {meta.label}
          </span>
        );
      })}
    </div>
  );
}

// ── Discrepancy flag pill ──────────────────────────────────────────────────────
export function DiscrepancyBadge({ flagged, pct }) {
  if (!flagged) return null;
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-800">
      <AlertTriangle size={10} /> Discrepancy {pct != null ? `${pct}%` : ""}
    </span>
  );
}

// ── Stat card ─────────────────────────────────────────────────────────────────
export function StatCard({ label, value, sub, icon: Icon, color = "blue", alert }) {
  const colors = {
    blue:   "bg-brand-blue-50 text-brand-blue",
    red:    "bg-brand-red-50 text-brand-red",
    green:  "bg-green-50 text-green-600",
    yellow: "bg-yellow-50 text-yellow-600",
    gray:   "bg-gray-100 text-gray-500",
    purple: "bg-purple-50 text-purple-600",
    orange: "bg-orange-50 text-orange-600",
    teal:   "bg-teal-50 text-teal-600",
  };
  return (
    <div className={cn("card flex items-start gap-4", alert && "border-brand-red ring-1 ring-brand-red")}>
      {Icon && (
        <div className={cn("p-2.5 rounded-lg flex-shrink-0", colors[color])}>
          <Icon size={20} />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">{label}</p>
        <p className="text-2xl font-bold text-gray-900 mt-0.5">{value}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
      {alert && <AlertTriangle size={16} className="text-brand-red flex-shrink-0 mt-1" />}
    </div>
  );
}

// ── Loading spinner ────────────────────────────────────────────────────────────
export function Loading({ text = "Loading..." }) {
  return (
    <div className="flex items-center justify-center py-16">
      <Loader2 className="animate-spin text-brand-blue mr-2" size={22} />
      <span className="text-gray-500 text-sm">{text}</span>
    </div>
  );
}

// ── Empty state ────────────────────────────────────────────────────────────────
export function EmptyState({ message = "No data found", icon: Icon = AlertCircle }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-gray-400">
      <Icon size={40} className="mb-3 opacity-40" />
      <p className="text-sm">{message}</p>
    </div>
  );
}

// ── Pagination ────────────────────────────────────────────────────────────────
export function Pagination({ page, pages, total, onPage }) {
  if (pages <= 1) return null;
  return (
    <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
      <p className="text-xs text-gray-500">Page {page} of {pages} · {total} total</p>
      <div className="flex gap-1">
        <button disabled={page <= 1} onClick={() => onPage(page - 1)}
          className="p-1.5 rounded hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed">
          <ChevronLeft size={16} />
        </button>
        <button disabled={page >= pages} onClick={() => onPage(page + 1)}
          className="p-1.5 rounded hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed">
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}

// ── Page header ───────────────────────────────────────────────────────────────
export function PageHeader({ title, subtitle, actions }) {
  return (
    <div className="flex items-start justify-between mb-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">{title}</h1>
        {subtitle && <p className="text-sm text-gray-500 mt-0.5">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

// ── Modal ─────────────────────────────────────────────────────────────────────
export function Modal({ open, onClose, title, children, footer, wide }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className={cn(
        "relative bg-white rounded-xl shadow-2xl mx-4 max-h-[92vh] overflow-y-auto",
        wide ? "w-full max-w-2xl" : "w-full max-w-lg",
      )}>
        <div className="flex items-center justify-between px-6 py-4 border-b sticky top-0 bg-white z-10">
          <h3 className="text-base font-semibold text-gray-900">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none w-7 h-7 flex items-center justify-center">×</button>
        </div>
        <div className="px-6 py-4">{children}</div>
        {footer && <div className="px-6 py-4 border-t bg-gray-50 rounded-b-xl sticky bottom-0">{footer}</div>}
      </div>
    </div>
  );
}
