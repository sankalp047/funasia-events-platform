import { useState, useEffect, useRef, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Calendar, MapPin, Star, ArrowRight, ChevronLeft, ChevronRight,
  Music, Moon, Smile, Briefcase, PersonStanding, Globe, Ticket,
} from "lucide-react";
import api from "../utils/api";

// ─── Category config ───
const CATEGORIES = [
  { id: "Music",     label: "Music",      icon: Music,          color: "bg-pink-50 text-pink-600 border-pink-200 hover:bg-pink-100" },
  { id: "Nightlife", label: "Nightlife",  icon: Moon,           color: "bg-purple-50 text-purple-600 border-purple-200 hover:bg-purple-100" },
  { id: "Hobbies",   label: "Hobbies",    icon: Smile,          color: "bg-amber-50 text-amber-600 border-amber-200 hover:bg-amber-100" },
  { id: "Business",  label: "Business",   icon: Briefcase,      color: "bg-blue-50 text-blue-600 border-blue-200 hover:bg-blue-100" },
  { id: "Dance",     label: "Dance",      icon: PersonStanding, color: "bg-teal-50 text-teal-600 border-teal-200 hover:bg-teal-100" },
];

const CITY_SECTIONS = ["San Antonio", "Houston", "Dallas", "Austin"];

const CITY_PAGE_SIZE = 4; // initial visible
const MAIN_PAGE_SIZES = [4, 16]; // [initial, max with show-more]

export default function HomePage() {
  const navigate = useNavigate();
  const [city, setCity] = useState(() => localStorage.getItem("funasia_city") || "Fort Worth");
  const [locationMode, setLocationMode] = useState(() => localStorage.getItem("funasia_location_mode") || "city");

  // All events store
  const [allEvents, setAllEvents] = useState([]);
  const [citySection, setCitySectionEvents] = useState({});
  const [loading, setLoading] = useState(true);
  const [cityLoading, setCityLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);

  // Active category filter (null = all)
  const [activeCategory, setActiveCategory] = useState(null);

  // Main city section pagination
  const [mainVisible, setMainVisible] = useState(MAIN_PAGE_SIZES[0]);

  // Carousel state
  const [carouselIdx, setCarouselIdx] = useState(0);
  const carouselTimer = useRef(null);

  // ── Listen for location mode & city changes ──
  useEffect(() => {
    const cityHandler = (e) => { setCity(e.detail); setLocationMode("city"); setMainVisible(MAIN_PAGE_SIZES[0]); };
    const modeHandler = (e) => setLocationMode(e.detail.mode);
    window.addEventListener("cityChange", cityHandler);
    window.addEventListener("locationModeChange", modeHandler);
    return () => {
      window.removeEventListener("cityChange", cityHandler);
      window.removeEventListener("locationModeChange", modeHandler);
    };
  }, []);

  // ── Fetch main events ──
  const fetchMainEvents = useCallback(async () => {
    setLoading(true);
    setFetchError(false);
    try {
      const params = { limit: 50, sort: "date_asc" };
      if (locationMode === "online") params.is_online = true;
      else if (locationMode === "city") params.city = city;
      const { data } = await api.get("/events", { params });
      setAllEvents(data.events || []);
      setCarouselIdx(0);
    } catch (err) {
      console.error("Failed to load events:", err);
      setFetchError(true);
    } finally {
      setLoading(false);
    }
  }, [city, locationMode]);

  useEffect(() => {
    fetchMainEvents();
  }, [fetchMainEvents]);

  // ── Fetch 4 Texas city sections ──
  useEffect(() => {
    const fetchCities = async () => {
      setCityLoading(true);
      try {
        const results = await Promise.all(
          CITY_SECTIONS.map((c) => {
            const params = { city: c, state: "TX", limit: 4, sort: "date_asc" };
            if (activeCategory) params.category = activeCategory;
            return api.get("/events", { params })
              .then((r) => ({ city: c, events: r.data.events || [] }))
              .catch(() => ({ city: c, events: [] }));
          })
        );
        const map = {};
        results.forEach(({ city: c, events }) => { map[c] = events; });
        setCitySectionEvents(map);
      } finally {
        setCityLoading(false);
      }
    };
    fetchCities();
  }, [activeCategory]);

  // ── Derived data ──
  const sponsoredEvents = allEvents.filter((e) => e.is_sponsored);

  const mainEvents = allEvents.filter((e) => {
    if (activeCategory && e.category !== activeCategory) return false;
    return true;
  });

  const visibleMainEvents = mainEvents.slice(0, mainVisible);
  const hasMore = mainEvents.length > mainVisible;

  // ── Carousel auto-advance ──
  const startCarousel = useCallback(() => {
    clearInterval(carouselTimer.current);
    if (sponsoredEvents.length > 1) {
      carouselTimer.current = setInterval(() => {
        setCarouselIdx((i) => (i + 1) % sponsoredEvents.length);
      }, 5000);
    }
  }, [sponsoredEvents.length]);

  useEffect(() => {
    startCarousel();
    return () => clearInterval(carouselTimer.current);
  }, [startCarousel]);

  const prevSlide = () => {
    setCarouselIdx((i) => (i - 1 + sponsoredEvents.length) % sponsoredEvents.length);
    startCarousel();
  };
  const nextSlide = () => {
    setCarouselIdx((i) => (i + 1) % sponsoredEvents.length);
    startCarousel();
  };

  const sectionTitle = () => {
    if (locationMode === "online") return "Online Events";
    if (locationMode === "current") return `Events Near You`;
    return `Events in ${city}`;
  };

  return (
    <div className="min-h-screen bg-brand-bg">

      {/* ────────────────────────────────────────────
          SPONSORED CAROUSEL
      ──────────────────────────────────────────── */}
      {sponsoredEvents.length > 0 && (
        <section className="relative w-full overflow-hidden bg-brand-dark" style={{ height: "420px" }}>
          {sponsoredEvents.map((evt, idx) => (
            <div key={evt.id}
              className={`absolute inset-0 transition-opacity duration-700 ${idx === carouselIdx ? "opacity-100 z-10" : "opacity-0 z-0"}`}>
              <img
                src={evt.cover_image || "https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=1600&q=80"}
                alt={evt.title}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-6 sm:p-10 max-w-3xl">
                <span className="inline-flex items-center gap-1 text-xs font-bold text-brand-gold bg-black/40 border border-brand-gold px-2.5 py-1 rounded-full mb-3">
                  <Star size={10} fill="currentColor" /> Sponsored
                </span>
                <h2 className="font-display text-2xl sm:text-4xl font-extrabold text-white leading-tight mb-2">
                  {evt.title}
                </h2>
                <p className="text-sm text-white/70 mb-4 line-clamp-2">{evt.short_description || evt.description}</p>
                <div className="flex items-center gap-4 text-xs text-white/60 mb-5">
                  <span className="flex items-center gap-1.5">
                    <Calendar size={12} />
                    {new Date(evt.event_start).toLocaleDateString("en-US", { timeZone: "America/Chicago", weekday: "short", month: "long", day: "numeric" })}
                  </span>
                  <span className="flex items-center gap-1.5">
                    {evt.is_online ? <Globe size={12} /> : <MapPin size={12} />}
                    {evt.is_online ? "Online Event" : `${evt.venue_name}, ${evt.city}`}
                  </span>
                </div>
                <Link to={`/events/${evt.slug || evt.id}`}
                  className="inline-flex items-center gap-2 px-6 py-3 bg-brand-accent text-white text-sm font-bold rounded-xl hover:bg-brand-accentHover transition-colors">
                  Get Tickets <ArrowRight size={14} />
                </Link>
              </div>
            </div>
          ))}

          {/* Arrows */}
          {sponsoredEvents.length > 1 && (
            <>
              <button onClick={prevSlide}
                className="absolute left-4 top-1/2 -translate-y-1/2 z-20 w-9 h-9 bg-white/20 hover:bg-white/30 backdrop-blur-sm rounded-full flex items-center justify-center text-white transition-colors">
                <ChevronLeft size={18} />
              </button>
              <button onClick={nextSlide}
                className="absolute right-4 top-1/2 -translate-y-1/2 z-20 w-9 h-9 bg-white/20 hover:bg-white/30 backdrop-blur-sm rounded-full flex items-center justify-center text-white transition-colors">
                <ChevronRight size={18} />
              </button>
              {/* Dots */}
              <div className="absolute bottom-4 right-6 z-20 flex items-center gap-1.5">
                {sponsoredEvents.map((_, i) => (
                  <button key={i} onClick={() => { setCarouselIdx(i); startCarousel(); }}
                    className={`rounded-full transition-all ${i === carouselIdx ? "w-6 h-2 bg-white" : "w-2 h-2 bg-white/40"}`} />
                ))}
              </div>
            </>
          )}
        </section>
      )}

      {/* ────────────────────────────────────────────
          CATEGORY FILTER BUTTONS
      ──────────────────────────────────────────── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 pt-8">
        <div className="flex items-center gap-2 sm:gap-3 overflow-x-auto pb-1 scrollbar-hide">
          <button
            onClick={() => { setActiveCategory(null); setMainVisible(MAIN_PAGE_SIZES[0]); }}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold border whitespace-nowrap transition-all shrink-0 ${
              activeCategory === null
                ? "bg-brand-accent text-white border-brand-accent"
                : "bg-white text-brand-textMid border-brand-border hover:border-brand-accent hover:text-brand-accent"
            }`}>
            All Events
          </button>
          {CATEGORIES.map(({ id, label, icon: Icon, color }) => (
            <button key={id}
              onClick={() => { setActiveCategory(activeCategory === id ? null : id); setMainVisible(MAIN_PAGE_SIZES[0]); }}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold border whitespace-nowrap transition-all shrink-0 ${
                activeCategory === id
                  ? "bg-brand-accent text-white border-brand-accent"
                  : `bg-white border-brand-border ${color}`
              }`}>
              <Icon size={15} />
              {label}
            </button>
          ))}
        </div>
      </section>

      {/* ────────────────────────────────────────────
          MAIN CITY EVENTS GRID (4 → show more → 16)
      ──────────────────────────────────────────── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 pt-8">
        <div className="flex items-baseline justify-between mb-5">
          <div>
            <h2 className="font-display text-2xl font-bold text-brand-text">{sectionTitle()}</h2>
            {!loading && (
              <p className="text-xs text-brand-textLight mt-1">
                {mainEvents.length} event{mainEvents.length !== 1 ? "s" : ""}
                {activeCategory ? ` in ${activeCategory}` : ""}
              </p>
            )}
          </div>
          <Link to={`/events${city ? `?city=${encodeURIComponent(city)}` : ""}`}
            className="text-sm text-brand-accent font-semibold hover:underline flex items-center gap-1">
            View all <ArrowRight size={14} />
          </Link>
        </div>

        {loading ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-64 bg-brand-muted rounded-2xl animate-pulse" />
            ))}
          </div>
        ) : fetchError ? (
          <div className="text-center py-14 bg-white rounded-2xl border border-brand-border">
            <p className="text-brand-textMid text-sm mb-4">Could not load events. Check your connection and try again.</p>
            <button
              onClick={fetchMainEvents}
              className="px-5 py-2.5 rounded-xl bg-brand-accent text-white text-sm font-bold hover:bg-brand-accentHover transition-colors">
              Retry
            </button>
          </div>
        ) : visibleMainEvents.length === 0 ? (
          <div className="text-center py-14 bg-white rounded-2xl border border-brand-border">
            <Ticket size={32} className="text-brand-textLight mx-auto mb-3" />
            <p className="text-brand-textMid text-sm">No events found{activeCategory ? ` for ${activeCategory}` : ""}.</p>
            {activeCategory && (
              <button onClick={() => setActiveCategory(null)} className="mt-3 text-sm text-brand-accent font-semibold hover:underline">
                Clear filter
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {visibleMainEvents.map((evt) => <EventCard key={evt.id} event={evt} />)}
            </div>
            {hasMore && (
              <div className="text-center mt-6">
                <button
                  onClick={() => setMainVisible(MAIN_PAGE_SIZES[1])}
                  className="px-8 py-3 rounded-xl border-2 border-brand-accent text-brand-accent text-sm font-bold hover:bg-brand-accent hover:text-white transition-all">
                  Show More Events
                </button>
              </div>
            )}
          </>
        )}
      </section>

      {/* ────────────────────────────────────────────
          TEXAS CITY SECTIONS
      ──────────────────────────────────────────── */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-12 pb-16 space-y-10">
        {CITY_SECTIONS.map((sectionCity) => {
          const sectionEvents = (citySection[sectionCity] || []).filter((e) => {
            if (locationMode === "online") return e.is_online;
            if (activeCategory) return e.category === activeCategory;
            return true;
          });

          return (
            <section key={sectionCity}>
              <div className="flex items-baseline justify-between mb-4">
                <div>
                  <h2 className="font-display text-xl font-bold text-brand-text">{sectionCity}</h2>
                  <p className="text-xs text-brand-textLight mt-0.5">Events in {sectionCity}, TX</p>
                </div>
                <Link
                  to={`/events?city=${encodeURIComponent(sectionCity)}${locationMode === "online" ? "&is_online=true" : ""}${activeCategory ? `&category=${activeCategory}` : ""}`}
                  className="text-sm text-brand-accent font-semibold hover:underline flex items-center gap-1 shrink-0">
                  See all <ArrowRight size={14} />
                </Link>
              </div>

              {cityLoading ? (
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  {[1, 2, 3, 4].map((i) => <div key={i} className="h-56 bg-brand-muted rounded-2xl animate-pulse" />)}
                </div>
              ) : sectionEvents.length === 0 ? (
                <div className="py-8 text-center bg-white rounded-xl border border-brand-border">
                  <p className="text-sm text-brand-textLight">No events in {sectionCity} right now.</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  {sectionEvents.slice(0, 4).map((evt) => <EventCard key={evt.id} event={evt} compact />)}
                </div>
              )}
            </section>
          );
        })}
      </div>

    </div>
  );
}

// ─────────────────────────────────────────────────
// EventCard component
// ─────────────────────────────────────────────────
export function EventCard({ event, sponsored, compact }) {
  const pct = event.total_seats > 0 ? Math.round((event.total_sold / event.total_seats) * 100) : 0;
  const remaining = (event.total_seats || 0) - (event.total_sold || 0);
  const isPast = event.is_past || event.status === "completed" || event.status === "cancelled";

  return (
    <Link to={`/events/${event.slug || event.id}`}
      className={`group block bg-white rounded-2xl border border-brand-border overflow-hidden hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 ${isPast ? "opacity-70" : ""}`}>

      {/* Image */}
      <div className={`relative overflow-hidden ${compact ? "h-36" : "h-44 sm:h-48"}`}>
        <img
          src={event.cover_image || "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=800&q=80"}
          alt={event.title}
          className={`w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 ${isPast ? "grayscale-[30%]" : ""}`}
        />

        {/* Badges */}
        <div className="absolute top-2.5 left-2.5 flex flex-col gap-1">
          {event.status === "cancelled" ? (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-red-600 text-white text-[10px] font-bold">
              Cancelled
            </span>
          ) : event.status === "completed" || event.is_past ? (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-gray-500 text-white text-[10px] font-bold">
              Completed
            </span>
          ) : (
            <>
              {(event.is_sponsored || sponsored) && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-brand-gold text-white text-[10px] font-bold">
                  <Star size={8} fill="currentColor" /> Sponsored
                </span>
              )}
              {event.ticket_type === "free" && (
                <span className="px-2 py-0.5 rounded-full bg-brand-teal text-white text-[10px] font-bold">Free</span>
              )}
              {event.is_online && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-500 text-white text-[10px] font-bold">
                  <Globe size={8} /> Online
                </span>
              )}
            </>
          )}
        </div>

        {/* Price pill — hidden for past events */}
        {!isPast && (
          <div className="absolute bottom-2.5 right-2.5 bg-white/95 backdrop-blur-sm px-2.5 py-1 rounded-lg shadow">
            <span className="font-display text-sm font-bold text-brand-text">
              {event.ticket_type === "free" || event.min_price === 0 ? "Free" : `$${event.min_price}`}
            </span>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-3 sm:p-4">
        {event.category && (
          <span className="inline-block text-[10px] font-bold text-brand-textLight uppercase tracking-wider mb-1">
            {event.category}
          </span>
        )}
        <h3 className="font-display text-sm sm:text-base font-bold text-brand-text leading-snug line-clamp-1 mb-1">
          {event.title}
        </h3>

        <div className="flex items-center gap-3 text-[11px] text-brand-textLight">
          <span className="flex items-center gap-1">
            <Calendar size={10} />
            {new Date(event.event_start).toLocaleDateString("en-US", { timeZone: "America/Chicago", month: "short", day: "numeric" })}
          </span>
          <span className="flex items-center gap-1 truncate">
            {event.is_online ? <Globe size={10} /> : <MapPin size={10} />}
            {event.is_online ? "Online" : `${event.city}`}
          </span>
        </div>

        {/* Availability bar */}
        {!compact && event.total_seats > 0 && (
          <div className="mt-2.5">
            <div className="h-1 rounded-full bg-brand-muted overflow-hidden">
              <div className="h-full rounded-full transition-all"
                style={{ width: `${pct}%`, background: pct > 80 ? "#DC3545" : "#0D9488" }} />
            </div>
            <p className="text-[10px] text-brand-textLight mt-1">
              {remaining > 0 ? `${remaining.toLocaleString()} tickets left` : "Sold out"}
            </p>
          </div>
        )}
      </div>
    </Link>
  );
}
