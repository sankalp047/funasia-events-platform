import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Calendar, MapPin, Ticket, Globe, ArrowRight } from "lucide-react";
import api from "../utils/api";

const STATUS_COLORS = {
  paid:      "bg-teal-50 text-brand-teal",
  reserved:  "bg-amber-50 text-amber-600",
  cancelled: "bg-red-50 text-brand-accent",
  refunded:  "bg-purple-50 text-purple-600",
  expired:   "bg-brand-muted text-brand-textLight",
};

export default function MyTicketsPage() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    api.get("/orders")
      .then(({ data }) => setOrders(data.orders || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const now = new Date();
  const filtered = orders.filter((o) => {
    if (filter === "upcoming") return o.events?.event_end && new Date(o.events.event_end) >= now && o.status === "paid";
    if (filter === "past") return o.events?.event_end && new Date(o.events.event_end) < now;
    return true;
  });

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-3xl font-bold text-brand-text">My Tickets</h1>
          <p className="text-sm text-brand-textMid mt-1">Your upcoming events and past bookings</p>
        </div>
        <Link to="/events" className="hidden sm:flex items-center gap-1.5 text-sm text-brand-accent font-semibold hover:underline">
          Browse Events <ArrowRight size={14} />
        </Link>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 bg-brand-muted rounded-xl p-1 mb-6 w-fit">
        {["all", "upcoming", "past"].map((tab) => (
          <button key={tab} onClick={() => setFilter(tab)}
            className={`px-4 py-1.5 rounded-lg text-sm font-semibold capitalize transition-colors ${
              filter === tab ? "bg-white text-brand-text shadow-sm" : "text-brand-textMid hover:text-brand-text"
            }`}>
            {tab}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 bg-brand-muted rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-2xl border border-brand-border">
          <Ticket size={48} className="mx-auto text-brand-textLight mb-4" />
          <h3 className="text-lg font-semibold text-brand-text mb-2">No tickets yet</h3>
          <p className="text-sm text-brand-textMid mb-6">Browse events and get your first tickets!</p>
          <Link to="/events" className="px-6 py-3 rounded-xl bg-brand-accent text-white text-sm font-bold hover:bg-brand-accentHover transition-colors">
            Browse Events
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((order) => {
            const evt = order.events;
            const cover = evt?.event_media?.find((m) => m.is_cover)?.url || evt?.event_media?.[0]?.url;
            const isPast = evt?.event_end && new Date(evt.event_end) < now;

            return (
              <Link key={order.id} to={`/order/${order.id}/success`}
                className={`flex gap-4 p-4 bg-white border border-brand-border rounded-2xl hover:shadow-md hover:-translate-y-0.5 transition-all ${isPast ? "opacity-70" : ""}`}>

                {/* Cover */}
                <div className="w-20 h-20 rounded-xl bg-brand-muted overflow-hidden shrink-0">
                  {cover ? (
                    <img src={cover} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-2xl">🎪</div>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-semibold text-brand-text truncate">{evt?.title || "Event"}</h3>
                  <div className="flex flex-wrap gap-3 text-[11px] text-brand-textLight mt-1">
                    {evt?.event_start && (
                      <span className="flex items-center gap-1">
                        <Calendar size={10} />
                        {new Date(evt.event_start).toLocaleDateString("en-US", { timeZone: "America/Chicago", weekday: "short", month: "short", day: "numeric" })}
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      {evt?.is_online ? <Globe size={10} /> : <MapPin size={10} />}
                      {evt?.is_online ? "Online" : evt?.city || "—"}
                    </span>
                  </div>
                  <p className="text-[11px] text-brand-textLight mt-1 font-mono">#{order.order_number}</p>
                </div>

                {/* Status + total */}
                <div className="text-right shrink-0">
                  <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide ${STATUS_COLORS[order.status] || "bg-brand-muted text-brand-textLight"}`}>
                    {order.status}
                  </span>
                  <p className="font-display text-base font-bold text-brand-text mt-1">
                    {parseFloat(order.total) === 0 ? "Free" : `$${parseFloat(order.total).toFixed(2)}`}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
