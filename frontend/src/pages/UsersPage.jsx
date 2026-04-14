import { useState, useEffect } from "react";
import { usersAPI, authAPI } from "../services/api";
import { PageHeader, Modal, Loading, EmptyState } from "../components/common";
import { UserPlus, Loader2, Shield, Users } from "lucide-react";
import { formatDate, cn } from "../utils/helpers";
import toast from "react-hot-toast";

const ROLES = ["SALES_OFFICER", "UNDERWRITER", "HBD", "MD_CEO", "ADMIN"];
const ROLE_BADGES = {
  ADMIN:         "bg-brand-red-50 text-brand-red",
  MD_CEO:        "bg-brand-blue-50 text-brand-blue",
  HBD:           "bg-purple-100 text-purple-700",
  UNDERWRITER:   "bg-blue-100 text-blue-700",
  SALES_OFFICER: "bg-gray-100 text-gray-600",
};

function CreateUserModal({ open, onClose, onDone }) {
  const [form, setForm] = useState({ email: "", full_name: "", password: "", role: "SALES_OFFICER" });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!form.email || !form.full_name || !form.password) return toast.error("Fill all fields");
    setLoading(true);
    try {
      await authAPI.register(form);
      toast.success("User created");
      setForm({ email: "", full_name: "", password: "", role: "SALES_OFFICER" });
      onDone(); onClose();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Failed to create user");
    } finally { setLoading(false); }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Create New User"
      footer={
        <div className="flex gap-2 justify-end">
          <button onClick={onClose} className="btn-ghost text-xs">Cancel</button>
          <button onClick={handleSubmit} disabled={loading} className="btn-primary text-xs">
            {loading ? <Loader2 size={13} className="animate-spin" /> : <UserPlus size={13} />}
            Create User
          </button>
        </div>
      }
    >
      <div className="space-y-4 text-sm">
        {[
          { label: "Full Name", key: "full_name", type: "text", placeholder: "Jane Doe" },
          { label: "Email Address", key: "email", type: "email", placeholder: "jane@leadwayhealth.com" },
          { label: "Password", key: "password", type: "password", placeholder: "Min 8 characters" },
        ].map(({ label, key, type, placeholder }) => (
          <div key={key}>
            <label className="block text-xs font-medium text-gray-700 mb-1.5">{label}</label>
            <input
              type={type}
              className="input text-xs"
              placeholder={placeholder}
              value={form[key]}
              onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
            />
          </div>
        ))}
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1.5">Role</label>
          <select className="select text-xs" value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
            {ROLES.map(r => <option key={r} value={r}>{r.replace("_", " ")}</option>)}
          </select>
        </div>
      </div>
    </Modal>
  );
}

export default function UsersPage() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await usersAPI.list();
      setUsers(res.data);
    } catch { toast.error("Failed to load users"); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const toggleActive = async (user) => {
    try {
      await usersAPI.update(user.id, { is_active: !user.is_active });
      toast.success(`User ${user.is_active ? "deactivated" : "activated"}`);
      load();
    } catch { toast.error("Update failed"); }
  };

  return (
    <div className="p-6 space-y-5">
      <PageHeader
        title="User Management"
        subtitle="Manage platform users and roles"
        actions={
          <button onClick={() => setCreateOpen(true)} className="btn-primary text-xs gap-1.5">
            <UserPlus size={14} /> Add User
          </button>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {ROLES.map(role => {
          const count = users.filter(u => u.role === role).length;
          return (
            <div key={role} className="card text-center py-4">
              <p className="text-2xl font-bold text-gray-900">{count}</p>
              <p className={cn("badge mt-1.5", ROLE_BADGES[role])}>{role.replace("_", " ")}</p>
            </div>
          );
        })}
      </div>

      {/* Table */}
      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="table-th">User</th>
                <th className="table-th">Email</th>
                <th className="table-th">Role</th>
                <th className="table-th">Status</th>
                <th className="table-th">Created</th>
                <th className="table-th">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="py-12"><Loading /></td></tr>
              ) : users.length === 0 ? (
                <tr><td colSpan={6} className="py-12"><EmptyState message="No users found" icon={Users} /></td></tr>
              ) : users.map(u => (
                <tr key={u.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                  <td className="table-td">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 bg-brand-blue rounded-full flex items-center justify-center flex-shrink-0">
                        <span className="text-white text-xs font-bold">{u.full_name?.charAt(0)}</span>
                      </div>
                      <p className="font-medium text-gray-800">{u.full_name}</p>
                    </div>
                  </td>
                  <td className="table-td text-gray-500 text-xs">{u.email}</td>
                  <td className="table-td">
                    <span className={cn("badge", ROLE_BADGES[u.role] || "bg-gray-100 text-gray-600")}>
                      {u.role?.replace("_", " ")}
                    </span>
                  </td>
                  <td className="table-td">
                    <span className={cn("badge", u.is_active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500")}>
                      {u.is_active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="table-td text-xs text-gray-400">{formatDate(u.created_at)}</td>
                  <td className="table-td">
                    <button
                      onClick={() => toggleActive(u)}
                      className={cn("text-xs px-3 py-1 rounded-lg font-medium transition-colors",
                        u.is_active
                          ? "text-red-600 hover:bg-red-50"
                          : "text-green-600 hover:bg-green-50")}
                    >
                      {u.is_active ? "Deactivate" : "Activate"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <CreateUserModal open={createOpen} onClose={() => setCreateOpen(false)} onDone={load} />
    </div>
  );
}
