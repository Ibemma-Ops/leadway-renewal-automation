import { useEffect, useState } from "react";
import { dashboardAPI } from "../services/api";
import toast from "react-hot-toast";
import { RefreshCw } from "lucide-react";

export default function DashboardPage() {
  const [stats, setStats] = useState(null);
  const [riskFlags, setRiskFlags] = useState({});
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const [statsRes, riskRes] = await Promise.all([
        dashboardAPI.stats(),
        dashboardAPI.riskFlags().catch(() => ({ data: {} })),
      ]);

      setStats(statsRes?.data || {});
      setRiskFlags(riskRes?.data || {});
    } catch (err) {
      console.error("Dashboard load error:", err);
      toast.error("Failed to load dashboard");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  if (loading) {
    return (
      <div className="p-6">
        <div className="rounded-2xl bg-white border border-gray-200 p-6 shadow-sm">
          <p className="text-sm text-gray-500">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-brand-black">Renewal Dashboard</h1>
          <p className="text-sm text-gray-500 mt-1">
            Portfolio overview
          </p>
        </div>

        <button
          onClick={load}
          className="inline-flex items-center gap-2 rounded-xl bg-brand-red px-4 py-2 text-white hover:bg-brand-orange transition"
        >
          <RefreshCw size={16} />
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-2xl bg-white p-5 border border-gray-200 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-gray-500">Total Policies</p>
          <p className="text-3xl font-bold text-brand-black mt-2">
            {stats?.total_policies ?? 0}
          </p>
        </div>

        <div className="rounded-2xl bg-white p-5 border border-gray-200 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-gray-500">Approved</p>
          <p className="text-3xl font-bold text-brand-black mt-2">
            {stats?.approved ?? 0}
          </p>
        </div>

        <div className="rounded-2xl bg-white p-5 border border-gray-200 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-gray-500">Awaiting Underwriter</p>
          <p className="text-3xl font-bold text-brand-black mt-2">
            {stats?.awaiting_underwriter ?? 0}
          </p>
        </div>

        <div className="rounded-2xl bg-white p-5 border border-gray-200 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-gray-500">Notice Sent</p>
          <p className="text-3xl font-bold text-brand-black mt-2">
            {stats?.notice_sent ?? 0}
          </p>
        </div>
      </div>

      <div className="rounded-2xl bg-white p-6 border border-gray-200 shadow-sm">
        <h2 className="text-lg font-semibold text-brand-black mb-4">Risk Flag Summary</h2>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {Object.keys(riskFlags).length === 0 ? (
            <p className="text-sm text-gray-500">No risk flag data available.</p>
          ) : (
            Object.entries(riskFlags).map(([flag, count]) => (
              <div
                key={flag}
                className="rounded-xl border border-gray-200 bg-gray-50 p-4"
              >
                <p className="text-sm font-medium text-gray-600">
                  {flag.replaceAll("_", " ")}
                </p>
                <p className="text-2xl font-bold text-brand-black mt-2">
                  {count}
                </p>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="rounded-2xl bg-white p-6 border border-gray-200 shadow-sm">
        <h2 className="text-lg font-semibold text-brand-black mb-4">Raw Stats Check</h2>
        <pre className="text-xs text-gray-700 overflow-auto bg-gray-50 rounded-xl p-4">
{JSON.stringify(stats, null, 2)}
        </pre>
      </div>
    </div>
  );
}
