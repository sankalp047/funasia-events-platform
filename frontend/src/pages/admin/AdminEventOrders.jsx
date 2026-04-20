import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Download, Search } from "lucide-react";
import api from "../../utils/api";

export default function AdminEventOrders() {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    api.get(`/admin/events/${eventId}/orders`)
      .then(({ data }) => setOrders(data.orders || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [eventId]);

  const filtered = orders.filter((o) =>
    !search || o.users?.full_name?.toLowerCase().includes(search.toLowerCase()) || o.users?.email?.toLowerCase().includes(search.toLowerCase()) || o.order_number?.toLowerCase().includes(search.toLowerCase())
  );

  const totalRevenue = orders.reduce((s, o) => s + parseFloat(o.total), 0);

  return (
    <div className="max-w-7xl mx-auto px-4 py-10 animate-fade-in">
      <button onClick={() => navigate("/admin")} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-white mb-6">
        <ArrowLeft size={16} /> Back to Dashboard
      </button>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-2xl font-bold text-white">Event Orders</h1>
          <p className="text-gray-500 text-sm">{orders.length} orders • ${totalRevenue.toLocaleString()} revenue</p>
        </div>
      </div>

      <div className="relative mb-6 max-w-md">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600" />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name, email, or order #"
          className="w-full pl-10 pr-4 py-3 bg-brand-card border border-white/5 rounded-xl text-sm text-white placeholder-gray-600 outline-none" />
      </div>

      {loading ? (
        <div className="h-48 bg-brand-card rounded-2xl animate-pulse" />
      ) : (
        <div className="bg-brand-card border border-white/5 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/5">
                  {["Order #", "Customer", "Tickets", "Food", "Total", "Status", "Date"].map((h) => (
                    <th key={h} className="px-5 py-3 text-left text-[11px] text-gray-600 uppercase tracking-wider font-semibold">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((o) => (
                  <tr key={o.id} className="border-b border-white/5 hover:bg-white/[0.02]">
                    <td className="px-5 py-3 text-brand-accent font-mono text-xs">{o.order_number}</td>
                    <td className="px-5 py-3">
                      <p className="text-white text-sm">{o.users?.full_name}</p>
                      <p className="text-gray-600 text-xs">{o.users?.email}</p>
                    </td>
                    <td className="px-5 py-3 text-gray-400">{o.order_items?.length || 0}</td>
                    <td className="px-5 py-3 text-gray-400">${o.food_total || 0}</td>
                    <td className="px-5 py-3 text-brand-teal font-display font-bold">${o.total}</td>
                    <td className="px-5 py-3">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase ${
                        o.status === "paid" ? "bg-brand-teal/10 text-brand-teal" : "bg-gray-500/10 text-gray-500"
                      }`}>{o.status}</span>
                    </td>
                    <td className="px-5 py-3 text-gray-500 text-xs">{new Date(o.paid_at || o.created_at).toLocaleDateString("en-US", { timeZone: "America/Chicago" })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {filtered.length === 0 && <p className="text-center py-10 text-gray-600 text-sm">No orders found</p>}
        </div>
      )}
    </div>
  );
}
