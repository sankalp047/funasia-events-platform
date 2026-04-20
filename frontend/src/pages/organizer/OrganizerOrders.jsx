import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { ShoppingBag, Search } from "lucide-react";
import api from "../../utils/api";

const STATUS_TABS = [
  { id: "",          label: "All" },
  { id: "paid",      label: "Paid" },
  { id: "reserved",  label: "Reserved" },
  { id: "cancelled", label: "Cancelled" },
  { id: "refunded",  label: "Refunded" },
];

export default function OrganizerOrders() {
  const [searchParams] = useSearchParams();
  const eventFilter = searchParams.get("event") || "";

  const [orders, setOrders] = useState([]);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");
  const [selectedEvent, setSelectedEvent] = useState(eventFilter);
  const [search, setSearch] = useState("");

  useEffect(() => {
    api.get("/organizer/events", { params: { limit: 100 } })
      .then((r) => setEvents(r.data.events || []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const params = {
          limit: 100,
          ...(status && { status }),
          ...(selectedEvent && { event_id: selectedEvent }),
        };
        const { data } = await api.get("/organizer/orders", { params });
        setOrders(data.orders || []);
      } catch (err) {
        console.error("Orders fetch error:", err);
        setOrders([]);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [status, selectedEvent]);

  const filtered = orders.filter((o) => {
    if (status && o.status !== status) return false;
    if (search && !o.order_number?.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="p-6 md:p-8 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold text-brand-text">Orders</h1>
        <p className="text-sm text-brand-textMid mt-0.5">All ticket purchases across your events.</p>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-textLight" />
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search order number…"
            className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-brand-border bg-brand-muted text-sm outline-none focus:border-brand-accent focus:bg-white transition-colors" />
        </div>

        {/* Event selector */}
        <select value={selectedEvent} onChange={(e) => setSelectedEvent(e.target.value)}
          className="px-3 py-2.5 rounded-xl border border-brand-border bg-brand-muted text-sm text-brand-text outline-none focus:border-brand-accent">
          <option value="">All events</option>
          {events.map((e) => <option key={e.id} value={e.id}>{e.title}</option>)}
        </select>

        {/* Status tabs */}
        <div className="flex items-center gap-1 bg-brand-muted rounded-xl p-1">
          {STATUS_TABS.map((t) => (
            <button key={t.id} onClick={() => setStatus(t.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                status === t.id ? "bg-white text-brand-text shadow-sm" : "text-brand-textMid hover:text-brand-text"
              }`}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Orders table */}
      <div className="bg-white rounded-2xl border border-brand-border overflow-hidden">
          {loading ? (
            <div className="divide-y divide-brand-border">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-4 px-6 py-4">
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-brand-muted rounded animate-pulse w-1/3" />
                    <div className="h-3 bg-brand-muted rounded animate-pulse w-1/2" />
                  </div>
                  <div className="h-6 w-16 bg-brand-muted rounded animate-pulse" />
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16">
              <ShoppingBag size={36} className="text-brand-textLight mx-auto mb-3" />
              <p className="text-sm text-brand-textMid">No orders found.</p>
            </div>
          ) : (
            <>
              <div className="hidden md:grid grid-cols-[auto_1fr_auto_auto_auto_auto] gap-4 px-6 py-3 text-[11px] font-semibold text-brand-textLight uppercase tracking-wider bg-brand-muted">
                <span>Order #</span>
                <span>Customer</span>
                {!selectedEvent && <span>Event</span>}
                <span>Tickets</span>
                <span>Total</span>
                <span>Status</span>
              </div>
              <div className="divide-y divide-brand-border">
                {filtered.map((order) => (
                  <div key={order.id}
                    className="grid grid-cols-1 md:grid-cols-[auto_1fr_auto_auto_auto_auto] gap-2 md:gap-4 px-6 py-4 items-center hover:bg-brand-muted transition-colors">
                    <span className="font-mono text-xs font-bold text-brand-text">{order.order_number || order.id.slice(0, 8).toUpperCase()}</span>
                    <div className="min-w-0">
                      <p className="text-sm text-brand-text truncate">{order.users?.full_name || "—"}</p>
                      <p className="text-xs text-brand-textLight truncate">{order.users?.email || ""}</p>
                      {!selectedEvent && order.events && (
                        <p className="text-xs text-brand-gold truncate mt-0.5">{order.events.title}</p>
                      )}
                    </div>
                    <span className="text-xs text-brand-textMid whitespace-nowrap">
                      {(order.order_items || []).length} ticket{(order.order_items || []).length !== 1 ? "s" : ""}
                    </span>
                    <span className="text-sm font-semibold text-brand-text whitespace-nowrap">
                      ${parseFloat(order.total || 0).toFixed(2)}
                    </span>
                    <span className={`text-[10px] font-bold px-2 py-1 rounded-full whitespace-nowrap ${
                      order.status === "paid"      ? "bg-teal-50 text-brand-teal" :
                      order.status === "reserved"  ? "bg-amber-50 text-amber-600" :
                      order.status === "cancelled" ? "bg-red-50 text-brand-accent" :
                      order.status === "refunded"  ? "bg-purple-50 text-purple-600" :
                      "bg-brand-muted text-brand-textLight"
                    }`}>
                      {order.status}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
    </div>
  );
}
