import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Plus, CalendarDays, Ticket, DollarSign, TrendingUp,
  ArrowRight, Globe,
} from "lucide-react";
import api from "../../utils/api";
import useAuthStore from "../../hooks/useAuthStore";
import toast from "react-hot-toast";

export default function OrganizerDashboard() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [recentEvents, setRecentEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const { data } = await api.get("/organizer/dashboard");
        setStats(data.stats);
        setRecentEvents(data.recent_events || []);
      } catch (err) {
        console.error("Dashboard fetch error:", err);
        toast.error("Could not load dashboard data. Please refresh.");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const STAT_CARDS = [
    { label: "Total Events",    value: stats?.total_events ?? "—",       icon: CalendarDays, color: "bg-blue-50 text-blue-600" },
    { label: "Tickets Sold",    value: stats?.total_tickets_sold ?? "—", icon: Ticket,       color: "bg-teal-50 text-brand-teal" },
    { label: "Total Revenue",   value: stats?.total_revenue != null ? `$${stats.total_revenue.toLocaleString("en-US", { minimumFractionDigits: 2 })}` : "—", icon: DollarSign, color: "bg-green-50 text-green-600" },
    { label: "Upcoming Events", value: stats?.upcoming_events ?? "—",    icon: TrendingUp,   color: "bg-red-50 text-brand-accent" },
  ];

  const org_initial = user?.full_name?.[0]?.toUpperCase() || "O";

  return (
    <div className="p-6 md:p-8 max-w-5xl mx-auto">

      {/* Welcome */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-display text-2xl font-bold text-brand-text">
            Hey there{user?.full_name ? `, ${user.full_name.split(" ")[0]}` : ""}! 👋
          </h1>
          <p className="text-sm text-brand-textMid mt-0.5">Here's what's happening with your events.</p>
        </div>
        <button onClick={() => navigate("/organizer/events/new")}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-brand-accent text-white text-sm font-bold hover:bg-brand-accentHover transition-colors">
          <Plus size={15} /> Create Event
        </button>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {STAT_CARDS.map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-white rounded-2xl border border-brand-border p-5">
            <div className={`w-9 h-9 rounded-xl ${color} flex items-center justify-center mb-3`}>
              <Icon size={18} />
            </div>
            {loading ? (
              <div className="h-7 w-16 bg-brand-muted rounded animate-pulse mb-1" />
            ) : (
              <p className="font-display text-2xl font-bold text-brand-text">{value}</p>
            )}
            <p className="text-xs text-brand-textLight mt-1">{label}</p>
          </div>
        ))}
      </div>

      {/* Create options */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
        <button onClick={() => navigate("/organizer/events/new")}
          className="flex items-center gap-4 p-5 bg-white rounded-2xl border-2 border-brand-border hover:border-brand-accent hover:shadow-md transition-all text-left group">
          <div className="w-12 h-12 rounded-xl bg-brand-muted flex items-center justify-center group-hover:bg-red-50 transition-colors">
            <Plus size={22} className="text-brand-textLight group-hover:text-brand-accent transition-colors" />
          </div>
          <div>
            <p className="font-semibold text-brand-text text-sm">Start from scratch</p>
            <p className="text-xs text-brand-textMid">Add all your event details manually</p>
          </div>
        </button>
        <Link to="/organizer/events"
          className="flex items-center gap-4 p-5 bg-white rounded-2xl border-2 border-brand-border hover:border-brand-accent hover:shadow-md transition-all group">
          <div className="w-12 h-12 rounded-xl bg-brand-muted flex items-center justify-center group-hover:bg-red-50 transition-colors">
            <CalendarDays size={22} className="text-brand-textLight group-hover:text-brand-accent transition-colors" />
          </div>
          <div>
            <p className="font-semibold text-brand-text text-sm">Manage existing events</p>
            <p className="text-xs text-brand-textMid">View, edit and publish your events</p>
          </div>
        </Link>
      </div>

      {/* Insights */}
      {!loading && stats && (
        <div className="bg-white rounded-2xl border border-brand-border p-6 mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-brand-text">Insights</h2>
            <Link to="/organizer/reporting" className="text-xs text-brand-accent font-semibold hover:underline">
              Go to Reports
            </Link>
          </div>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="font-display text-xl font-bold text-brand-text">
                ${(stats.total_revenue || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}
              </p>
              <p className="text-xs text-brand-textLight mt-0.5">Total Net Sales</p>
            </div>
            <div>
              <p className="font-display text-xl font-bold text-brand-text">{stats.total_tickets_sold || 0}</p>
              <p className="text-xs text-brand-textLight mt-0.5">Total Tickets Sold</p>
            </div>
            <div>
              <p className="font-display text-xl font-bold text-brand-text">{stats.total_orders || 0}</p>
              <p className="text-xs text-brand-textLight mt-0.5">Total Orders</p>
            </div>
          </div>
        </div>
      )}

      {/* Recent events — skeleton while loading, table after */}
      <div className="bg-white rounded-2xl border border-brand-border">
        <div className="flex items-center justify-between px-6 py-4 border-b border-brand-border">
          <h2 className="font-semibold text-brand-text">Your events</h2>
          <Link to="/organizer/events" className="text-xs text-brand-accent font-semibold hover:underline flex items-center gap-1">
            View all <ArrowRight size={12} />
          </Link>
        </div>

        {loading ? (
          <div className="divide-y divide-brand-border">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center justify-between px-6 py-4">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="w-2 h-2 rounded-full bg-brand-muted shrink-0 animate-pulse" />
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <div className="h-4 bg-brand-muted rounded animate-pulse w-2/5" />
                    <div className="h-3 bg-brand-muted rounded animate-pulse w-1/4" />
                  </div>
                </div>
                <div className="flex items-center gap-4 shrink-0">
                  <div className="hidden sm:block text-right space-y-1">
                    <div className="h-3.5 bg-brand-muted rounded animate-pulse w-12" />
                    <div className="h-3 bg-brand-muted rounded animate-pulse w-16" />
                  </div>
                  <div className="h-5 w-14 bg-brand-muted rounded-full animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        ) : recentEvents.length > 0 ? (
          <div className="divide-y divide-brand-border">
            {recentEvents.map((evt) => (
              <div key={evt.id} className="flex items-center justify-between px-6 py-4 hover:bg-brand-muted transition-colors">
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-2 h-2 rounded-full shrink-0 ${
                    evt.status === "published" ? "bg-brand-teal" :
                    evt.status === "draft" ? "bg-brand-textLight" : "bg-brand-accent"
                  }`} />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-brand-text truncate">{evt.title}</p>
                    <div className="flex items-center gap-2 text-[11px] text-brand-textLight">
                      <span className="flex items-center gap-1">
                        <CalendarDays size={10} />
                        {new Date(evt.event_start).toLocaleDateString("en-US", { timeZone: "America/Chicago", month: "short", day: "numeric", year: "numeric" })}
                      </span>
                      {evt.is_online && <span className="flex items-center gap-1"><Globe size={10} /> Online</span>}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4 shrink-0">
                  <div className="text-right hidden sm:block">
                    <p className="text-xs font-semibold text-brand-text">{evt.tickets_sold}/{evt.total_tickets}</p>
                    <p className="text-[10px] text-brand-textLight">tickets sold</p>
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${
                    evt.status === "published" ? "bg-teal-50 text-brand-teal" :
                    evt.status === "draft" ? "bg-brand-muted text-brand-textLight" :
                    "bg-red-50 text-brand-accent"
                  }`}>
                    {evt.status}
                  </span>
                  <Link to="/organizer/events" className="text-brand-textLight hover:text-brand-text">
                    <ArrowRight size={15} />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-14">
            <CalendarDays size={36} className="text-brand-textLight mx-auto mb-3" />
            <h3 className="font-display text-base font-bold text-brand-text mb-1">No events yet</h3>
            <p className="text-sm text-brand-textMid mb-5">Create your first event and start selling tickets.</p>
            <button onClick={() => navigate("/organizer/events/new")}
              className="px-5 py-2.5 rounded-xl bg-brand-accent text-white text-sm font-bold hover:bg-brand-accentHover transition-colors">
              Create your first event
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
