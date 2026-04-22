import { useState } from "react";
import { Link, useLocation, useNavigate, Outlet } from "react-router-dom";
import logo from "../../logo.png";
import {
  LayoutDashboard, CalendarDays, ShoppingBag, Megaphone,
  BarChart2, Banknote, Settings, Home, Menu, X, ChevronRight, Plus, Tag,
} from "lucide-react";
import useAuthStore from "../../hooks/useAuthStore";

const NAV_ITEMS = [
  { path: "/organizer",             label: "Dashboard",   icon: LayoutDashboard, exact: true },
  { path: "/organizer/events",      label: "Events",      icon: CalendarDays },
  { path: "/organizer/orders",      label: "Orders",      icon: ShoppingBag },
  { path: "/organizer/promo-codes", label: "Promo Codes", icon: Tag },
  { path: "/organizer/marketing",   label: "Marketing",   icon: Megaphone,  soon: true },
  { path: "/organizer/reporting",   label: "Reporting",   icon: BarChart2,  soon: true },
  { path: "/organizer/finance",     label: "Finance",     icon: Banknote },
  { path: "/organizer/settings",    label: "Org Settings",icon: Settings },
];

export default function OrganizerLayout() {
  const { user } = useAuthStore();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const isActive = (item) => {
    if (item.exact) return location.pathname === item.path;
    return location.pathname.startsWith(item.path);
  };

  const initial = user?.full_name?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || "O";

  return (
    <div className="flex h-screen bg-brand-bg overflow-hidden">

      {/* ── Sidebar ── */}
      <>
        {/* Mobile overlay */}
        {sidebarOpen && (
          <div className="fixed inset-0 bg-black/30 z-40 md:hidden" onClick={() => setSidebarOpen(false)} />
        )}

        <aside className={`
          fixed md:static top-0 left-0 z-50 h-full w-56 bg-white border-r border-brand-border
          flex flex-col transition-transform duration-200
          ${sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}
        `}>
          {/* Logo */}
          <div className="p-4 border-b border-brand-border flex items-center justify-between">
            <Link to="/" className="flex items-center">
              <img src={logo} alt="FunAsia Entertainment" className="h-8 w-auto" />
            </Link>
            <button onClick={() => setSidebarOpen(false)} className="md:hidden text-brand-textMid">
              <X size={18} />
            </button>
          </div>

          {/* Org info */}
          <div className="px-4 py-3 border-b border-brand-border">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-brand-accent flex items-center justify-center text-sm font-bold text-white shrink-0">
                {initial}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-brand-text truncate">{user?.full_name || "Organizer"}</p>
                <p className="text-[10px] text-brand-textLight truncate">{user?.email}</p>
              </div>
            </div>
          </div>

          {/* Nav */}
          <nav className="flex-1 overflow-y-auto p-3 space-y-0.5">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const active = isActive(item);
              return (
                <Link
                  key={item.path}
                  to={item.soon ? "#" : item.path}
                  onClick={() => setSidebarOpen(false)}
                  className={`flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                    active
                      ? "bg-red-50 text-brand-accent"
                      : item.soon
                      ? "text-brand-textLight cursor-default"
                      : "text-brand-textMid hover:bg-brand-muted hover:text-brand-text"
                  }`}>
                  <div className="flex items-center gap-3">
                    <Icon size={16} className={active ? "text-brand-accent" : ""} />
                    {item.label}
                  </div>
                  {item.soon && (
                    <span className="text-[9px] font-bold bg-brand-muted text-brand-textLight px-1.5 py-0.5 rounded-full uppercase tracking-wide">
                      Soon
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>

          {/* Bottom: back to site */}
          <div className="p-3 border-t border-brand-border">
            <Link to="/" className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm text-brand-textMid hover:bg-brand-muted transition-colors">
              <Home size={15} /> Back to site
            </Link>
          </div>
        </aside>
      </>

      {/* ── Main content ── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top bar (mobile) */}
        <div className="md:hidden bg-white border-b border-brand-border px-4 py-3 flex items-center justify-between">
          <button onClick={() => setSidebarOpen(true)} className="p-1.5 text-brand-textMid">
            <Menu size={20} />
          </button>
          <span className="font-display font-bold text-brand-text text-sm">Organizer</span>
          <button onClick={() => navigate("/organizer/events/new")}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-brand-accent text-white text-xs font-bold">
            <Plus size={12} /> New
          </button>
        </div>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
