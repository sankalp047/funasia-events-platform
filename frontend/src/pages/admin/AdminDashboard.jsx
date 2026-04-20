import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Plus, DollarSign, Ticket, Calendar, TrendingUp, Users, Eye } from "lucide-react";
import api from "../../utils/api";

export default function AdminDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/admin/dashboard").then(({ data }) => setData(data)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="max-w-7xl mx-auto px-4 py-10"><div className="h-48 bg-brand-card rounded-2xl animate-pulse" /></div>;

  const s = data?.stats || {};
  const maxRev = Math.max(...(data?.revenue_by_event || []).map((e) => e.revenue), 1);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10 animate-fade-in">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-display text-3xl font-bold text-white mb-1">Admin Dashboard</h1>
          <p className="text-gray-500 text-sm">Manage events, track sales, and monitor performance</p>
        </div>
        <Link to="/admin/create-event" className="flex items-center gap-2 px-5 py-2.5 bg-brand-accent text-white font-semibold rounded-lg glow-accent hover:brightness-110 transition-all text-sm">
          <Plus size={16} /> Create Event
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { label: "Total Revenue", value: `$${(s.total_revenue / 1000).toFixed(1)}K`, icon: <DollarSign size={18} />, color: "brand-teal" },
          { label: "Tickets Sold", value: s.tickets_sold?.toLocaleString() || 0, icon: <Ticket size={18} />, color: "brand-accent" },
          { label: "Active Events", value: s.active_events || 0, icon: <Calendar size={18} />, color: "brand-gold" },
          { label: "Total Orders", value: s.total_orders || 0, icon: <TrendingUp size={18} />, color: "brand-purple" },
        ].map((stat) => (
          <div key={stat.label} className="p-5 bg-brand-card border border-white/5 rounded-xl relative overflow-hidden">
            <div className={`text-${stat.color} mb-2`}>{stat.icon}</div>
            <p className="text-[11px] text-gray-600 uppercase tracking-wider">{stat.label}</p>
            <p className="font-display text-2xl font-extrabold text-white mt-1">{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Revenue by Event */}
      {data?.revenue_by_event?.length > 0 && (
        <div className="bg-brand-card border border-white/5 rounded-2xl p-6 mb-8">
          <h3 className="font-display text-lg font-bold text-white mb-4">Revenue by Event</h3>
          <div className="space-y-3">
            {data.revenue_by_event.map((evt) => (
              <div key={evt.event_id} className="flex items-center gap-4">
                <span className="w-40 text-sm text-gray-300 truncate">{evt.title}</span>
                <div className="flex-1 h-7 bg-brand-elevated rounded overflow-hidden relative">
                  <div className="h-full rounded bg-gradient-to-r from-brand-accent/60 to-brand-gold/60 transition-all duration-700"
                    style={{ width: `${(evt.revenue / maxRev) * 100}%` }} />
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs font-semibold text-white">
                    ${(evt.revenue / 1000).toFixed(1)}K
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Events Table */}
      <div className="bg-brand-card border border-white/5 rounded-2xl overflow-hidden">
        <div className="p-5 border-b border-white/5">
          <h3 className="font-display text-lg font-bold text-white">My Events</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/5">
                {["Event", "Date", "Status", "Revenue", ""].map((h) => (
                  <th key={h} className="px-5 py-3 text-left text-[11px] text-gray-600 uppercase tracking-wider font-semibold">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(data?.events || []).map((evt) => {
                const rev = data.revenue_by_event?.find((r) => r.event_id === evt.id);
                return (
                  <tr key={evt.id} className="border-b border-white/5 hover:bg-white/[0.02]">
                    <td className="px-5 py-4">
                      <p className="text-white font-medium">{evt.title}</p>
                    </td>
                    <td className="px-5 py-4 text-gray-500">
                      {new Date(evt.event_start).toLocaleDateString("en-US", { timeZone: "America/Chicago", month: "short", day: "numeric", year: "numeric" })}
                    </td>
                    <td className="px-5 py-4">
                      <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide ${
                        evt.status === "published" ? "bg-brand-teal/10 text-brand-teal" :
                        evt.status === "draft" ? "bg-brand-gold/10 text-brand-gold" :
                        "bg-gray-500/10 text-gray-500"
                      }`}>{evt.status}</span>
                    </td>
                    <td className="px-5 py-4 text-brand-teal font-display font-bold">
                      ${rev?.revenue?.toLocaleString() || 0}
                    </td>
                    <td className="px-5 py-4">
                      <Link to={`/admin/events/${evt.id}/orders`} className="text-xs text-brand-accent hover:underline flex items-center gap-1">
                        <Eye size={12} /> Orders
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
