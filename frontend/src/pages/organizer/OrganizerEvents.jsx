import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Plus, CalendarDays, Globe, ArrowRight, Search, Pause, Play } from "lucide-react";
import api from "../../utils/api";
import toast from "react-hot-toast";

const STATUS_TABS = [
  { id: "",          label: "All" },
  { id: "published", label: "Published" },
  { id: "draft",     label: "Drafts" },
  { id: "cancelled", label: "Cancelled" },
];

export default function OrganizerEvents() {
  const navigate = useNavigate();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [total, setTotal] = useState(0);

  const loadEvents = async () => {
    setLoading(true);
    setFetchError(false);
    try {
      const { data } = await api.get("/organizer/events", {
        params: { status: status || undefined, limit: 50 },
      });
      setEvents(data.events || []);
      setTotal(data.total || 0);
    } catch (err) {
      console.error("Fetch events error:", err);
      setFetchError(true);
      toast.error("Could not load events. Tap retry.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEvents();
  }, [status]);

  const filtered = search.trim()
    ? events.filter((e) => e.title.toLowerCase().includes(search.toLowerCase()))
    : events;

  const handlePublish = async (eventId) => {
    try {
      await api.post(`/organizer/events/${eventId}/publish`);
      setEvents((prev) => prev.map((e) => e.id === eventId ? { ...e, status: "published" } : e));
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to publish");
    }
  };

  const handleToggleSales = async (eventId, currentPaused) => {
    try {
      const { data } = await api.patch(`/organizer/events/${eventId}/sales`);
      setEvents((prev) => prev.map((e) => e.id === eventId ? { ...e, sales_paused: data.sales_paused } : e));
      toast.success(data.sales_paused ? "Ticket sales paused" : "Ticket sales resumed");
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to update sales status");
    }
  };

  return (
    <div className="p-6 md:p-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-2xl font-bold text-brand-text">Events</h1>
          <p className="text-sm text-brand-textMid mt-0.5">
            {loading ? (
              <span className="inline-block h-3.5 w-20 bg-brand-muted rounded animate-pulse align-middle" />
            ) : (
              `${total} event${total !== 1 ? "s" : ""} total`
            )}
          </p>
        </div>
        <button onClick={() => navigate("/organizer/events/new")}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-brand-accent text-white text-sm font-bold hover:bg-brand-accentHover transition-colors">
          <Plus size={15} /> Create Event
        </button>
      </div>

      {/* Search + Status tabs */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-textLight" />
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search events…"
            className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-brand-border bg-brand-muted text-sm outline-none focus:border-brand-accent focus:bg-white transition-colors" />
        </div>
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

      {/* Table */}
      <div className="bg-white rounded-2xl border border-brand-border overflow-hidden">
        {loading ? (
          <div className="divide-y divide-brand-border">
            {/* Match the header row */}
            <div className="hidden md:grid grid-cols-[1fr_auto_auto_auto_auto] gap-4 px-6 py-3 bg-brand-muted">
              {["Event", "Date", "Tickets", "Status", ""].map((h, i) => (
                <div key={i} className={`h-3 bg-gray-200 rounded animate-pulse ${i === 0 ? "w-24" : "w-12"}`} />
              ))}
            </div>
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="grid grid-cols-1 md:grid-cols-[1fr_auto_auto_auto_auto] gap-2 md:gap-4 px-6 py-4 items-center">
                <div className="space-y-1.5">
                  <div className="h-4 bg-brand-muted rounded animate-pulse w-3/5" />
                  <div className="h-3 bg-brand-muted rounded animate-pulse w-2/5" />
                </div>
                <div className="h-3 bg-brand-muted rounded animate-pulse w-20 hidden md:block" />
                <div className="h-3 bg-brand-muted rounded animate-pulse w-14 hidden md:block" />
                <div className="h-5 bg-brand-muted rounded-full animate-pulse w-16 hidden md:block" />
                <div className="h-3 bg-brand-muted rounded animate-pulse w-10 hidden md:block" />
              </div>
            ))}
          </div>
        ) : fetchError ? (
          <div className="text-center py-16">
            <p className="text-sm text-brand-textMid mb-3">Something went wrong loading your events.</p>
            <button onClick={loadEvents}
              className="text-sm font-semibold text-brand-accent hover:underline">
              Retry
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <CalendarDays size={36} className="text-brand-textLight mx-auto mb-3" />
            <p className="text-sm text-brand-textMid">
              {search.trim() ? `No events matching "${search}"` : "No events found."}
            </p>
            {!search.trim() && (
              <button onClick={() => navigate("/organizer/events/new")}
                className="mt-4 text-sm text-brand-accent font-semibold hover:underline">
                Create your first event
              </button>
            )}
          </div>
        ) : (
          <div className="divide-y divide-brand-border">
            {/* Table header */}
            <div className="hidden md:grid grid-cols-[1fr_auto_auto_auto_auto] gap-4 px-6 py-3 text-[11px] font-semibold text-brand-textLight uppercase tracking-wider bg-brand-muted">
              <span>Event</span>
              <span>Date</span>
              <span>Tickets</span>
              <span>Status</span>
              <span></span>
            </div>

            {filtered.map((evt) => {
              const pct = evt.total_tickets > 0 ? Math.round((evt.tickets_sold / evt.total_tickets) * 100) : 0;
              return (
                <div key={evt.id} className="grid grid-cols-1 md:grid-cols-[1fr_auto_auto_auto_auto] gap-2 md:gap-4 px-6 py-4 items-center hover:bg-brand-muted transition-colors">
                  {/* Title */}
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-brand-text truncate">{evt.title}</p>
                      {evt.is_online && (
                        <span className="inline-flex items-center gap-1 text-[10px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded-full font-bold">
                          <Globe size={9} /> Online
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-brand-textLight truncate">{evt.city}, {evt.state} · {evt.category || "Uncategorized"}</p>
                  </div>

                  {/* Date */}
                  <div className="text-xs text-brand-textMid whitespace-nowrap">
                    {new Date(evt.event_start).toLocaleDateString("en-US", { timeZone: "America/Chicago", month: "short", day: "numeric", year: "numeric" })}
                  </div>

                  {/* Tickets */}
                  <div className="text-xs text-brand-textMid whitespace-nowrap">
                    <span className="font-semibold text-brand-text">{evt.tickets_sold}</span> / {evt.total_tickets}
                    <div className="w-16 h-1 bg-brand-muted rounded-full mt-1">
                      <div className="h-full rounded-full"
                        style={{ width: `${pct}%`, background: pct > 80 ? "#DC3545" : "#0D9488" }} />
                    </div>
                  </div>

                  {/* Status */}
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${
                      evt.status === "published" && !evt.sales_paused ? "bg-teal-50 text-brand-teal" :
                      evt.status === "published" && evt.sales_paused ? "bg-amber-50 text-amber-600" :
                      evt.status === "draft" ? "bg-brand-muted text-brand-textLight" :
                      "bg-red-50 text-brand-accent"
                    }`}>
                      {evt.status === "published" && evt.sales_paused ? "Sales Paused" : evt.status}
                    </span>
                    {evt.status === "draft" && (
                      <button onClick={() => handlePublish(evt.id)}
                        className="text-[10px] font-bold text-brand-accent hover:underline">
                        Publish
                      </button>
                    )}
                    {evt.status === "published" && new Date(evt.event_end) > new Date() && (
                      <button
                        onClick={() => handleToggleSales(evt.id, evt.sales_paused)}
                        title={evt.sales_paused ? "Resume ticket sales" : "Pause ticket sales"}
                        className={`flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-lg border transition-colors ${
                          evt.sales_paused
                            ? "border-brand-teal text-brand-teal hover:bg-teal-50"
                            : "border-amber-400 text-amber-600 hover:bg-amber-50"
                        }`}>
                        {evt.sales_paused ? <><Play size={9} /> Resume</> : <><Pause size={9} /> Pause</>}
                      </button>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    <Link to={`/organizer/orders?event=${evt.id}`}
                      className="text-xs text-brand-textLight hover:text-brand-text transition-colors">
                      Orders
                    </Link>
                    <Link to={`/events/${evt.slug || evt.id}`} target="_blank"
                      className="text-brand-textLight hover:text-brand-text">
                      <ArrowRight size={14} />
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
