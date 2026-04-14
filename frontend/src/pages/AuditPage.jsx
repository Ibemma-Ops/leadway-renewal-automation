import { useState, useEffect, useCallback } from "react";
import { auditAPI } from "../services/api";
import { Loading, EmptyState, Pagination, PageHeader } from "../components/common";
import { Search, BookOpen } from "lucide-react";
import { formatDateTime, cn } from "../utils/helpers";
import toast from "react-hot-toast";

const ACTION_CLS = {
  USER_LOGIN:                     "bg-blue-100 text-blue-700",
  USER_CREATED:                   "bg-green-100 text-green-700",
  FILE_UPLOADED:                  "bg-purple-100 text-purple-700",
  INGESTION_COMPLETE:             "bg-indigo-100 text-indigo-700",
  TPA_ROUTED:                     "bg-teal-100 text-teal-700",
  POLICY_UPDATED:                 "bg-yellow-100 text-yellow-700",
  APPROVAL_REJECTED:              "bg-red-100 text-red-700",
  UNDERWRITER_ACKNOWLEDGED:       "bg-orange-100 text-orange-700",
  DOCUMENT_GENERATED:             "bg-teal-100 text-teal-700",
  AUTO_LAPSED:                    "bg-gray-200 text-gray-600",
  EXPORT_CSV:                     "bg-cyan-100 text-cyan-700",
};

const getActionCls = (action) => {
  if (ACTION_CLS[action]) return ACTION_CLS[action];
  if (action?.startsWith("STEP_APPROVED_"))    return "bg-green-100 text-green-700";
  if (action?.startsWith("EMAIL_TRIGGERED_"))  return "bg-emerald-100 text-emerald-700";
  if (action?.startsWith("MANUAL_EMAIL_"))     return "bg-emerald-100 text-emerald-700";
  return "bg-gray-100 text-gray-600";
};

export default function AuditPage() {
  const [data,    setData]    = useState({ items: [], total: 0, pages: 1 });
  const [page,    setPage]    = useState(1);
  const [search,  setSearch]  = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, page_size: 50 };
      if (search) params.action = search;
      const res = await auditAPI.list(params);
      setData(res.data);
    } catch { toast.error("Failed to load audit log"); }
    finally { setLoading(false); }
  }, [page, search]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="p-6 space-y-5">
      <PageHeader title="Audit Log" subtitle={`${data.total} total events · every action recorded`} />

      <div className="card py-3">
        <div className="relative max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input className="input pl-8 text-xs" placeholder="Filter by action type..."
            value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
        </div>
      </div>

      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[750px]">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="table-th">Timestamp</th>
                <th className="table-th">User</th>
                <th className="table-th">Action</th>
                <th className="table-th">Description</th>
                <th className="table-th">Policy</th>
                <th className="table-th">IP</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="py-12"><Loading /></td></tr>
              ) : data.items.length === 0 ? (
                <tr><td colSpan={6} className="py-12"><EmptyState message="No audit events found" icon={BookOpen} /></td></tr>
              ) : data.items.map(log => (
                <tr key={log.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                  <td className="table-td whitespace-nowrap text-xs text-gray-500">{formatDateTime(log.created_at)}</td>
                  <td className="table-td">
                    {log.user ? (
                      <div className="flex items-center gap-1.5">
                        <div className="w-6 h-6 bg-brand-blue rounded-full flex items-center justify-center flex-shrink-0">
                          <span className="text-white text-xs font-bold">{log.user.full_name?.charAt(0)}</span>
                        </div>
                        <div>
                          <p className="text-xs font-medium text-gray-700">{log.user.full_name}</p>
                          <p className="text-xs text-gray-400">{log.user.role?.replace(/_/g," ")}</p>
                        </div>
                      </div>
                    ) : <span className="text-xs text-gray-400">System</span>}
                  </td>
                  <td className="table-td">
                    <span className={cn("badge text-xs font-mono", getActionCls(log.action))}>{log.action}</span>
                  </td>
                  <td className="table-td text-gray-600 max-w-[240px]">
                    <p className="truncate text-xs">{log.description || "—"}</p>
                  </td>
                  <td className="table-td">
                    {log.policy_id ? <span className="text-xs font-mono text-brand-blue">#{log.policy_id}</span> : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="table-td text-xs text-gray-400 font-mono">{log.ip_address || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination page={page} pages={data.pages} total={data.total} onPage={setPage} />
      </div>
    </div>
  );
}
