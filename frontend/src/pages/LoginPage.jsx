import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import toast from "react-hot-toast";
import { Loader2, Eye, EyeOff } from "lucide-react";

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [showPw, setShowPw] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.email || !form.password) return toast.error("Enter email and password");
    setLoading(true);
    try {
      await login(form.email, form.password);
      navigate("/");
    } catch (err) {
      toast.error(err.response?.data?.detail || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-gray-50">
      {/* Left panel */}
      <div className="hidden lg:flex lg:w-1/2 bg-brand-blue flex-col justify-between p-12">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-brand-red rounded-lg flex items-center justify-center">
            <span className="text-white font-bold">LH</span>
          </div>
          <div>
            <p className="text-white font-bold">Leadway Health</p>
            <p className="text-blue-300 text-xs">Insurance Limited</p>
          </div>
        </div>

        <div>
          <h2 className="text-4xl font-bold text-white leading-snug mb-4">
            Monthly Renewal<br />Automation System
          </h2>
          <p className="text-blue-200 text-base max-w-md">
            A production-grade platform automating the full renewal lifecycle —
            from Excel ingestion to document generation and automated email dispatch.
          </p>
          <div className="mt-8 grid grid-cols-2 gap-4">
            {[
              ["Excel Ingestion", "Corporate, Retail & TPA"],
              ["LR & COR Engine", "Real-time analytics"],
              ["Approval Workflow", "Role-based chain"],
              ["Auto Email Dispatch", "D-60, D-30, D-7, D-0"],
            ].map(([t, s]) => (
              <div key={t} className="bg-white/10 rounded-xl p-4">
                <p className="text-white font-semibold text-sm">{t}</p>
                <p className="text-blue-300 text-xs mt-1">{s}</p>
              </div>
            ))}
          </div>
        </div>

        <p className="text-blue-400 text-xs">© {new Date().getFullYear()} Leadway Health Insurance Limited</p>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center px-6">
        <div className="w-full max-w-md">
          <div className="flex items-center gap-3 mb-8 lg:hidden">
            <div className="w-10 h-10 bg-brand-blue rounded-lg flex items-center justify-center">
              <span className="text-white font-bold">LH</span>
            </div>
            <p className="font-bold text-brand-blue">Leadway MRAS</p>
          </div>

          <h1 className="text-2xl font-bold text-gray-900 mb-1">Welcome back</h1>
          <p className="text-gray-500 text-sm mb-8">Sign in to access the renewal dashboard</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1.5">Email Address</label>
              <input
                type="email"
                className="input"
                placeholder="you@leadwayhealth.com"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1.5">Password</label>
              <div className="relative">
                <input
                  type={showPw ? "text" : "password"}
                  className="input pr-10"
                  placeholder="••••••••"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  onClick={() => setShowPw(!showPw)}
                >
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button type="submit" disabled={loading} className="btn-primary w-full justify-center py-2.5 mt-2">
              {loading ? <Loader2 className="animate-spin" size={16} /> : null}
              {loading ? "Signing in..." : "Sign In"}
            </button>
          </form>

          <p className="text-center text-xs text-gray-400 mt-8">
            Leadway Health MRAS v1.0 · Internal Use Only
          </p>
        </div>
      </div>
    </div>
  );
}
