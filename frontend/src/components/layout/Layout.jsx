import { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  FileText,
  CheckCircle2,
  BarChart3,
  Upload,
  ScrollText,
  Users,
  LogOut,
  Bell,
  ChevronRight,
  Menu,
  X,
} from "lucide-react";
import { useAuth } from "../../hooks/useAuth";
import { cn } from "../../utils/helpers";
import logo from "../../assets/leadway-health.png";

const navItems = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/renewals", label: "Renewals", icon: FileText },
  { to: "/approvals", label: "Approvals", icon: CheckCircle2 },
  { to: "/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/upload", label: "Upload", icon: Upload },
  { to: "/audit", label: "Audit Log", icon: ScrollText },
  { to: "/users", label: "Users", icon: Users },
];

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <div className="h-screen overflow-hidden bg-gray-100 flex">
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={cn(
          "fixed top-0 left-0 z-50 h-screen w-72 bg-brand-black text-brand-white flex flex-col border-r border-white/10 shadow-2xl transform transition-transform duration-300",
          sidebarOpen ? "translate-x-0" : "-translate-x-full",
          "lg:static lg:translate-x-0"
        )}
      >
        <div className="px-6 py-6 border-b border-white/10 shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-white rounded-lg px-3 py-1.5 shadow-sm">
                <img
                  src={logo}
                  alt="Leadway Health"
                  className="h-8 w-auto object-contain"
                />
              </div>
            </div>

            <button
              className="lg:hidden inline-flex h-9 w-9 items-center justify-center rounded-full text-white/70 hover:bg-white/10 hover:text-white"
              onClick={() => setSidebarOpen(false)}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-4 py-6 space-y-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === "/"}
                onClick={() => setSidebarOpen(false)}
                className={({ isActive }) =>
                  cn(
                    "group flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all",
                    isActive
                      ? "bg-brand-red text-brand-white shadow-md"
                      : "text-white/70 hover:text-white hover:bg-white/10"
                  )
                }
              >
                <Icon size={18} />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>

        <div className="px-4 py-4 border-t border-white/10 shrink-0">
          <div className="rounded-2xl bg-white/5 px-4 py-4">
            <div className="flex items-center gap-3">
              <div className="h-11 w-11 rounded-full bg-brand-red text-brand-white flex items-center justify-center font-semibold">
                {user?.full_name?.[0] || "A"}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold truncate">
                  {user?.full_name || "System Administrator"}
                </p>
                <p className="text-xs text-white/60 truncate">
                  {user?.role || "ADMIN"}
                </p>
              </div>
            </div>

            <button
              onClick={handleLogout}
              className="mt-4 w-full inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-medium text-white/80 hover:bg-white/10 hover:text-white transition"
            >
              <LogOut size={16} />
              Sign Out
            </button>
          </div>
        </div>
      </aside>

      <div className="flex-1 min-w-0 h-screen flex flex-col">
        <header className="h-20 shrink-0 bg-brand-white border-b border-gray-200 px-4 lg:px-8 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-3 min-w-0">
            <button
              className="lg:hidden inline-flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 shrink-0"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu size={18} />
            </button>

            <div className="flex items-center gap-2 text-sm text-gray-400 min-w-0">
              <span className="font-semibold text-brand-black">MRAS</span>
              <ChevronRight size={14} className="shrink-0" />
              <span className="truncate">Monthly Renewal Automation System</span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <button className="relative inline-flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-500 hover:bg-gray-50">
              <Bell size={18} />
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
