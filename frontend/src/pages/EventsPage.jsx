import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Search, MapPin, SlidersHorizontal } from "lucide-react";
import api from "../utils/api";
import { EventCard } from "./HomePage";

const CATEGORIES = [
  { id: "", label: "All Events" },
  { id: "concerts", label: "🎵 Concerts" },
  { id: "cultural", label: "🪔 Cultural" },
  { id: "conferences", label: "🎤 Conferences" },
  { id: "sports", label: "⚽ Sports" },
];

export default function EventsPage() {
  const [searchParams] = useSearchParams();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);

  const [search, setSearch] = useState(searchParams.get("search") || "");
  const [category, setCategory] = useState(searchParams.get("category") || "");
  const [ticketType, setTicketType] = useState("");
  const [sort, setSort] = useState("date_asc");
  const [city] = useState(() => localStorage.getItem("funasia_city") || "Fort Worth");

  useEffect(() => { fetchEvents(); }, [category, ticketType, sort, page]);

  const fetchEvents = async () => {
    setLoading(true);
    try {
      const params = { page, limit: 18, sort };
      if (category) params.category = category;
      if (ticketType) params.ticket_type = ticketType;
      if (search) params.search = search;
      const { data } = await api.get("/events", { params });
      setEvents(data.events || []);
      setTotal(data.total || 0);
    } catch (err) {
      console.error("Failed to load events:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e) => { e.preventDefault(); setPage(1); fetchEvents(); };

  // Split into city and nearby
  const cityEvents = events.filter((e) => e.city?.toLowerCase() === city.toLowerCase());
  const nearbyEvents = events.filter((e) => e.city?.toLowerCase() !== city.toLowerCase());

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 animate-fade-in">
      <h1 className="font-display text-3xl font-bold text-brand-text mb-1">Events</h1>
      <p className="text-sm text-brand-textLight mb-6">
        Showing events near {city}, TX
      </p>

      {/* Search + Filters */}
      <div className="flex flex-wrap gap-2 mb-6 items-center">
        <form onSubmit={handleSearch} className="flex-1 min-w-[200px] relative">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-brand-textLight" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search events, artists, venues..."
            className="input-field pl-10" />
        </form>

        <div className="flex gap-2 flex-wrap">
          {CATEGORIES.map((c) => (
            <button key={c.id} onClick={() => { setCategory(c.id); setPage(1); }}
              className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-all whitespace-nowrap ${
                category === c.id
                  ? "bg-brand-accent text-white shadow-sm"
                  : "bg-white border border-brand-border text-brand-textMid hover:border-brand-textLight"
              }`}>{c.label}</button>
          ))}
        </div>

        <div className="flex gap-2">
          <select value={ticketType} onChange={(e) => { setTicketType(e.target.value); setPage(1); }}
            className="px-3 py-2.5 bg-white border border-brand-border rounded-xl text-sm text-brand-textMid outline-none">
            <option value="">All Types</option>
            <option value="free">Free</option>
            <option value="paid">Paid</option>
          </select>

          <select value={sort} onChange={(e) => setSort(e.target.value)}
            className="px-3 py-2.5 bg-white border border-brand-border rounded-xl text-sm text-brand-textMid outline-none">
            <option value="date_asc">Soonest First</option>
            <option value="date_desc">Latest First</option>
          </select>
        </div>
      </div>

      {/* Results */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => <div key={i} className="h-72 bg-brand-muted rounded-2xl animate-pulse" />)}
        </div>
      ) : events.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-4xl mb-3">🔍</p>
          <h3 className="text-lg font-semibold text-brand-text mb-1">No events found</h3>
          <p className="text-sm text-brand-textLight">Try a different search, category, or city.</p>
        </div>
      ) : (
        <>
          {/* City Events */}
          {cityEvents.length > 0 && (
            <div className="mb-8">
              <h2 className="font-display text-lg font-bold text-brand-text mb-3 flex items-center gap-1.5">
                <MapPin size={16} className="text-brand-accent" /> In {city}
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {cityEvents.map((evt) => <EventCard key={evt.id} event={evt} />)}
              </div>
            </div>
          )}

          {/* Nearby */}
          {nearbyEvents.length > 0 && (
            <div>
              <h2 className="font-display text-lg font-bold text-brand-text mb-3">Nearby</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {nearbyEvents.map((evt) => <EventCard key={evt.id} event={evt} />)}
              </div>
            </div>
          )}

          {/* Pagination */}
          {total > 18 && (
            <div className="flex justify-center gap-2 mt-10">
              <button disabled={page === 1} onClick={() => setPage(page - 1)}
                className="px-4 py-2 text-sm bg-white border border-brand-border rounded-lg text-brand-textMid disabled:opacity-30">Previous</button>
              <span className="px-4 py-2 text-sm text-brand-textLight">Page {page} of {Math.ceil(total / 18)}</span>
              <button disabled={page * 18 >= total} onClick={() => setPage(page + 1)}
                className="px-4 py-2 text-sm bg-white border border-brand-border rounded-lg text-brand-textMid disabled:opacity-30">Next</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
