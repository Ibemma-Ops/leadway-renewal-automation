import { useState, useEffect } from "react";
import { dashboardAPI } from "../services/api";
import { StatCard, Loading, PageHeader, RenewalStatusBadge, RiskFlagChips, DiscrepancyBadge } from "../components/common";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line,
} from "recharts";
import {
  FileText, AlertTriangle, CheckCircle, Send, Clock,
  TrendingUp, DollarSign, Calendar, RefreshCw, ShieldAlert,
  UserCheck, Building2, AlertOctagon,
} from "lucide-react";
import { formatCurrency, formatPct, COR_COLOR, cn, formatDate } from "../utils/helpers";
import toast from "react-hot-toast";

const PIE_COLORS = ["#002F6C","#E30613","#f59e0b","#10b981","#8b5cf6","#14b8a6","#6b7280"];

const ChartTip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-xs">
      <p className="font-semibold text-gray-700 mb-1">{label}</p>
      {payload.map((p, i) => <p key={i} style={{ color: p.color }}>{p.name}: {p.value}</p>)}
    </div>
  );
};

export default function DashboardPage() {
  const [stats,     setStats]     = useState(null);
  const [heatmap,   setHeatmap]   = useState([]);
  const [portfolio, setPortfolio] = useState([]);
  const [timeline,  setTimeline]  = useState([]);
  const [rateDist,  setRateDist]  = useState([]);
  const [riskFlags, setRiskFlags] = useState({});
  const [sectorLR,  setSectorLR]  = useState([]);
  const [loading,   setLoading]   = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const [s, h, p, t, r, rf, sl] = await Promise.all([
        dashboardAPI.stats(),
        dashboardAPI.heatmap(),
        dashboardAPI.portfolio(),
        dashboardAPI.timeline(),
        dashboardAPI.rateDistribution(),
        dashboardAPI.riskFlags(),
        dashboardAPI.sectorLR(),
      ]);
      setStats(s.data);
      setHeatmap(h.data.slice(0, 24));
      setPortfolio(p.data);
      setTimeline(t.data);
      setRateDist(r.data);
      setRiskFlags(rf.data);
      setSectorLR(sl.data);
    } catch { toast.error("Failed to load dashboard"); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  if (loading) return <div className="p-8"><Loading text="Loading dashboard..." /></div>;

  const totalPendingApproval =
    (stats?.awaiting_sales || 0) +
    (stats?.awaiting_underwriter || 0) +
    (stats?.awaiting_hbd || 0) +
    (stats?.awaiting_md_ceo || 0);

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Renewal Dashboard"
        subtitle={`Portfolio overview · ${new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}`}
        actions={
          <button onClick={load} className="btn-ghost text-xs gap-1.5">
            <RefreshCw size={14} /> Refresh
          </button>
        }
      />

      {/* ── Critical Alerts ── */}
      {(stats?.pending_at_risk_7d > 0 || stats?.discrepancy_flagged > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {stats.pending_at_risk_7d > 0 && (
            <div className="flex items-center gap-4 bg-red-50 border-2 border-red-300 rounded-xl p-4">
              <div className="p-2.5 bg-brand-red rounded-lg flex-shrink-0">
                <AlertOctagon size={20} className="text-white" />
              </div>
              <div>
                <p className="text-sm font-bold text-brand-red">
                  {stats.pending_at_risk_7d} {stats.pending_at_risk_7d === 1 ? "scheme" : "schemes"} still in approval chain — renew within 7 days
                </p>
                <p className="text-xs text-red-500 mt-0.5">Immediate action required to prevent lapse</p>
              </div>
            </div>
          )}
          {stats.discrepancy_flagged > 0 && (
            <div className="flex items-center gap-4 bg-rose-50 border border-rose-200 rounded-xl p-4">
              <div className="p-2.5 bg-rose-500 rounded-lg flex-shrink-0">
                <ShieldAlert size={20} className="text-white" />
              </div>
              <div>
                <p className="text-sm font-bold text-rose-700">
                  {stats.discrepancy_flagged} {stats.discrepancy_flagged === 1 ? "scheme has" : "schemes have"} LR/COR discrepancy &gt;1%
                </p>
                <p className="text-xs text-rose-500 mt-0.5">Flagged for Underwriter review before renewal proceeds</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── KPI Row 1: Volume ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Policies"         value={stats?.total_policies ?? 0}       icon={FileText}   color="blue" />
        <StatCard label="TPA Routed"             value={stats?.tpa_routed ?? 0}            icon={Building2}  color="teal"
                  sub="Excluded from auto pipeline" />
        <StatCard label="Approved"               value={stats?.approved ?? 0}              icon={CheckCircle} color="green" />
        <StatCard label="Notice Sent / Confirmed" value={(stats?.notice_sent ?? 0)}        icon={Send}       color="purple" />
      </div>

      {/* ── KPI Row 2: Approval pipeline ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Awaiting Sales"         value={stats?.awaiting_sales ?? 0}        icon={UserCheck}  color="yellow"
                  alert={stats?.awaiting_sales > 0} />
        <StatCard label="Awaiting Underwriter"   value={stats?.awaiting_underwriter ?? 0}  icon={ShieldAlert} color="orange"
                  alert={stats?.awaiting_underwriter > 0} />
        <StatCard label="Awaiting HBD"           value={stats?.awaiting_hbd ?? 0}          icon={TrendingUp}  color="purple" />
        <StatCard label="Awaiting MD/CEO"         value={stats?.awaiting_md_ceo ?? 0}       icon={TrendingUp}  color="blue" />
      </div>

      {/* ── KPI Row 3: Financial / risk ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Premium at Risk"        value={formatCurrency(stats?.total_premium_at_risk)} icon={DollarSign} color="blue"
                  sub="Pending approval schemes" />
        <StatCard label="Avg Loss Ratio"         value={`${stats?.avg_lr ?? 0}%`}           icon={TrendingUp}
                  color={stats?.avg_lr > 95 ? "red" : stats?.avg_lr > 80 ? "yellow" : "green"}
                  sub="Non-TPA portfolio" />
        <StatCard label="LR/COR Discrepancies"  value={stats?.discrepancy_flagged ?? 0}    icon={AlertTriangle} color="red" />
        <StatCard label="Lapsed / Rejected"      value={(stats?.lapsed ?? 0) + (stats?.rejected ?? 0)} icon={AlertOctagon} color="gray" />
      </div>

      {/* ── D-30 / D-7 urgency ── */}
      {(stats?.renewals_due_7_days > 0 || stats?.renewals_due_30_days > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {stats.renewals_due_7_days > 0 && (
            <div className="flex items-center gap-4 bg-red-50 border border-red-200 rounded-xl p-4">
              <div className="p-2.5 bg-brand-red rounded-lg flex-shrink-0">
                <Calendar size={20} className="text-white" />
              </div>
              <div>
                <p className="text-sm font-bold text-brand-red">{stats.renewals_due_7_days} schemes due within 7 days</p>
                <p className="text-xs text-red-500 mt-0.5">Check approval status immediately</p>
              </div>
            </div>
          )}
          {stats.renewals_due_30_days > 0 && (
            <div className="flex items-center gap-4 bg-yellow-50 border border-yellow-200 rounded-xl p-4">
              <div className="p-2.5 bg-yellow-500 rounded-lg flex-shrink-0">
                <Calendar size={20} className="text-white" />
              </div>
              <div>
                <p className="text-sm font-bold text-yellow-700">{stats.renewals_due_30_days} schemes due within 30 days</p>
                <p className="text-xs text-yellow-600 mt-0.5">Ensure approval chain is progressing</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Charts Row ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Renewal timeline */}
        <div className="card lg:col-span-2">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Renewal Timeline — Next 12 Months</h3>
          {timeline.length === 0
            ? <p className="text-xs text-gray-400 text-center py-8">No upcoming renewal data</p>
            : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={timeline} barSize={22}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#94a3b8" }} />
                  <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} />
                  <Tooltip content={<ChartTip />} />
                  <Bar dataKey="count" fill="#002F6C" radius={[4,4,0,0]} name="Policies" />
                </BarChart>
              </ResponsiveContainer>
            )}
        </div>

        {/* Rate distribution pie */}
        <div className="card">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Rate Band Distribution</h3>
          {rateDist.length === 0
            ? <p className="text-xs text-gray-400 text-center py-8">No data</p>
            : (
              <>
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie data={rateDist} dataKey="count" nameKey="band" cx="50%" cy="50%" outerRadius={70} paddingAngle={2}>
                      {rateDist.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(v) => [v, "Policies"]} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-1.5 mt-2">
                  {rateDist.map((d, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs">
                      <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                      <span className="text-gray-500 truncate flex-1">{d.band?.split("—")[0]?.trim()}</span>
                      <span className="font-semibold text-gray-700">{d.count}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
        </div>
      </div>

      {/* ── Portfolio Summary ── */}
      {portfolio.length > 0 && (
        <div className="card">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Portfolio Summary by Segment</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="table-th">Segment</th>
                  <th className="table-th text-right">Count</th>
                  <th className="table-th text-right">Total Premium</th>
                  <th className="table-th text-right">Avg LR</th>
                </tr>
              </thead>
              <tbody>
                {portfolio.map(r => (
                  <tr key={r.segment} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="table-td font-medium">
                      <span className={cn("badge",
                        r.segment === "TPA" ? "bg-teal-100 text-teal-800"
                        : r.segment === "CORPORATE" ? "bg-brand-blue-50 text-brand-blue"
                        : "bg-gray-100 text-gray-700")}>{r.segment}</span>
                    </td>
                    <td className="table-td text-right font-semibold">{r.count}</td>
                    <td className="table-td text-right">{formatCurrency(r.total_premium)}</td>
                    <td className={cn("table-td text-right font-semibold",
                      r.segment === "TPA" ? "text-gray-400" : COR_COLOR(r.avg_lr))}>
                      {r.segment === "TPA" ? "N/A" : formatPct(r.avg_lr)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Sector LR Bar ── */}
      {sectorLR.length > 0 && (
        <div className="card">
          <h3 className="text-sm font-semibold text-gray-700 mb-1">LR Heatmap by Business Sector</h3>
          <p className="text-xs text-gray-400 mb-4">Average Loss Ratio % per sector (ex-TPA)</p>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={sectorLR} barSize={28} layout="vertical" margin={{ left: 120 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis type="number" unit="%" tick={{ fontSize: 11, fill: "#94a3b8" }} />
              <YAxis type="category" dataKey="sector" tick={{ fontSize: 11, fill: "#6b7280" }} width={115} />
              <Tooltip formatter={(v) => [`${v}%`, "Avg LR"]} />
              <Bar dataKey="avg_lr" name="Avg LR %" radius={[0,4,4,0]}>
                {sectorLR.map((r, i) => (
                  <Cell key={i} fill={r.avg_lr >= 95 ? "#E30613" : r.avg_lr >= 80 ? "#f59e0b" : "#10b981"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ── LR Heatmap Cards ── */}
      {heatmap.length > 0 && (
        <div className="card">
          <h3 className="text-sm font-semibold text-gray-700 mb-1">LR Heatmap — Top Risk Accounts</h3>
          <p className="text-xs text-gray-400 mb-4">Sorted by COR (highest risk first) · TPA excluded</p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2">
            {heatmap.map(p => {
              const risk = p.cor >= 115 ? "high" : p.cor >= 95 ? "medium" : p.cor >= 80 ? "low" : "safe";
              const styles = {
                high:   { card: "border-red-300 bg-red-50",     text: "text-red-600",    bar: "bg-red-500" },
                medium: { card: "border-orange-200 bg-orange-50", text: "text-orange-600", bar: "bg-orange-400" },
                low:    { card: "border-yellow-200 bg-yellow-50", text: "text-yellow-700", bar: "bg-yellow-400" },
                safe:   { card: "border-green-200 bg-green-50",  text: "text-green-600",  bar: "bg-green-500" },
              }[risk];
              return (
                <div key={p.policy_number} className={cn("border rounded-lg p-3", styles.card)}>
                  <p className="text-xs font-semibold text-gray-700 truncate">{p.company_name}</p>
                  <p className="text-xs text-gray-400 mb-1">{p.policy_number}</p>
                  {p.business_sector && <p className="text-xs text-gray-400 mb-1 italic">{p.business_sector}</p>}
                  <div className="flex items-end justify-between mb-1.5">
                    <div><p className="text-xs text-gray-500">LR</p><p className={cn("text-sm font-bold", styles.text)}>{formatPct(p.lr)}</p></div>
                    <div className="text-right"><p className="text-xs text-gray-500">COR</p><p className={cn("text-sm font-bold", styles.text)}>{formatPct(p.cor)}</p></div>
                  </div>
                  <div className="h-1.5 bg-white/60 rounded-full overflow-hidden">
                    <div className={cn("h-full rounded-full", styles.bar)} style={{ width: `${Math.min(p.cor, 100)}%` }} />
                  </div>
                  {p.discrepancy_flagged && (
                    <p className="text-xs text-rose-600 font-medium mt-1.5">⚠ LR/COR discrepancy</p>
                  )}
                  {(p.risk_flags || []).length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-0.5">
                      {p.risk_flags.filter(f => f !== "HIGH_COR").map(f => (
                        <span key={f} className="text-xs bg-white/70 text-gray-600 px-1 rounded">{f.replace(/_/g," ")}</span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Risk flag summary ── */}
      {Object.keys(riskFlags).length > 0 && (
        <div className="card">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Risk Flag Summary</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {Object.entries(riskFlags).map(([flag, count]) => {
              const { RISK_FLAG_META } = require("../utils/helpers");
              const meta = { HIGH_COR: { label:"High COR", cls:"bg-red-100 text-red-700" }, ANTI_SELECTION: { label:"Anti-Selection", cls:"bg-orange-100 text-orange-800" }, ADOPTED_ENROLLEE_COHORT: { label:"Adopted Enrollee", cls:"bg-orange-100 text-orange-800" }, TPA_REFERRAL: { label:"TPA Referral", cls:"bg-teal-100 text-teal-700" }, LR_COR_DISCREPANCY: { label:"LR/COR Discrepancy", cls:"bg-rose-100 text-rose-800" }, PRO_RATA_REVIEW: { label:"Pro-rata", cls:"bg-yellow-100 text-yellow-700" }, CUSTOMISED_BENEFIT: { label:"Customised Benefit", cls:"bg-purple-100 text-purple-800" } }[flag] || { label: flag, cls: "bg-gray-100 text-gray-600" };
              return (
                <div key={flag} className={cn("rounded-xl p-3 text-center", meta.cls.replace("text-","").replace(/\S+/,"") + " bg-opacity-30")}>
                  <p className={cn("text-2xl font-bold", meta.cls.split(" ")[1])}>{count}</p>
                  <p className="text-xs font-medium mt-0.5 text-gray-600">{meta.label}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
