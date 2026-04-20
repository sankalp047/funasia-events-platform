import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Users, Calendar, DollarSign, Shield, Activity } from "lucide-react";
import api from "../../utils/api";

export default function SuperAdminDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/super-admin/dashboard").then(({ data }) => setData(data)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="max-w-7xl mx-auto px-4 py-10"><div className="h-48 bg-brand-card rounded-2xl animate-pulse" /></div>;

  const s = data?.stats || {};

  return (
    <div className="max-w-7xl mx-auto px-4 py-10 animate-fade-in">
      <div className="flex items-center gap-3 mb-8">
        <Shield size={24} className="text-brand-gold" />
        <div>
          <h1 className="font-display text-3xl font-bold text-white">Platform Control</h1>
          <p className="text-gray-500 text-sm">Super Admin Dashboard</p>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { label: "Total Users", value: s.total_users?.toLocaleString(), icon: <Users size={18} />, color: "text-brand-accent" },
          { label: "Total Events", value: s.total_events, icon: <Calendar size={18} />, color: "text-brand-gold" },
          { label: "Platform Revenue", value: `$${((s.total_revenue || 0) / 1000).toFixed(1)}K`, icon: <DollarSign size={18} />, color: "text-brand-teal" },
          { label: "Platform Earnings", value: `$${((s.platform_earnings || 0) / 1000).toFixed(1)}K`, icon: <DollarSign size={18} />, color: "text-brand-purple" },
        ].map((stat) => (
          <div key={stat.label} className="p-5 bg-brand-card border border-white/5 rounded-xl">
            <div className={`${stat.color} mb-2`}>{stat.icon}</div>
            <p className="text-[11px] text-gray-600 uppercase tracking-wider">{stat.label}</p>
            <p className="font-display text-2xl font-extrabold text-white mt-1">{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { label: "Manage Users", desc: `${s.total_admins || 0} admins`, href: "/super-admin/users", icon: <Users size={18} /> },
          { label: "All Events", desc: `${s.published_events || 0} published`, href: "/super-admin/events", icon: <Calendar size={18} /> },
          { label: "Platform Settings", desc: "Fees & config", href: "/super-admin/settings", icon: <Shield size={18} /> },
          { label: "Audit Log", desc: `${data?.recent_activity?.length || 0} recent`, href: "#", icon: <Activity size={18} /> },
        ].map((card) => (
          <Link key={card.label} to={card.href} className="p-5 bg-brand-card border border-white/5 rounded-xl hover:border-brand-gold/20 transition-all group">
            <div className="text-brand-gold group-hover:scale-110 transition-transform mb-3">{card.icon}</div>
            <h3 className="text-sm font-semibold text-white">{card.label}</h3>
            <p className="text-xs text-gray-500 mt-0.5">{card.desc}</p>
          </Link>
        ))}
      </div>

      <div className="bg-brand-card border border-white/5 rounded-2xl p-6">
        <h3 className="font-display text-lg font-bold text-white mb-4">Recent Activity</h3>
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {(data?.recent_activity || []).slice(0, 20).map((a) => (
            <div key={a.id} className="flex items-center justify-between py-2.5 border-b border-white/5 last:border-0">
              <div>
                <p className="text-sm text-white">{a.action.replace(".", " → ")}</p>
                <p className="text-xs text-gray-600">{a.users?.full_name || "System"}</p>
              </div>
              <span className="text-[11px] text-gray-600">{new Date(a.created_at).toLocaleString("en-US", { timeZone: "America/Chicago" })}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
