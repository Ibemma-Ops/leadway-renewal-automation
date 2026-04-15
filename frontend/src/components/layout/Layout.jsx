import { NavLink, Outlet, useNavigate } from "react-router-dom";
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

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <div className="min-h-screen bg-gray-100 flex">
      {/* Sidebar */}
      <aside className="w-72 bg-brand-black text-brand-white flex flex-col border-r border-white/10 shadow-2xl">
        <div className="px-6 py-6 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="bg-white rounded-lg px-3 py-1.5 shadow-sm">
              <img
                src={logo}
                alt="Leadway Health"
                className="h-8 w-auto object-contain"
              />
            </div>
          </div>
        </div>

        <nav className="flex-1 px-4 py-6 space-y-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === "/"}
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

        <div className="px-4 py-4 border-t border-white/10">
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

      {/* Main content */}
      <div className="flex-1 min-w-0 flex flex-col">
        <header className="h-20 bg-brand-white border-b border-gray-200 px-8 flex items-center justify-between shadow-sm">
          <div>
            <div className="flex items-center gap-2 text-sm text-gray-400">
              <span className="font-semibold text-brand-black">MRAS</span>
              <ChevronRight size={14} />
              <span>Monthly Renewal Automation System</span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <button className="relative inline-flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-500 hover:bg-gray-50">
              <Bell size={18} />
            </button>
          </div>
        </header>

       <main className="flex-1 p-6 overflow-auto">
  <div style={{ background: "white", padding: "20px", color: "black", borderRadius: "12px" }}>
    OUTLET IS WORKING
  </div>
  <Outlet />
</main>
