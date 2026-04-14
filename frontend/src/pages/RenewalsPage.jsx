import { useState, useEffect, useCallback } from "react";
import { policiesAPI } from "../services/api";
import {
  RenewalStatusBadge, RiskFlagChips, DiscrepancyBadge,
  Loading, EmptyState, Pagination, PageHeader, Modal, StepTypeBadge, StepStatusBadge,
} from "../components/common";
import {
  Search, Download, FileText, Mail, Eye, Loader2, RefreshCw,
  CheckCircle, AlertTriangle, ShieldAlert,
} from "lucide-react";
import {
  formatCurrency, formatPct, formatDate, formatDateTime,
  COR_COLOR, cn, downloadBlob, canGenerateDoc, canDispatchEmail,
  RENEWAL_STATUS_META,
} from "../utils/helpers";
import toast from "react-hot-toast";
import { useAuth } from "../hooks/useAuth";

const SEGMENTS = ["", "CORPORATE", "RETAIL", "TPA"];
const STATUSES  = Object.keys(RENEWAL_STATUS_META);
const TRIGGERS  = ["D-60", "D-30", "D-7", "D-0"];
const RISK_FLAGS = [
  { value: "", label: "Any Risk Flag" },
  { value: "HIGH_COR",                label: "High COR" },
  { value: "ANTI_SELECTION",          label: "Anti-Selection" },
  { value: "ADOPTED_ENROLLEE_COHORT", label: "Adopted Enrollee" },
  { value: "LR_COR_DISCREPANCY",      label: "LR/COR Discrepancy" },
  { value: "PRO_RATA_REVIEW",         label: "Pro-rata Review" },
  { value: "TPA_REFERRAL",            label: "TPA Referral" },
];

// ─── Policy Detail Modal ──────────────────────────────────────────────────────
function PolicyDetailModal({ policy: p, open, onClose, onRefresh }) {
  const { user } = useAuth();
  const [busy, setBusy] = useState("");

  const run = async (key, fn, successMsg) => {
    setBusy(key);
    try { await fn(); toast.success(successMsg); onRefresh(); }
    catch (e) { toast.error(e.response?.data?.detail || "Action failed"); }
    finally { setBusy(""); }
  };

  if (!p) return null;
  const corPct = (p.cor || 0) * 100;
  const lrPct  = (p.lr  || 0) * 100;
  const docOk  = canGenerateDoc(p.renewal_status);
  const mailOk = canDispatchEmail(p.renewal_status);

  // Build approval chain status from approval_workflows if present
  const steps = p.approval_workflows || [];

  return (
    <Modal open={open} onClose={onClose} title={`Policy: ${p.policy_number}`} wide
      footer={
        <div className="flex flex-wrap gap-2">
          {docOk ? (
            <>
              <button onClick={() => run("doc", () => policiesAPI.generateDoc(p.id), "Document generated")}
                className="btn-primary text-xs" disabled={!!busy}>
                {busy === "doc" ? <Loader2 size={13} className="animate-spin" /> : <FileText size={13} />} Generate Notice
              </button>
              {p.document_path && (
                <button onClick={() => run("dl-docx", async () => { const r = await policiesAPI.downloadDoc(p.id,"docx"); downloadBlob(r.data,`renewal_${p.policy_number}.docx`); }, "Downloaded")}
                  className="btn-outline text-xs" disabled={!!busy}>
                  <Download size={13} /> DOCX
                </button>
              )}
              {p.pdf_path && (
                <button onClick={() => run("dl-pdf", async () => { const r = await policiesAPI.downloadDoc(p.id,"pdf"); downloadBlob(r.data,`renewal_${p.policy_number}.pdf`); }, "Downloaded")}
                  className="btn-outline text-xs" disabled={!!busy}>
                  <Download size={13} /> PDF
                </button>
              )}
            </>
          ) : (
            <span className="text-xs text-gray-400 italic flex items-center gap-1">
              <ShieldAlert size={12} /> Document generation locked until policy is APPROVED
            </span>
          )}
          {mailOk && TRIGGERS.map(t => (
            <button key={t} onClick={() => run(`email-${t}`, () => policiesAPI.triggerEmail(p.id, t), `Email queued: ${t}`)}
              className="btn-ghost text-xs" disabled={!!busy}>
              <Mail size={13} /> {t}
            </button>
          ))}
        </div>
      }
    >
      <div className="space-y-4 text-sm">
        {/* Status row */}
        <div className="flex flex-wrap items-center gap-2">
          <RenewalStatusBadge status={p.renewal_status} />
          <span className={cn("badge", p.segment === "TPA" ? "bg-teal-100 text-teal-800" : p.segment === "CORPORATE" ? "bg-brand-blue-50 text-brand-blue" : "bg-gray-100 text-gray-600")}>
            {p.segment}
          </span>
          {p.is_pro_rata && <span className="badge bg-yellow-100 text-yellow-700">Pro-rata ({p.policy_months?.toFixed(1)}m)</span>}
          {p.discrepancy_flagged && <DiscrepancyBadge flagged pct={p.lr_cor_discrepancy_pct} />}
        </div>
        {(p.risk_flags || []).length > 0 && <RiskFlagChips flags={p.risk_flags} />}

        {/* Core fields */}
        <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-xs">
          {[
            ["Company",       p.company_name],
            ["Sector",        p.business_sector || "—"],
            ["Scheme Ref",    p.scheme_ref || "—"],
            ["Lives",         p.no_of_lives || "—"],
            ["Contact",       p.contact_name || "—"],
            ["Email",         p.contact_email || "—"],
            ["Phone",         p.phone || "—"],
            ["Start Date",    formatDate(p.start_date)],
            ["End Date",      formatDate(p.end_date)],
            ["Days to Renewal", p.days_to_renewal != null ? `${p.days_to_renewal}d` : "—"],
          ].map(([l, v]) => (
            <div key={l}><p className="text-gray-400">{l}</p><p className="font-medium text-gray-800 break-words">{v}</p></div>
          ))}
        </div>

        {/* Metrics */}
        <div className="bg-gray-50 rounded-xl p-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Metrics & Rate</p>
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <p className="text-gray-400">Current Premium</p>
              <p className="font-semibold">{formatCurrency(p.current_premium)}</p>
            </div>
            <div>
              <p className="text-gray-400">Total Claims</p>
              <p className="font-semibold">{formatCurrency(p.total_claims)}</p>
            </div>
            <div>
              <p className="text-gray-400">Earned Premium</p>
              <p className="font-semibold">{formatCurrency(p.earned_premium || p.total_premium)}</p>
            </div>
            <div>
              <p className="text-gray-400">Loss Ratio (LR)</p>
              <p className={cn("font-bold text-base", COR_COLOR(lrPct))}>{formatPct(lrPct)}</p>
            </div>
            <div>
              <p className="text-gray-400">COR</p>
              <p className={cn("font-bold text-base", COR_COLOR(corPct))}>{formatPct(corPct)}</p>
            </div>
            {p.workbook_lr != null && (
              <div>
                <p className="text-gray-400">Workbook LR</p>
                <p className={cn("font-semibold", p.discrepancy_flagged ? "text-rose-600" : "text-gray-700")}>
                  {formatPct(p.workbook_lr * 100)}
                  {p.discrepancy_flagged && " ⚠"}
                </p>
              </div>
            )}
            <div>
              <p className="text-gray-400">Rate Band</p>
              <p className="font-medium text-gray-700 text-xs leading-tight">{p.rate_band || "—"}</p>
            </div>
            <div>
              <p className="text-gray-400">Rate Adjustment</p>
              <p className="font-semibold text-brand-blue">{p.renewal_rate != null ? `${p.renewal_rate}%` : "—"}</p>
            </div>
            <div className="col-span-2">
              <p className="text-gray-400">Renewal Premium</p>
              <p className="text-xl font-bold text-brand-blue">{formatCurrency(p.renewal_premium)}</p>
            </div>
          </div>
        </div>

        {/* Approval chain */}
        {p.approval_route && p.approval_route !== "TPA_DESK" && (
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Approval Chain</p>
            <p className="text-xs text-gray-500 mb-2">Route: <span className="font-medium text-gray-700">{p.approval_route}</span></p>
            <div className="grid grid-cols-2 gap-2 text-xs">
              {[
                ["Sales Confirmed",   p.sales_confirmed_at],
                ["UW Approved",       p.underwriter_approved_at],
                ["HBD Approved",      p.hbd_approved_at],
                ["MD/CEO Concurred",  p.md_ceo_approved_at],
                ["Notice Dispatched", p.notice_dispatched_at],
              ].filter(([, v]) => v).map(([l, v]) => (
                <div key={l} className="bg-green-50 rounded-lg p-2">
                  <p className="text-green-700 font-medium">{l}</p>
                  <p className="text-green-600">{formatDateTime(v)}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Email tracking */}
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Email Dispatch Status</p>
          <div className="grid grid-cols-4 gap-2">
            {["D-60","D-30","D-7","D-0"].map((d, i) => {
              const sent = [p.email_d60_sent, p.email_d30_sent, p.email_d7_sent, p.email_d0_sent][i];
              const ts   = [p.email_d60_sent_at, p.email_d30_sent_at, p.email_d7_sent_at, p.email_d0_sent_at][i];
              return (
                <div key={d} className={cn("rounded-lg p-2 text-center text-xs font-semibold",
                  sent ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-400")}>
                  {d}<br />{sent ? "✓" : "—"}
                  {sent && ts && <p className="text-xs font-normal opacity-70">{formatDate(ts)}</p>}
                </div>
              );
            })}
          </div>
          {!mailOk && (
            <p className="text-xs text-gray-400 mt-2 italic">
              Email dispatch available once policy status is APPROVED.
            </p>
          )}
        </div>
      </div>
    </Modal>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function RenewalsPage() {
  const [data,      setData]      = useState({ items: [], total: 0, pages: 1 });
  const [page,      setPage]      = useState(1);
  const [filters,   setFilters]   = useState({
    search: "", renewal_status: "", segment: "",
    discrepancy_flagged: "", has_risk_flag: "",
  });
  const [loading,   setLoading]   = useState(true);
  const [selected,  setSelected]  = useState(null);
  const [exporting, setExporting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, page_size: 25 };
      if (filters.search)              params.search               = filters.search;
      if (filters.renewal_status)      params.renewal_status       = filters.renewal_status;
      if (filters.segment)             params.segment              = filters.segment;
      if (filters.discrepancy_flagged) params.discrepancy_flagged  = filters.discrepancy_flagged === "true";
      if (filters.has_risk_flag)       params.has_risk_flag        = filters.has_risk_flag;
      const res = await policiesAPI.list(params);
      setData(res.data);
    } catch { toast.error("Failed to load policies"); }
    finally { setLoading(false); }
  }, [page, filters]);

  useEffect(() => { load(); }, [load]);

  const handleExport = async () => {
    setExporting(true);
    try {
      const res = await policiesAPI.exportCsv({
        renewal_status: filters.renewal_status || undefined,
        segment:        filters.segment || undefined,
      });
      downloadBlob(res.data, "mras_renewals_export.csv");
      toast.success("CSV exported");
    } catch { toast.error("Export failed"); }
    finally { setExporting(false); }
  };

  const setF = (k, v) => { setFilters(f => ({ ...f, [k]: v })); setPage(1); };

  return (
    <div className="p-6 space-y-5">
      <PageHeader
        title="Renewal Policies"
        subtitle={`${data.total} total schemes`}
        actions={
          <div className="flex gap-2">
            <button onClick={load} className="btn-ghost text-xs gap-1.5"><RefreshCw size={13} /> Refresh</button>
            <button onClick={handleExport} disabled={exporting} className="btn-outline text-xs gap-1.5">
              {exporting ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />} Export CSV
            </button>
          </div>
        }
      />

      {/* Filters */}
      <div className="card py-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input className="input pl-8 text-xs" placeholder="Company, policy #, scheme ref..."
              value={filters.search} onChange={e => setF("search", e.target.value)} />
          </div>
          <select className="select text-xs" value={filters.renewal_status} onChange={e => setF("renewal_status", e.target.value)}>
            <option value="">All Statuses</option>
            {STATUSES.map(s => <option key={s} value={s}>{RENEWAL_STATUS_META[s]?.label || s}</option>)}
          </select>
          <select className="select text-xs" value={filters.segment} onChange={e => setF("segment", e.target.value)}>
            <option value="">All Segments</option>
            {SEGMENTS.filter(Boolean).map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <select className="select text-xs" value={filters.discrepancy_flagged} onChange={e => setF("discrepancy_flagged", e.target.value)}>
            <option value="">All LR/COR</option>
            <option value="true">Discrepancy Flagged</option>
            <option value="false">No Discrepancy</option>
          </select>
          <select className="select text-xs" value={filters.has_risk_flag} onChange={e => setF("has_risk_flag", e.target.value)}>
            {RISK_FLAGS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[1000px]">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="table-th">Company</th>
                <th className="table-th">Policy #</th>
                <th className="table-th">Segment</th>
                <th className="table-th text-right">LR</th>
                <th className="table-th text-right">COR</th>
                <th className="table-th text-right">Renewal Premium</th>
                <th className="table-th">Renewal Date</th>
                <th className="table-th">Flags</th>
                <th className="table-th">Status</th>
                <th className="table-th"></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={10} className="py-12"><Loading /></td></tr>
              ) : data.items.length === 0 ? (
                <tr><td colSpan={10} className="py-12"><EmptyState message="No policies found" /></td></tr>
              ) : data.items.map(p => (
                <tr key={p.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                  <td className="table-td max-w-[160px]">
                    <p className="font-medium truncate">{p.company_name}</p>
                    {p.scheme_ref && <p className="text-xs text-gray-400">{p.scheme_ref}</p>}
                    {p.business_sector && <p className="text-xs text-gray-400 italic">{p.business_sector}</p>}
                  </td>
                  <td className="table-td font-mono text-xs text-gray-500">{p.policy_number}</td>
                  <td className="table-td">
                    <span className={cn("badge",
                      p.segment === "TPA" ? "bg-teal-100 text-teal-800"
                      : p.segment === "CORPORATE" ? "bg-brand-blue-50 text-brand-blue"
                      : "bg-gray-100 text-gray-700")}>
                      {p.segment}
                    </span>
                  </td>
                  <td className={cn("table-td text-right font-semibold",
                    p.segment === "TPA" ? "text-gray-400" : COR_COLOR((p.lr || 0) * 100))}>
                    {p.segment === "TPA" ? "N/A" : formatPct((p.lr || 0) * 100)}
                  </td>
                  <td className={cn("table-td text-right font-semibold",
                    p.segment === "TPA" ? "text-gray-400" : COR_COLOR((p.cor || 0) * 100))}>
                    {p.segment === "TPA" ? "N/A" : formatPct((p.cor || 0) * 100)}
                  </td>
                  <td className="table-td text-right font-semibold text-brand-blue">
                    {p.segment === "TPA" ? "—" : formatCurrency(p.renewal_premium)}
                  </td>
                  <td className="table-td">
                    <p className="text-xs">{formatDate(p.end_date)}</p>
                    {p.days_to_renewal != null && (
                      <p className={cn("text-xs font-semibold",
                        p.days_to_renewal <= 7  ? "text-brand-red"
                        : p.days_to_renewal <= 30 ? "text-yellow-600"
                        : "text-gray-400")}>
                        {p.days_to_renewal < 0 ? "Expired" : `${p.days_to_renewal}d`}
                      </p>
                    )}
                  </td>
                  <td className="table-td max-w-[120px]">
                    <div className="flex flex-wrap gap-0.5">
                      {p.discrepancy_flagged && (
                        <span className="inline-flex items-center gap-0.5 px-1 py-0.5 rounded text-xs bg-rose-100 text-rose-700">
                          <AlertTriangle size={9} /> Discrepancy
                        </span>
                      )}
                      {p.is_pro_rata && (
                        <span className="px-1 py-0.5 rounded text-xs bg-yellow-100 text-yellow-700">Pro-rata</span>
                      )}
                      {(p.risk_flags || []).filter(f => f !== "TPA_REFERRAL" && f !== "HIGH_COR").slice(0,1).map(f => (
                        <span key={f} className="px-1 py-0.5 rounded text-xs bg-orange-100 text-orange-700 truncate">
                          {f.replace(/_/g," ").slice(0,12)}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="table-td"><RenewalStatusBadge status={p.renewal_status} /></td>
                  <td className="table-td">
                    <button onClick={() => setSelected(p)}
                      className="p-1.5 rounded-lg hover:bg-brand-blue-50 text-gray-400 hover:text-brand-blue transition-colors">
                      <Eye size={15} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination page={page} pages={data.pages} total={data.total} onPage={setPage} />
      </div>

      <PolicyDetailModal
        policy={selected} open={!!selected}
        onClose={() => setSelected(null)} onRefresh={load}
      />
    </div>
  );
}
