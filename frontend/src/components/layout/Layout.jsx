import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import {
  LayoutDashboard, FileSpreadsheet, CheckCircle2, BarChart3,
  FileText, LogOut, Users, BookOpen, ChevronRight, Bell, Building2,
} from "lucide-react";
import { cn } from "../../utils/helpers";

const NAV_ITEMS = [
  { to: "/",          icon: LayoutDashboard, label: "Dashboard",   exact: true },
  { to: "/renewals",  icon: FileSpreadsheet, label: "Renewals" },
  { to: "/approvals", icon: CheckCircle2,    label: "Approvals" },
  { to: "/analytics", icon: BarChart3,       label: "Analytics" },
  { to: "/upload",    icon: FileText,        label: "Upload" },
  { to: "/audit",     icon: BookOpen,        label: "Audit Log" },
  { to: "/users",     icon: Users,           label: "Users",     adminOnly: true },
];

const ROLE_LABELS = {
  SALES_OFFICER: "Sales Officer",
  UNDERWRITER:   "Underwriter",
  HBD:           "Head of Business Dev",
  MD_CEO:        "MD / CEO",
  ADMIN:         "Administrator",
};

export default function Layout({ children }) {
  const { user, logout, hasRole } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 flex flex-col bg-brand-blue shadow-xl flex-shrink-0">
        {/* Logo */}
        <div className="px-6 py-5 border-b border-blue-900">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-brand-red rounded-lg flex items-center justify-center flex-shrink-0">
              <span className="text-white font-bold text-sm">LH</span>
            </div>
            <div>
              <p className="text-white font-bold text-sm leading-tight">Leadway Health</p>
              <p className="text-blue-300 text-xs">MRAS Platform</p>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {NAV_ITEMS.filter(item => !item.adminOnly || hasRole("ADMIN")).map(({ to, icon: Icon, label, exact }) => (
            <NavLink key={to} to={to} end={exact}
              className={({ isActive }) => cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150",
                isActive ? "bg-white/15 text-white" : "text-blue-200 hover:bg-white/10 hover:text-white"
              )}>
              <Icon size={17} className="flex-shrink-0" />
              {label}
            </NavLink>
          ))}
        </nav>

        {/* User */}
        <div className="p-4 border-t border-blue-900">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 bg-brand-red rounded-full flex items-center justify-center flex-shrink-0">
              <span className="text-white text-xs font-bold">{user?.full_name?.charAt(0).toUpperCase()}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white text-xs font-semibold truncate">{user?.full_name}</p>
              <p className="text-blue-300 text-xs truncate">{ROLE_LABELS[user?.role] || user?.role}</p>
            </div>
          </div>
          <button onClick={() => { logout(); navigate("/login"); }}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-blue-200 hover:bg-white/10 hover:text-white text-xs font-medium transition-colors">
            <LogOut size={14} /> Sign Out
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="h-14 bg-white border-b border-gray-200 flex items-center justify-between px-6 flex-shrink-0">
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <span className="font-semibold text-brand-blue">MRAS</span>
            <ChevronRight size={14} />
            <span>Monthly Renewal Automation System</span>
          </div>
          <div className="flex items-center gap-3">
            <button className="p-2 text-gray-500 hover:text-brand-blue transition-colors">
              <Bell size={18} />
            </button>
            <div className="w-8 h-8 bg-brand-blue rounded-full flex items-center justify-center">
              <span className="text-white text-xs font-bold">{user?.full_name?.charAt(0).toUpperCase()}</span>
            </div>
          </div>
        </header>
        <div className="flex-1 overflow-y-auto">{children}</div>
      </main>
    </div>
  );
}
