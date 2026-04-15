import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import toast from "react-hot-toast";
import { Loader2, Eye, EyeOff } from "lucide-react";
import logo from "../assets/leadway-health.png";

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [showPw, setShowPw] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.email || !form.password) {
      return toast.error("Enter email and password");
    }

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
    <div className="min-h-screen grid lg:grid-cols-2 bg-brand-white">
      <div className="hidden lg:flex relative overflow-hidden bg-brand-black text-brand-white">
        <div className="absolute inset-0 bg-gradient-to-br from-brand-red via-brand-black to-brand-black" />
        <div className="absolute top-0 right-0 h-72 w-72 rounded-full bg-brand-orange/20 blur-3xl" />
        <div className="absolute bottom-0 left-0 h-80 w-80 rounded-full bg-brand-red/20 blur-3xl" />

        <div className="relative z-10 flex w-full flex-col justify-between p-12 xl:p-16">
          <div className="flex items-center gap-4">
            <div className="bg-white rounded-2xl px-3 py-2 shadow-card-md">
              <img
                src={logo}
                alt="Leadway Health"
                className="h-10 w-auto object-contain"
              />
            </div>
            <div>
              <p className="text-lg font-semibold">Leadway Health</p>
              <p className="text-sm text-white/70">Insurance Limited</p>
            </div>
          </div>

          <div className="max-w-xl">
            <p className="mb-4 inline-flex rounded-full bg-brand-white/10 px-4 py-1 text-xs font-medium tracking-wide text-white/80">
              Internal Operations Platform
            </p>

            <h1 className="text-5xl font-bold leading-tight">
              Monthly Renewal
              <br />
              Automation System
            </h1>

            <p className="mt-6 text-lg leading-8 text-white/75">
              End-to-end renewal automation — ingestion, pricing, approvals, and dispatch.
            </p>

            <div className="mt-10 grid grid-cols-2 gap-4">
              {[
                ["Excel Ingestion", "Corporate, Retail & TPA"],
                ["LR & COR Engine", "Real-time analytics"],
                ["Approval Workflow", "Role-based sign-off"],
                ["Auto Dispatch", "D-60, D-30, D-7, D-0"],
              ].map(([title, subtitle]) => (
                <div
                  key={title}
                  className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm"
                >
                  <p className="text-sm font-semibold text-white">{title}</p>
                  <p className="mt-1 text-sm text-white/65">{subtitle}</p>
                </div>
              ))}
            </div>
          </div>

          <p className="text-sm text-white/60">
            © {new Date().getFullYear()} Leadway Health Insurance Limited
          </p>
        </div>
      </div>

      <div className="flex items-center justify-center bg-[#f8f8f8] px-6 py-10">
        <div className="w-full max-w-md">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <div className="bg-white rounded-xl px-3 py-2 shadow-sm">
              <img
                src={logo}
                alt="Leadway Health"
                className="h-8 w-auto object-contain"
              />
            </div>
            <div>
              <p className="font-semibold text-brand-black">Leadway Health</p>
              <p className="text-sm text-gray-500">MRAS Portal</p>
            </div>
          </div>

          <div className="rounded-3xl bg-brand-white p-8 shadow-card-md border border-gray-100">
            <h2 className="text-4xl font-bold text-brand-black">Welcome back</h2>
            <p className="mt-2 text-base text-gray-500">
              Sign in to access the renewal dashboard
            </p>

            <form onSubmit={handleSubmit} className="mt-8 space-y-5">
              <div>
                <label className="mb-2 block text-sm font-medium text-brand-black">
                  Email Address
                </label>
                <input
                  type="email"
                  className="input h-12"
                  placeholder="admin@leadwayhealth.com"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-brand-black">
                  Password
                </label>
                <div className="relative">
                  <input
                    type={showPw ? "text" : "password"}
                    className="input h-12 pr-10"
                    placeholder="Enter your password"
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-brand-black"
                    onClick={() => setShowPw(!showPw)}
                  >
                    {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="btn-primary w-full justify-center py-3 text-base font-semibold rounded-xl"
              >
                {loading ? <Loader2 className="animate-spin" size={18} /> : null}
                {loading ? "Signing in..." : "Sign In"}
              </button>
            </form>

            <p className="mt-6 text-center text-sm text-gray-400">
              Leadway Health MRAS v1.0 · Internal Use Only
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
