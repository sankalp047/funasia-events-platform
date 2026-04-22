import { Link, useNavigate } from "react-router-dom";
import logo from "../logo.png";
import { useState, useRef, useEffect, useCallback } from "react";
import {
  Menu, X, MapPin, Ticket, LogOut, ChevronDown,
  Search, Globe, Navigation, CalendarDays,
  HelpCircle, LayoutDashboard, Shield,
} from "lucide-react";
import useAuthStore from "../hooks/useAuthStore";
import api from "../utils/api";

const TX_CITIES = [
  "Fort Worth", "Dallas", "Arlington", "Plano", "Irving",
  "Frisco", "McKinney", "Denton", "Richardson", "Garland",
  "Grand Prairie", "Mesquite", "Carrollton", "Lewisville",
  "San Antonio", "Houston", "Austin",
];

const LOCATION_SPECIAL = [
  { id: "current", label: "Current Location", icon: Navigation },
  { id: "online", label: "Online Events", icon: Globe },
];

export default function Header() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();

  // UI state
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [locationOpen, setLocationOpen] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);

  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);

  // Location state
  const [locationMode, setLocationMode] = useState(() => {
    return localStorage.getItem("funasia_location_mode") || "city";
  });
  const [selectedCity, setSelectedCity] = useState(() => {
    return localStorage.getItem("funasia_city") || "Fort Worth";
  });
  const [cityInput, setCityInput] = useState("");

  // Refs for outside-click
  const locationRef = useRef(null);
  const profileRef = useRef(null);
  const searchRef = useRef(null);
  const searchTimerRef = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (locationRef.current && !locationRef.current.contains(e.target)) setLocationOpen(false);
      if (profileRef.current && !profileRef.current.contains(e.target)) setProfileOpen(false);
      if (searchRef.current && !searchRef.current.contains(e.target)) setSearchFocused(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Auto-detect city on first visit (no saved preference)
  useEffect(() => {
    if (localStorage.getItem("funasia_city")) return;
    navigator.geolocation?.getCurrentPosition(async (pos) => {
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=json&lat=${pos.coords.latitude}&lon=${pos.coords.longitude}`
        );
        const data = await res.json();
        const detected = data.address?.city || data.address?.town || data.address?.suburb;
        if (detected) {
          setSelectedCity(detected);
          localStorage.setItem("funasia_city", detected);
          window.dispatchEvent(new CustomEvent("cityChange", { detail: detected }));
        }
      } catch {
        // keep default
      }
    });
  }, []);

  // Debounced autocomplete
  const fetchAutocomplete = useCallback((q) => {
    clearTimeout(searchTimerRef.current);
    if (q.trim().length < 2) { setSearchResults([]); return; }
    searchTimerRef.current = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const { data } = await api.get(`/events/autocomplete?q=${encodeURIComponent(q)}`);
        setSearchResults(data.results || []);
      } catch {
        setSearchResults([]);
      } finally {
        setSearchLoading(false);
      }
    }, 280);
  }, []);

  const handleSearchChange = (e) => {
    setSearchQuery(e.target.value);
    fetchAutocomplete(e.target.value);
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setSearchFocused(false);
    navigate(`/events?search=${encodeURIComponent(searchQuery.trim())}`);
    setSearchQuery("");
    setSearchResults([]);
  };

  const selectSuggestion = (evt) => {
    setSearchFocused(false);
    setSearchQuery("");
    setSearchResults([]);
    navigate(`/events/${evt.slug || evt.id}`);
  };

  // Location helpers
  const locationLabel = () => {
    if (locationMode === "online") return "Online Events";
    if (locationMode === "current") return "Current Location";
    return `${selectedCity}, TX`;
  };

  const selectLocation = (mode, city) => {
    setLocationMode(mode);
    localStorage.setItem("funasia_location_mode", mode);
    if (city) {
      setSelectedCity(city);
      localStorage.setItem("funasia_city", city);
      window.dispatchEvent(new CustomEvent("cityChange", { detail: city }));
    }
    if (mode === "online") {
      window.dispatchEvent(new CustomEvent("locationModeChange", { detail: { mode: "online" } }));
    } else if (mode === "current") {
      navigator.geolocation?.getCurrentPosition(
        (pos) => {
          window.dispatchEvent(new CustomEvent("locationModeChange", {
            detail: { mode: "current", lat: pos.coords.latitude, lng: pos.coords.longitude },
          }));
        },
        () => {
          window.dispatchEvent(new CustomEvent("locationModeChange", { detail: { mode: "current" } }));
        }
      );
    }
    setLocationOpen(false);
    setCityInput("");
  };

  const filteredCities = cityInput.trim()
    ? TX_CITIES.filter((c) => c.toLowerCase().includes(cityInput.toLowerCase()))
    : TX_CITIES;

  const handleLogout = async () => {
    await logout();
    setProfileOpen(false);
    navigate("/");
  };

  const handleTickets = () => {
    if (user) navigate("/my-tickets");
    else navigate("/login?next=/my-tickets");
  };

  const userInitial = user?.full_name?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || "U";

  return (
    <header className="sticky top-0 z-50 bg-white border-b border-brand-border shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center gap-3 h-16">

        {/* ── Logo ── */}
        <Link to="/" className="flex items-center shrink-0">
          <img src={logo} alt="FunAsia Entertainment" className="h-10 w-auto" />
        </Link>

        {/* ── Search Bar ── */}
        <div ref={searchRef} className="relative flex-1 max-w-xl">
          <form onSubmit={handleSearchSubmit}>
            <div className={`flex items-center gap-2 px-3 py-2 bg-brand-muted border rounded-xl transition-all ${
              searchFocused ? "border-brand-accent ring-2 ring-red-100 bg-white" : "border-brand-border"
            }`}>
              <Search size={16} className="text-brand-textLight shrink-0" />
              <input
                type="text"
                value={searchQuery}
                onChange={handleSearchChange}
                onFocus={() => setSearchFocused(true)}
                placeholder="Search events, artists, venues…"
                className="flex-1 bg-transparent text-sm text-brand-text placeholder-brand-textLight outline-none min-w-0"
              />
              {searchQuery && (
                <button type="button" onClick={() => { setSearchQuery(""); setSearchResults([]); }}
                  className="text-brand-textLight hover:text-brand-text">
                  <X size={14} />
                </button>
              )}
            </div>
          </form>

          {/* Autocomplete dropdown */}
          {searchFocused && (searchResults.length > 0 || (searchQuery.length >= 2 && !searchLoading)) && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-brand-border rounded-xl shadow-xl overflow-hidden animate-slide-up z-50">
              {searchLoading ? (
                <div className="px-4 py-3 text-sm text-brand-textLight">Searching…</div>
              ) : searchResults.length > 0 ? (
                <>
                  {searchResults.map((evt) => (
                    <button key={evt.id} onClick={() => selectSuggestion(evt)}
                      className="w-full text-left px-4 py-3 hover:bg-brand-muted transition-colors flex items-start gap-3 border-b border-brand-border last:border-0">
                      <Search size={14} className="text-brand-textLight mt-0.5 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-brand-text truncate">{evt.title}</p>
                        <p className="text-xs text-brand-textLight">
                          {evt.is_online ? "Online Event" : `${evt.city}, ${evt.state}`}
                          {evt.category && <span className="ml-2 text-brand-gold">· {evt.category}</span>}
                        </p>
                      </div>
                    </button>
                  ))}
                  <button onClick={handleSearchSubmit}
                    className="w-full text-left px-4 py-3 text-sm text-brand-accent font-medium hover:bg-red-50 transition-colors">
                    See all results for "{searchQuery}"
                  </button>
                </>
              ) : (
                <div className="px-4 py-3 text-sm text-brand-textLight">No events found for "{searchQuery}"</div>
              )}
            </div>
          )}
        </div>

        {/* ── Location Selector ── */}
        <div ref={locationRef} className="relative hidden sm:block shrink-0">
          <button onClick={() => setLocationOpen(!locationOpen)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-brand-muted border border-brand-border text-sm font-medium text-brand-text hover:border-brand-textLight transition-colors max-w-[180px]">
            <MapPin size={14} className="text-brand-accent shrink-0" />
            <span className="truncate">{locationLabel()}</span>
            <ChevronDown size={12} className="text-brand-textLight shrink-0" />
          </button>

          {locationOpen && (
            <div className="absolute top-11 left-0 bg-white border border-brand-border rounded-xl shadow-xl p-2 z-50 w-64 animate-slide-up">
              {/* Special options */}
              {LOCATION_SPECIAL.map(({ id, label, icon: Icon }) => (
                <button key={id} onClick={() => selectLocation(id)}
                  className={`w-full text-left px-3 py-2.5 rounded-lg text-sm flex items-center gap-2.5 transition-colors mb-1 ${
                    locationMode === id ? "bg-red-50 text-brand-accent font-semibold" : "text-brand-text hover:bg-brand-muted"
                  }`}>
                  <Icon size={14} />
                  {label}
                </button>
              ))}

              <div className="border-t border-brand-border my-2 pt-2">
                <p className="px-3 text-[10px] uppercase tracking-wider text-brand-textLight font-semibold mb-1">Texas Cities</p>
                {/* City search */}
                <div className="px-1 mb-1">
                  <input type="text" value={cityInput} onChange={(e) => setCityInput(e.target.value)}
                    placeholder="Type a city…"
                    className="w-full px-3 py-1.5 text-sm bg-brand-muted border border-brand-border rounded-lg outline-none focus:border-brand-accent" />
                </div>
                <div className="max-h-44 overflow-y-auto">
                  {filteredCities.map((c) => (
                    <button key={c} onClick={() => selectLocation("city", c)}
                      className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                        locationMode === "city" && c === selectedCity
                          ? "text-brand-accent font-semibold bg-red-50"
                          : "text-brand-text hover:bg-brand-muted"
                      }`}>
                      {c}, TX
                    </button>
                  ))}
                  {filteredCities.length === 0 && (
                    <p className="px-3 py-2 text-sm text-brand-textLight">No cities match</p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── Right Nav ── */}
        <div className="flex items-center gap-2 shrink-0 ml-auto sm:ml-0">

          {/* Create Event */}
          <Link
            to={user?.role === "admin" || user?.role === "super_admin" ? "/organizer/events/new" : "/create-event"}
            className="hidden md:flex items-center gap-1.5 px-4 py-2 rounded-xl bg-brand-accent text-white text-sm font-semibold hover:bg-brand-accentHover transition-colors">
            + Create Event
          </Link>

          {/* Tickets */}
          <button onClick={handleTickets}
            className="hidden md:flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium text-brand-textMid hover:text-brand-text hover:bg-brand-muted transition-colors border border-brand-border">
            <Ticket size={15} />
            Tickets
          </button>

          {/* User menu or Sign In */}
          {user ? (
            <div ref={profileRef} className="relative">
              <button onClick={() => setProfileOpen(!profileOpen)}
                className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-brand-muted hover:bg-brand-border transition-colors border border-brand-border">
                <div className="w-7 h-7 rounded-full bg-brand-accent flex items-center justify-center text-xs font-bold text-white shrink-0">
                  {userInitial}
                </div>
                <div className="hidden lg:block text-left">
                  <p className="text-xs font-semibold text-brand-text leading-tight max-w-[100px] truncate">{user.email}</p>
                </div>
                <ChevronDown size={12} className="text-brand-textLight hidden lg:block" />
              </button>

              {profileOpen && (
                <div className="absolute right-0 top-12 w-60 bg-white border border-brand-border rounded-xl shadow-xl overflow-hidden animate-slide-up z-50">
                  {/* User info */}
                  <div className="p-4 border-b border-brand-border bg-brand-muted">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-brand-accent flex items-center justify-center text-sm font-bold text-white">
                        {userInitial}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-brand-text truncate">{user.full_name || "User"}</p>
                        <p className="text-xs text-brand-textLight truncate">{user.email}</p>
                      </div>
                    </div>
                  </div>

                  {/* Organizer link */}
                  {(user.role === "admin" || user.role === "super_admin") && (
                    <Link to="/organizer" onClick={() => setProfileOpen(false)}
                      className="flex items-center gap-3 px-4 py-3 text-sm text-brand-textMid hover:bg-brand-muted transition-colors border-b border-brand-border">
                      <LayoutDashboard size={15} />
                      Manage my events
                    </Link>
                  )}

                  {/* Super admin */}
                  {user.role === "super_admin" && (
                    <Link to="/super-admin" onClick={() => setProfileOpen(false)}
                      className="flex items-center gap-3 px-4 py-3 text-sm text-brand-gold hover:bg-brand-goldBg transition-colors border-b border-brand-border">
                      <Shield size={15} />
                      Platform Admin
                    </Link>
                  )}

                  <Link to="/my-tickets" onClick={() => setProfileOpen(false)}
                    className="flex items-center gap-3 px-4 py-3 text-sm text-brand-textMid hover:bg-brand-muted transition-colors">
                    <Ticket size={15} />
                    My Tickets
                  </Link>
                  <a href="mailto:support@funasia.events" onClick={() => setProfileOpen(false)}
                    className="flex items-center gap-3 px-4 py-3 text-sm text-brand-textMid hover:bg-brand-muted transition-colors">
                    <HelpCircle size={15} />
                    Get Help
                  </a>
                  <button onClick={handleLogout}
                    className="w-full flex items-center gap-3 px-4 py-3 text-sm text-brand-accent hover:bg-red-50 transition-colors border-t border-brand-border">
                    <LogOut size={15} />
                    Sign Out
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link to="/login" className="hidden md:inline px-3 py-2 text-sm text-brand-textMid hover:text-brand-text font-medium transition-colors">
                Sign In
              </Link>
              <Link to="/register" className="hidden md:inline px-4 py-2 rounded-xl bg-brand-accent text-white text-sm font-semibold hover:bg-brand-accentHover transition-colors">
                Sign Up
              </Link>
            </div>
          )}

          {/* Mobile hamburger */}
          <button onClick={() => setMobileOpen(!mobileOpen)} className="md:hidden p-2 text-brand-textMid rounded-lg hover:bg-brand-muted">
            {mobileOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>

      {/* ── Mobile Nav ── */}
      {mobileOpen && (
        <div className="md:hidden border-t border-brand-border bg-white animate-slide-up">
          <div className="p-4 space-y-1">
            {/* Location mode */}
            <div className="px-3 py-2 mb-2">
              <p className="text-xs text-brand-textLight uppercase tracking-wider font-semibold mb-2">Location</p>
              <div className="flex flex-wrap gap-2">
                {LOCATION_SPECIAL.map(({ id, label }) => (
                  <button key={id} onClick={() => { selectLocation(id); setMobileOpen(false); }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium ${
                      locationMode === id ? "bg-brand-accent text-white" : "bg-brand-muted text-brand-textMid"
                    }`}>{label}</button>
                ))}
              </div>
              <div className="flex flex-wrap gap-2 mt-2">
                {TX_CITIES.slice(0, 8).map((c) => (
                  <button key={c} onClick={() => { selectLocation("city", c); setMobileOpen(false); }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium ${
                      locationMode === "city" && c === selectedCity ? "bg-brand-accent text-white" : "bg-brand-muted text-brand-textMid"
                    }`}>{c}</button>
                ))}
              </div>
            </div>

            <Link
              to={user?.role === "admin" || user?.role === "super_admin" ? "/organizer/events/new" : "/create-event"}
              onClick={() => setMobileOpen(false)}
              className="block px-4 py-3 rounded-xl text-sm font-semibold text-white bg-brand-accent text-center mb-2">
              + Create Event
            </Link>
            <button onClick={() => { setMobileOpen(false); handleTickets(); }}
              className="w-full text-left px-4 py-3 rounded-lg text-sm text-brand-textMid hover:bg-brand-muted flex items-center gap-2">
              <Ticket size={15} /> Tickets
            </button>

            {user ? (
              <>
                <div className="px-4 py-2 border-t border-brand-border mt-1">
                  <p className="text-xs text-brand-textLight">{user.email}</p>
                </div>
                {(user.role === "admin" || user.role === "super_admin") && (
                  <Link to="/organizer" onClick={() => setMobileOpen(false)}
                    className="flex items-center gap-2 px-4 py-3 rounded-lg text-sm text-brand-textMid hover:bg-brand-muted">
                    <LayoutDashboard size={15} /> Manage my events
                  </Link>
                )}
                <Link to="/my-tickets" onClick={() => setMobileOpen(false)}
                  className="flex items-center gap-2 px-4 py-3 rounded-lg text-sm text-brand-textMid hover:bg-brand-muted">
                  <Ticket size={15} /> My Tickets
                </Link>
                <a href="mailto:support@funasia.events" onClick={() => setMobileOpen(false)}
                  className="flex items-center gap-2 px-4 py-3 rounded-lg text-sm text-brand-textMid hover:bg-brand-muted">
                  <HelpCircle size={15} /> Get Help
                </a>
                <button onClick={() => { handleLogout(); setMobileOpen(false); }}
                  className="w-full text-left flex items-center gap-2 px-4 py-3 rounded-lg text-sm text-brand-accent hover:bg-red-50">
                  <LogOut size={15} /> Sign Out
                </button>
              </>
            ) : (
              <>
                <Link to="/login" onClick={() => setMobileOpen(false)} className="block px-4 py-3 rounded-lg text-sm text-brand-textMid hover:bg-brand-muted">Sign In</Link>
                <Link to="/register" onClick={() => setMobileOpen(false)} className="block px-4 py-3 rounded-lg text-sm text-brand-accent font-semibold">Sign Up</Link>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
