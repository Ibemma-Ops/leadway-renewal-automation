import { useState, useEffect } from "react";
import { approvalsAPI } from "../services/api";
import {
  RenewalStatusBadge, StepTypeBadge, StepStatusBadge,
  RiskFlagChips, DiscrepancyBadge, Loading, EmptyState,
  PageHeader, Modal,
} from "../components/common";
import {
  CheckCircle, XCircle, Clock, AlertTriangle, Loader2,
  RefreshCw, ShieldAlert, Building2, AlertOctagon,
} from "lucide-react";
import {
  formatCurrency, formatPct, formatDate, COR_COLOR, cn,
  STEP_TYPE_META, ROLE_ACTIONABLE_STEPS,
} from "../utils/helpers";
import toast from "react-hot-toast";
import { useAuth } from "../hooks/useAuth";

// ─── Approval matrix reference ────────────────────────────────────────────────
const APPROVAL_MATRIX = [
  { cor: "< 80%",              route: "COR < 80%",                   steps: ["Sales Confirmation"],                                  note: "Automated; Sales Officer confirms dispatch only" },
  { cor: "80% – 114%",         route: "80–114% Band",                 steps: ["Sales Confirmation"],                                  note: "Sales Officer confirmation required" },
  { cor: "115% – 140%",        route: "115–140% Band",                steps: ["Sales Confirmation", "Underwriter Approval"],           note: "Sales Officer + Underwriter joint sign-off" },
  { cor: "> 140%",             route: "> 140% Standard",              steps: ["HBD Approval"],                                         note: "Head of Business Development approval" },
  { cor: "> 140% + custom",    route: "> 140% Customised",            steps: ["HBD Approval", "MD/CEO Concurrence"],                   note: "HBD approval AND MD/CEO concurrence" },
  { cor: "Anti-selection",     route: "Anti-selection / Adopted",     steps: ["UW Acknowledgement", "Sales Confirmation"],             note: "Underwriter must acknowledge and document concession rationale" },
  { cor: "TPA",                route: "TPA Segment",                  steps: ["TPA Desk"],                                             note: "Removed from automated pipeline; routed to TPA desk" },
];

// ─── Step action modal ────────────────────────────────────────────────────────
function StepActionModal({ step, open, onClose, onDone }) {
  const [action,    setAction]    = useState("APPROVE");
  const [comments,  setComments]  = useState("");
  const [rationale, setRationale] = useState("");
  const [loading,   setLoading]   = useState(false);

  // reset on open
  useEffect(() => { if (open) { setAction("APPROVE"); setComments(""); setRationale(""); } }, [open]);

  const isAck = step?.step_type === "UNDERWRITER_ACKNOWLEDGEMENT";

  const handleSubmit = async () => {
    if (action === "REJECT" && !comments.trim()) {
      toast.error("Comments are required when rejecting"); return;
    }
    if (action === "ACKNOWLEDGE" && !rationale.trim()) {
      toast.error("Concession rationale is required for Underwriter acknowledgement"); return;
    }
    setLoading(true);
    try {
      await approvalsAPI.action(step.id, {
        action,
        comments:              comments || undefined,
        concession_rationale:  action === "ACKNOWLEDGE" ? rationale : undefined,
      });
      toast.success(
        action === "APPROVE"     ? "Step approved — chain advanced" :
        action === "ACKNOWLEDGE" ? "Underwriter acknowledgement recorded" :
        "Step rejected — policy marked REJECTED"
      );
      onDone(); onClose();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Action failed");
    } finally { setLoading(false); }
  };

  if (!step) return null;
  const p = step.policy;

  return (
    <Modal open={open} onClose={onClose} title="Action Approval Step" wide
      footer={
        <div className="flex gap-2 justify-end flex-wrap">
          <button onClick={onClose} className="btn-ghost text-xs">Cancel</button>
          <button onClick={handleSubmit} disabled={loading}
            className={cn("text-xs inline-flex items-center gap-1.5 px-4 py-2 rounded-lg font-medium transition-colors",
              action === "REJECT"
                ? "bg-brand-red hover:bg-red-700 text-white"
                : "bg-green-600 hover:bg-green-700 text-white")}>
            {loading ? <Loader2 size={13} className="animate-spin" /> :
              action === "REJECT" ? <XCircle size={13} /> : <CheckCircle size={13} />}
            {action === "APPROVE" ? "Approve" : action === "ACKNOWLEDGE" ? "Acknowledge & Proceed" : "Reject"}
          </button>
        </div>
      }
    >
      <div className="space-y-4 text-sm">

        {/* Step details */}
        <div className="bg-gray-50 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <StepTypeBadge stepType={step.step_type} />
            <StepStatusBadge status={step.status} />
            <span className="text-xs text-gray-400">Step {step.step_order}</span>
          </div>

          {/* Special notice for acknowledgement steps */}
          {isAck && (
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 mb-3">
              <p className="text-xs font-semibold text-orange-800 flex items-center gap-1.5">
                <ShieldAlert size={13} /> Underwriter Acknowledgement Required
              </p>
              <p className="text-xs text-orange-700 mt-1">
                This policy has been flagged for anti-selection or adopted enrollee cohort risk.
                You must document your concession rationale before the renewal chain can proceed.
                This action is recorded permanently in the audit log.
              </p>
            </div>
          )}

          {/* Policy summary */}
          {p && (
            <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs">
              <div><p className="text-gray-400">Company</p><p className="font-semibold text-gray-800">{p.company_name}</p></div>
              <div><p className="text-gray-400">Policy #</p><p className="font-medium">{p.policy_number}</p></div>
              <div><p className="text-gray-400">Segment</p><p className="font-medium">{p.segment}</p></div>
              <div><p className="text-gray-400">Renewal Date</p><p className="font-medium">{formatDate(p.end_date)}</p></div>
              <div>
                <p className="text-gray-400">COR</p>
                <p className={cn("font-bold text-base", COR_COLOR((p.cor || 0) * 100))}>
                  {formatPct((p.cor || 0) * 100)}
                </p>
              </div>
              <div>
                <p className="text-gray-400">Renewal Premium</p>
                <p className="font-bold text-brand-blue text-base">{formatCurrency(p.renewal_premium)}</p>
              </div>
              <div className="col-span-2">
                <p className="text-gray-400">Rate Band</p>
                <p className="font-medium text-gray-700">{p.rate_band || "—"}</p>
              </div>
              {p.discrepancy_flagged && (
                <div className="col-span-2">
                  <DiscrepancyBadge flagged pct={p.lr_cor_discrepancy_pct} />
                </div>
              )}
              {(p.risk_flags || []).length > 0 && (
                <div className="col-span-2"><RiskFlagChips flags={p.risk_flags} /></div>
              )}
            </div>
          )}
        </div>

        {/* Action selector */}
        {isAck ? (
          <input type="hidden" value="ACKNOWLEDGE" onChange={() => setAction("ACKNOWLEDGE")} />
        ) : (
          <div>
            <p className="text-xs font-medium text-gray-700 mb-2">Your Decision</p>
            <div className="flex gap-2">
              {["APPROVE","REJECT"].map(a => (
                <button key={a} onClick={() => setAction(a)}
                  className={cn("flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-semibold border-2 transition-all",
                    action === a
                      ? a === "APPROVE" ? "border-green-500 bg-green-50 text-green-700" : "border-red-500 bg-red-50 text-red-700"
                      : "border-gray-200 text-gray-400 hover:border-gray-300")}>
                  {a === "APPROVE" ? <CheckCircle size={14} /> : <XCircle size={14} />}
                  {a === "APPROVE" ? "Approve" : "Reject"}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Concession rationale — only for acknowledgement */}
        {isAck && (
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1.5">
              Concession Rationale <span className="text-red-500">*</span>
              <span className="text-gray-400 font-normal ml-1">(permanently recorded in audit log)</span>
            </label>
            <textarea className="input resize-none text-xs" rows={4}
              placeholder="Document your reasoning for proceeding with this anti-selection or adopted enrollee case..."
              value={rationale} onChange={e => setRationale(e.target.value)} />
          </div>
        )}

        {/* Comments */}
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1.5">
            Comments {action === "REJECT" && <span className="text-red-500">*</span>}
          </label>
          <textarea className="input resize-none text-xs" rows={2}
            placeholder={action === "REJECT" ? "Reason for rejection (required)..." : "Optional notes..."}
            value={comments} onChange={e => setComments(e.target.value)} />
        </div>
      </div>
    </Modal>
  );
}

// ─── TPA Queue tab ────────────────────────────────────────────────────────────
function TPAQueuePanel() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    approvalsAPI.tpaQueue()
      .then(r => setData(r.data))
      .catch(() => toast.error("Failed to load TPA queue"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Loading />;
  if (!data.length) return (
    <div className="card">
      <EmptyState message="No TPA policies in queue" icon={Building2} />
    </div>
  );
  return (
    <div className="card p-0 overflow-hidden">
      <div className="px-5 py-3 border-b bg-teal-50">
        <p className="text-sm font-semibold text-teal-800">
          TPA Desk Queue — {data.length} scheme{data.length !== 1 ? "s" : ""} routed
        </p>
        <p className="text-xs text-teal-600 mt-0.5">
          These schemes have been removed from the automated renewal pipeline and require manual TPA desk processing.
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[700px]">
          <thead>
            <tr className="border-b border-gray-100">
              <th className="table-th">Company</th>
              <th className="table-th">Policy #</th>
              <th className="table-th text-right">Current Premium</th>
              <th className="table-th">Renewal Date</th>
              <th className="table-th">Days Left</th>
              <th className="table-th">Status</th>
            </tr>
          </thead>
          <tbody>
            {data.map(p => (
              <tr key={p.id} className="border-b border-gray-50 hover:bg-gray-50">
                <td className="table-td font-medium">{p.company_name}</td>
                <td className="table-td font-mono text-xs text-gray-500">{p.policy_number}</td>
                <td className="table-td text-right">{formatCurrency(p.current_premium)}</td>
                <td className="table-td text-xs">{formatDate(p.end_date)}</td>
                <td className="table-td">
                  {p.days_to_renewal != null && (
                    <span className={cn("text-xs font-semibold",
                      p.days_to_renewal <= 7 ? "text-brand-red" :
                      p.days_to_renewal <= 30 ? "text-yellow-600" : "text-gray-500")}>
                      {p.days_to_renewal < 0 ? "Expired" : `${p.days_to_renewal}d`}
                    </span>
                  )}
                </td>
                <td className="table-td"><RenewalStatusBadge status={p.renewal_status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function ApprovalsPage() {
  const { user } = useAuth();
  const [steps,      setSteps]     = useState([]);
  const [summary,    setSummary]   = useState({});
  const [atRisk,     setAtRisk]    = useState([]);
  const [loading,    setLoading]   = useState(true);
  const [stepFilter, setStepFilter] = useState("");
  const [selected,   setSelected]  = useState(null);
  const [tab,        setTab]       = useState("queue"); // queue | tpa | matrix

  const load = async () => {
    setLoading(true);
    try {
      const params = {};
      if (stepFilter) params.step_status = stepFilter;
      const [sRes, sumRes, arRes] = await Promise.all([
        approvalsAPI.list(params),
        approvalsAPI.summary(),
        approvalsAPI.pendingAtRisk(7),
      ]);
      setSteps(sRes.data);
      setSummary(sumRes.data);
      setAtRisk(arRes.data);
    } catch { toast.error("Failed to load approvals"); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [stepFilter]);

  // Total pending steps for this user's role
  const myRole = user?.role;
  const myPending = steps.filter(s => s.status === "PENDING" &&
    (ROLE_ACTIONABLE_STEPS[myRole] || []).includes(s.step_type)).length;

  const canAct = (step) =>
    step.status === "PENDING" &&
    (myRole === "ADMIN" || (ROLE_ACTIONABLE_STEPS[myRole] || []).includes(step.step_type));

  const totalPending = Object.values(summary).reduce(
    (acc, byType) => acc + Object.values(byType).reduce((a,b) => a + b, 0), 0
  );

  return (
    <div className="p-6 space-y-5">
      <PageHeader title="Approval Workflow Queue" subtitle="MRAS spec-exact approval chain enforcement"
        actions={<button onClick={load} className="btn-ghost text-xs gap-1.5"><RefreshCw size={14} /> Refresh</button>}
      />

      {/* At-risk alert */}
      {atRisk.length > 0 && (
        <div className="flex items-start gap-4 bg-red-50 border-2 border-brand-red rounded-xl p-4">
          <div className="p-2.5 bg-brand-red rounded-lg flex-shrink-0">
            <AlertOctagon size={20} className="text-white" />
          </div>
          <div>
            <p className="text-sm font-bold text-brand-red">
              {atRisk.length} scheme{atRisk.length > 1 ? "s" : ""} still awaiting approval — renewal within 7 days
            </p>
            <div className="flex flex-wrap gap-2 mt-2">
              {atRisk.map(p => (
                <span key={p.id} className="text-xs bg-white border border-red-200 text-red-700 rounded-lg px-2 py-0.5 font-medium">
                  {p.company_name} · {p.days_to_renewal}d
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Summary pills */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { label: "All Pending",      count: totalPending,                        cls: "bg-yellow-50 border-yellow-200 text-yellow-800" },
          { label: "Sales Queue",      count: summary.SALES_OFFICER?.SALES_CONFIRMATION || 0, cls: "bg-yellow-50 border-yellow-200 text-yellow-700" },
          { label: "Underwriter",      count: (summary.UNDERWRITER?.UNDERWRITER_APPROVAL || 0) + (summary.UNDERWRITER?.UNDERWRITER_ACKNOWLEDGEMENT || 0),
                                               cls: "bg-blue-50 border-blue-200 text-blue-700" },
          { label: "HBD",              count: summary.HBD?.HBD_APPROVAL || 0,      cls: "bg-purple-50 border-purple-200 text-purple-700" },
          { label: "MD/CEO",           count: summary.MD_CEO?.MD_CEO_CONCURRENCE || 0, cls: "bg-indigo-50 border-indigo-200 text-indigo-700" },
        ].map(({ label, count, cls }) => (
          <div key={label} className={cn("rounded-xl border p-4 flex items-center justify-between", cls.split(" ").slice(0,2).join(" "))}>
            <p className="text-xs font-medium text-gray-700">{label}</p>
            <span className={cn("text-xl font-bold", cls.split(" ")[2])}>{count}</span>
          </div>
        ))}
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        {[
          { key: "queue",  label: `Approval Queue${myPending > 0 ? ` (${myPending})` : ""}` },
          { key: "tpa",    label: "TPA Desk" },
          { key: "matrix", label: "Approval Matrix" },
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={cn("px-4 py-1.5 rounded-lg text-xs font-medium transition-all",
              tab === t.key ? "bg-white shadow text-brand-blue" : "text-gray-500 hover:text-gray-700")}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Tab: Approval Queue ── */}
      {tab === "queue" && (
        <>
          <div className="flex items-center gap-3">
            <select className="select text-xs w-44" value={stepFilter} onChange={e => setStepFilter(e.target.value)}>
              <option value="">All Statuses</option>
              <option value="PENDING">Pending</option>
              <option value="APPROVED">Approved</option>
              <option value="ACKNOWLEDGED">Acknowledged</option>
              <option value="REJECTED">Rejected</option>
            </select>
            <p className="text-xs text-gray-400">{steps.length} step{steps.length !== 1 ? "s" : ""}</p>
          </div>

          {loading ? <Loading /> : steps.length === 0 ? (
            <div className="card"><EmptyState message="No approval steps in queue" icon={CheckCircle} /></div>
          ) : (
            <div className="space-y-3">
              {steps.map(step => {
                const p = step.policy;
                const actionable = canAct(step);
                const isAck = step.step_type === "UNDERWRITER_ACKNOWLEDGEMENT";

                return (
                  <div key={step.id} className={cn(
                    "card flex items-start gap-4 p-5 transition-all",
                    step.status === "PENDING"      && "border-l-4 border-l-yellow-400",
                    step.status === "APPROVED"     && "border-l-4 border-l-green-400 opacity-80",
                    step.status === "ACKNOWLEDGED" && "border-l-4 border-l-blue-400 opacity-80",
                    step.status === "REJECTED"     && "border-l-4 border-l-red-400 opacity-70",
                  )}>
                    {/* Icon */}
                    <div className={cn("p-2.5 rounded-lg flex-shrink-0",
                      step.status === "PENDING"      ? isAck ? "bg-orange-100" : "bg-yellow-100"
                      : step.status === "APPROVED"   ? "bg-green-100"
                      : step.status === "ACKNOWLEDGED" ? "bg-blue-100"
                      : "bg-red-100")}>
                      {step.status === "PENDING"       ? isAck ? <ShieldAlert size={18} className="text-orange-600" /> : <Clock size={18} className="text-yellow-600" /> :
                       step.status === "APPROVED"      ? <CheckCircle size={18} className="text-green-600" /> :
                       step.status === "ACKNOWLEDGED"  ? <CheckCircle size={18} className="text-blue-600" /> :
                       <XCircle size={18} className="text-red-600" />}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-3 flex-wrap">
                        <div>
                          <p className="font-semibold text-gray-900">{p?.company_name || `Policy #${step.policy_id}`}</p>
                          <p className="text-xs text-gray-400 mt-0.5">
                            {p?.policy_number} · {p?.segment}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <StepTypeBadge stepType={step.step_type} />
                          <StepStatusBadge status={step.status} />
                          <span className="text-xs text-gray-400">Step {step.step_order}</span>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3 text-xs">
                        <div>
                          <p className="text-gray-400">COR</p>
                          <p className={cn("font-bold text-sm", COR_COLOR((p?.cor || 0) * 100))}>
                            {formatPct((p?.cor || 0) * 100)}
                          </p>
                        </div>
                        <div>
                          <p className="text-gray-400">Renewal Premium</p>
                          <p className="font-bold text-brand-blue text-sm">{formatCurrency(p?.renewal_premium)}</p>
                        </div>
                        <div>
                          <p className="text-gray-400">Rate Band</p>
                          <p className="font-medium text-gray-700 text-xs leading-tight">{p?.rate_band?.split("—")[0]?.trim() || "—"}</p>
                        </div>
                        <div>
                          <p className="text-gray-400">Renewal Date</p>
                          <p className="font-medium text-gray-700">{formatDate(p?.end_date)}</p>
                          {p?.days_to_renewal != null && (
                            <p className={cn("text-xs font-semibold",
                              p.days_to_renewal <= 7 ? "text-brand-red" :
                              p.days_to_renewal <= 30 ? "text-yellow-600" : "text-gray-400")}>
                              {p.days_to_renewal < 0 ? "Expired" : `${p.days_to_renewal}d left`}
                            </p>
                          )}
                        </div>
                      </div>

                      {p?.discrepancy_flagged && (
                        <div className="mt-2">
                          <DiscrepancyBadge flagged pct={p.lr_cor_discrepancy_pct} />
                        </div>
                      )}
                      {(p?.risk_flags || []).length > 0 && (
                        <RiskFlagChips flags={p.risk_flags} />
                      )}
                      {step.comments && (
                        <div className="mt-2 bg-gray-50 rounded-lg px-3 py-2">
                          <p className="text-xs text-gray-400">Comments</p>
                          <p className="text-xs text-gray-700 mt-0.5">{step.comments}</p>
                        </div>
                      )}
                      {step.concession_rationale && (
                        <div className="mt-2 bg-orange-50 border border-orange-100 rounded-lg px-3 py-2">
                          <p className="text-xs text-orange-600 font-medium">Concession Rationale (UW)</p>
                          <p className="text-xs text-orange-700 mt-0.5">{step.concession_rationale}</p>
                        </div>
                      )}
                    </div>

                    {actionable && (
                      <button onClick={() => setSelected(step)} className="btn-primary text-xs flex-shrink-0">
                        {isAck ? "Acknowledge" : "Review"}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ── Tab: TPA Queue ── */}
      {tab === "tpa" && <TPAQueuePanel />}

      {/* ── Tab: Approval Matrix Reference ── */}
      {tab === "matrix" && (
        <div className="card p-0 overflow-hidden">
          <div className="px-5 py-3 border-b bg-brand-blue-50">
            <p className="text-sm font-semibold text-brand-blue">MRAS Approval Matrix — Specification Reference</p>
            <p className="text-xs text-gray-500 mt-0.5">
              All approval chains are enforced server-side. No bypass is possible through the UI or API.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[700px]">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="table-th">COR Scenario</th>
                  <th className="table-th">Route</th>
                  <th className="table-th">Required Steps (in order)</th>
                  <th className="table-th">Notes</th>
                </tr>
              </thead>
              <tbody>
                {APPROVAL_MATRIX.map((row, i) => (
                  <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="table-td font-semibold text-brand-blue">{row.cor}</td>
                    <td className="table-td text-gray-600">{row.route}</td>
                    <td className="table-td">
                      <div className="flex flex-wrap gap-1">
                        {row.steps.map((s, j) => (
                          <span key={j} className="bg-brand-blue-50 text-brand-blue text-xs px-2 py-0.5 rounded font-medium">{s}</span>
                        ))}
                      </div>
                    </td>
                    <td className="table-td text-xs text-gray-500">{row.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-5 py-3 bg-yellow-50 border-t border-yellow-100">
            <p className="text-xs font-semibold text-yellow-800">
              ⚠ Notice Generation Rule: No renewal notice is generated or dispatched until all required approval steps are APPROVED/ACKNOWLEDGED.
            </p>
          </div>
        </div>
      )}

      <StepActionModal
        step={selected}
        open={!!selected}
        onClose={() => setSelected(null)}
        onDone={load}
      />
    </div>
  );
}
