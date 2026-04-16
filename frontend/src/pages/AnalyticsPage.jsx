import { useState, useEffect } from "react";
import { dashboardAPI } from "../services/api";
import { Loading, PageHeader, RenewalStatusBadge, DiscrepancyBadge } from "../components/common";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  ScatterChart, Scatter, Cell, LineChart, Line, PieChart, Pie,
} from "recharts";
import { formatCurrency, formatPct, COR_COLOR, cn } from "../utils/helpers";
import toast from "react-hot-toast";

const PIE_COLORS = ["#002F6C","#E30613","#f59e0b","#10b981","#8b5cf6","#14b8a6"];

export default function AnalyticsPage() {
  const [heatmap,   setHeatmap]   = useState([]);
  const [portfolio, setPortfolio] = useState([]);
  const [timeline,  setTimeline]  = useState([]);
  const [rateDist,  setRateDist]  = useState([]);
  const [sectorLR,  setSectorLR]  = useState([]);
  const [segment,   setSegment]   = useState("");
  const [loading,   setLoading]   = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const [h, p, t, r, sl] = await Promise.all([
        dashboardAPI.heatmap(segment ? { segment } : {}),
        dashboardAPI.portfolio(),
        dashboardAPI.timeline(),
        dashboardAPI.rateDistribution(),
        dashboardAPI.sectorLR(),
      ]);
      setHeatmap(h.data);
      setPortfolio(p.data);
      setTimeline(t.data);
      setRateDist(r.data);
      setSectorLR(sl.data);
    } catch {
      toast.error("Failed to load analytics");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [segment]);

  if (loading) return <div className="p-8"><Loading /></div>;

  const scatterData = heatmap.map(p => ({
    x: p.lr,
    y: p.cor,
    name: p.company_name,
    flag: p.discrepancy_flagged
  }));

  const nonTpaPortfolio = portfolio.filter(r => r.segment !== "TPA");

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Portfolio Analytics"
        subtitle="LR/COR analysis, sector heatmap, rate distribution"
        actions={
          <select className="select text-xs w-44" value={segment} onChange={e => setSegment(e.target.value)}>
            <option value="">All Segments (ex-TPA)</option>
            <option value="CORPORATE">Corporate</option>
            <option value="RETAIL">Retail</option>
          </select>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="card">
          <h3 className="text-sm font-semibold text-gray-700 mb-1">LR vs COR Scatter</h3>
          <p className="text-xs text-gray-400 mb-3">Each point is a scheme. Flagged points = LR/COR discrepancy &gt;1%.</p>
          <ResponsiveContainer width="100%" height={260}>
            <ScatterChart margin={{ top: 5, right: 20, bottom: 25, left: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis
                dataKey="x"
                type="number"
                name="LR %"
                unit="%"
                tick={{ fontSize: 11, fill: "#94a3b8" }}
                label={{ value: "Loss Ratio %", position: "bottom", fontSize: 11, fill: "#94a3b8" }}
              />
              <YAxis dataKey="y" type="number" name="COR %" unit="%" tick={{ fontSize: 11, fill: "#94a3b8" }} />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.[0]) return null;
                  const d = payload[0].payload;
                  return (
                    <div className="bg-white border border-gray-200 rounded-lg shadow p-2 text-xs">
                      <p className="font-semibold">{d.name}</p>
                      <p>LR: {d.x}% · COR: {d.y}%</p>
                      {d.flag && <p className="text-rose-600 font-medium">⚠ Discrepancy flagged</p>}
                    </div>
                  );
                }}
              />
              <Scatter data={scatterData.filter(d => d.y < 80)} fill="#10b981" opacity={0.75} />
              <Scatter data={scatterData.filter(d => d.y >= 80 && d.y < 95)} fill="#f59e0b" opacity={0.75} />
              <Scatter data={scatterData.filter(d => d.y >= 95 && d.y < 115)} fill="#f97316" opacity={0.75} />
              <Scatter data={scatterData.filter(d => d.y >= 115 && !d.flag)} fill="#E30613" opacity={0.75} />
              <Scatter data={scatterData.filter(d => d.flag)} fill="#9f1239" opacity={0.9} shape="diamond" />
            </ScatterChart>
          </ResponsiveContainer>
          <div className="flex gap-4 mt-2 text-xs justify-center flex-wrap">
            {[["< 80%","text-green-600"],["80–95%","text-yellow-600"],["95–115%","text-orange-500"],["≥ 115%","text-red-600"],["Discrepancy","text-rose-800"]].map(([l,c]) => (
              <span key={l} className={cn("font-medium", c)}>● {l}</span>
            ))}
          </div>
        </div>

        <div className="card">
          <h3 className="text-sm font-semibold text-gray-700 mb-1">Premium by Segment</h3>
          <p className="text-xs text-gray-400 mb-3">TPA not rated — shown for volume reference only</p>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={portfolio} barSize={44}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="segment" tick={{ fontSize: 12, fill: "#6b7280" }} />
              <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} tickFormatter={v => `₦${(v/1e6).toFixed(1)}M`} />
              <Tooltip formatter={v => [formatCurrency(v), "Premium"]} />
              <Bar dataKey="total_premium" name="Total Premium" radius={[6,6,0,0]}>
                {portfolio.map((r, i) => (
                  <Cell
                    key={i}
                    fill={r.segment === "TPA" ? "#14b8a6" : r.segment === "CORPORATE" ? "#002F6C" : "#8b5cf6"}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="card">
          <h3 className="text-sm font-semibold text-gray-700 mb-1">Renewal Volume Timeline</h3>
          <p className="text-xs text-gray-400 mb-3">Non-TPA schemes due by month</p>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={timeline}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#94a3b8" }} />
              <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} />
              <Tooltip />
              <Line
                type="monotone"
                dataKey="count"
                stroke="#002F6C"
                strokeWidth={2.5}
                dot={{ r: 4, fill: "#002F6C" }}
                name="Schemes"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <h3 className="text-sm font-semibold text-gray-700 mb-1">Average LR by Segment</h3>
          <p className="text-xs text-gray-400 mb-3">TPA excluded — not in automated pipeline</p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={nonTpaPortfolio} barSize={40}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="segment" tick={{ fontSize: 12, fill: "#6b7280" }} />
              <YAxis unit="%" tick={{ fontSize: 11, fill: "#94a3b8" }} />
              <Tooltip formatter={v => [`${v}%`, "Avg LR"]} />
              <Bar dataKey="avg_lr" name="Avg LR %" radius={[6,6,0,0]}>
                {nonTpaPortfolio.map((r, i) => (
                  <Cell key={i} fill={r.avg_lr >= 95 ? "#E30613" : r.avg_lr >= 80 ? "#f59e0b" : "#10b981"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {sectorLR.length > 0 && (
        <div className="card">
          <h3 className="text-sm font-semibold text-gray-700 mb-1">LR Heatmap by Business Sector</h3>
          <p className="text-xs text-gray-400 mb-4">Average Loss Ratio per sector · ex-TPA</p>
          <ResponsiveContainer width="100%" height={Math.max(240, sectorLR.length * 36)}>
            <BarChart data={sectorLR} layout="vertical" barSize={22} margin={{ left: 130 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis type="number" unit="%" tick={{ fontSize: 11, fill: "#94a3b8" }} />
              <YAxis type="category" dataKey="sector" tick={{ fontSize: 11, fill: "#6b7280" }} width={125} />
              <Tooltip formatter={v => [`${v}%`, "Avg LR"]} />
              <Bar dataKey="avg_lr" name="Avg LR %" radius={[0,4,4,0]}>
                {sectorLR.map((r, i) => (
                  <Cell key={i} fill="#991B1B" />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="card">
        <h3 className="text-sm font-semibold text-gray-700 mb-1">Full LR/COR Risk Table</h3>
        <p className="text-xs text-gray-400 mb-4">All non-TPA schemes sorted by COR descending · ⚠ = LR/COR discrepancy</p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[750px]">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="table-th">#</th>
                <th className="table-th">Company</th>
                <th className="table-th">Sector</th>
                <th className="table-th text-right">LR %</th>
                <th className="table-th text-right">COR %</th>
                <th className="table-th">Rate Band</th>
                <th className="table-th">Risk</th>
                <th className="table-th">Status</th>
              </tr>
            </thead>
            <tbody>
              {heatmap.map((p, i) => {
                const risk =
                  p.cor >= 115 ? { l: "CRITICAL", c: "bg-red-100 text-red-700" } :
                  p.cor >= 95  ? { l: "HIGH", c: "bg-orange-100 text-orange-700" } :
                  p.cor >= 80  ? { l: "MODERATE", c: "bg-yellow-100 text-yellow-700" } :
                                 { l: "LOW", c: "bg-green-100 text-green-700" };

                return (
                  <tr key={p.policy_number} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="table-td text-gray-400 font-mono text-xs">{i + 1}</td>
                    <td className="table-td">
                      <p className="font-medium">{p.company_name}</p>
                      <p className="text-xs text-gray-400 font-mono">{p.policy_number}</p>
                    </td>
                    <td className="table-td text-xs text-gray-500">{p.business_sector || "—"}</td>
                    <td className={cn("table-td text-right font-bold", COR_COLOR(p.lr))}>{formatPct(p.lr)}</td>
                    <td className={cn("table-td text-right font-bold", COR_COLOR(p.cor))}>
                      {formatPct(p.cor)}
                      {p.discrepancy_flagged && <span className="text-rose-500 ml-1">⚠</span>}
                    </td>
                    <td className="table-td text-xs text-gray-500 max-w-[160px]">
                      <span className="truncate block">{p.rate_band?.split("—")[0]?.trim() || "—"}</span>
                    </td>
                    <td className="table-td">
                      <span className={cn("badge", risk.c)}>{risk.l}</span>
                    </td>
                    <td className="table-td">
                      <RenewalStatusBadge status={p.renewal_status} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
