import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Plus, Trash2, Check, ChevronDown } from "lucide-react";
import api from "../../utils/api";
import toast from "react-hot-toast";
import { centralInputToUtc, utcToCentralInput } from "../../utils/dateUtils";

const TX_CITIES = [
  "Abilene","Allen","Amarillo","Arlington","Austin","Beaumont","Bedford","Brownsville","Bryan","Carrollton",
  "Cedar Park","Cleburne","College Station","Conroe","Corpus Christi","Dallas","Denton","DeSoto","Edinburg","El Paso",
  "Euless","Flower Mound","Fort Worth","Frisco","Galveston","Garland","Georgetown","Grand Prairie","Grapevine","Harlingen",
  "Houston","Hurst","Irving","Katy","Killeen","Kyle","Laredo","League City","Lewisville","Longview",
  "Lubbock","Lufkin","Mansfield","McAllen","McKinney","Mesquite","Midland","Mission","Missouri City","New Braunfels",
  "North Richland Hills","Odessa","Pasadena","Pearland","Pflugerville","Plano","Port Arthur","Richardson","Rockwall","Round Rock",
  "Rowlett","San Angelo","San Antonio","San Marcos","Sherman","Spring","Sugar Land","Temple","Texarkana","The Colony",
  "The Woodlands","Tyler","Victoria","Waco","Wichita Falls",
];

const CATEGORIES = [
  { id: "Music", emoji: "🎵", label: "Music" },
  { id: "Nightlife", emoji: "🌙", label: "Nightlife" },
  { id: "Hobbies", emoji: "🎨", label: "Hobbies" },
  { id: "Business", emoji: "💼", label: "Business" },
  { id: "Dance", emoji: "💃", label: "Dance" },
];

function CityDropdown({ value, onChange, placeholder = "Search city…" }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(value || "");
  const ref = useRef(null);
  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);
  useEffect(() => { if (!open) setQuery(value || ""); }, [value, open]);
  const filtered = query.trim() ? TX_CITIES.filter((c) => c.toLowerCase().includes(query.toLowerCase())) : TX_CITIES;
  return (
    <div ref={ref} className="relative">
      <div className={`flex items-center gap-2 w-full px-4 py-3 rounded-xl border bg-brand-muted text-sm transition-colors ${open ? "border-brand-accent bg-white ring-2 ring-red-100" : "border-brand-border"}`}>
        <input type="text" value={query} onChange={(e) => { setQuery(e.target.value); setOpen(true); onChange(""); }}
          onFocus={() => setOpen(true)} placeholder={placeholder}
          className="flex-1 bg-transparent outline-none text-brand-text placeholder-brand-textLight" />
        <ChevronDown size={14} className={`text-brand-textLight shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </div>
      {open && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-brand-border rounded-xl shadow-xl max-h-52 overflow-y-auto">
          {filtered.length === 0 ? <p className="px-4 py-3 text-sm text-brand-textLight">No cities found</p> :
            filtered.map((city) => (
              <button key={city} type="button" onClick={() => { onChange(city); setQuery(city); setOpen(false); }}
                className={`w-full text-left px-4 py-2.5 text-sm hover:bg-brand-muted transition-colors ${value === city ? "text-brand-accent font-semibold bg-red-50" : "text-brand-text"}`}>
                {city}, TX
              </button>
            ))}
        </div>
      )}
    </div>
  );
}

const emptyTier = () => ({ name: "General Admission", description: "", price: 0, total_quantity: 100, max_per_user: 10, sold_quantity: 0 });

export default function OrganizerEditEvent() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [event, setEvent] = useState(null);

  const [form, setForm] = useState({
    title: "", short_description: "", description: "", category: "",
    is_online: false, ticket_type: "paid", is_global: false,
    venue_name: "", venue_address: "", city: "", state: "TX",
    event_start: "", event_end: "", doors_open: "", meeting_link: "",
  });
  const [tiers, setTiers] = useState([]);

  const set = (key, val) => setForm((f) => ({ ...f, [key]: val }));

  useEffect(() => {
    api.get(`/organizer/events/${id}`)
      .then(({ data }) => {
        const evt = data.event;
        setEvent(evt);
        setForm({
          title: evt.title || "",
          short_description: evt.short_description || "",
          description: evt.description || "",
          category: evt.category || "",
          is_online: evt.is_online || false,
          ticket_type: evt.ticket_type || "paid",
          is_global: evt.is_global || false,
          venue_name: evt.venue_name || "",
          venue_address: evt.venue_address || "",
          city: evt.city || "",
          state: evt.state || "TX",
          event_start: utcToCentralInput(evt.event_start),
          event_end: utcToCentralInput(evt.event_end),
          doors_open: utcToCentralInput(evt.doors_open),
          meeting_link: evt.meeting_link || "",
        });
        setTiers((evt.ticket_tiers || []).map((t) => ({ ...t })));
      })
      .catch(() => {
        toast.error("Event not found");
        navigate("/organizer/events");
      })
      .finally(() => setLoading(false));
  }, [id]);

  const handleSave = async () => {
    if (!form.title.trim()) { toast.error("Event title is required"); return; }
    if (!form.event_start || !form.event_end) { toast.error("Start and end times are required"); return; }
    setSaving(true);
    try {
      await api.patch(`/organizer/events/${id}`, {
        title: form.title,
        short_description: form.short_description,
        description: form.description,
        category: form.category,
        venue_name: form.venue_name,
        venue_address: form.venue_address,
        city: form.city,
        state: form.state,
        event_start: centralInputToUtc(form.event_start),
        event_end: centralInputToUtc(form.event_end),
        doors_open: form.doors_open ? centralInputToUtc(form.doors_open) : null,
        meeting_link: form.is_online ? (form.meeting_link || null) : null,
        is_global: form.is_global,
        tiers: tiers.map((t) => ({
          ...(t.id ? { id: t.id } : {}),
          name: t.name,
          description: t.description || "",
          price: form.ticket_type === "free" ? 0 : (parseFloat(t.price) || 0),
          total_quantity: parseInt(t.total_quantity) || 1,
          max_per_user: parseInt(t.max_per_user) || 10,
        })),
      });
      toast.success("Event updated!");
      navigate("/organizer/events");
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to save changes");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 md:p-8 max-w-3xl mx-auto">
        <div className="h-8 w-48 bg-brand-muted rounded-xl animate-pulse mb-8" />
        <div className="space-y-4">
          {[1,2,3].map((i) => <div key={i} className="h-32 bg-brand-muted rounded-2xl animate-pulse" />)}
        </div>
      </div>
    );
  }

  const STATUS_COLORS = {
    published: "bg-teal-50 text-brand-teal",
    draft: "bg-brand-muted text-brand-textLight",
    cancelled: "bg-red-50 text-brand-accent",
    completed: "bg-blue-50 text-blue-600",
  };

  return (
    <div className="p-6 md:p-8 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-2">
        <button onClick={() => navigate("/organizer/events")}
          className="p-2 rounded-xl border border-brand-border text-brand-textMid hover:bg-brand-muted transition-colors">
          <ArrowLeft size={16} />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="font-display text-2xl font-bold text-brand-text">Edit Event</h1>
          <p className="text-xs text-brand-textLight truncate">{event?.title}</p>
        </div>
        <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full capitalize ${STATUS_COLORS[event?.status] || "bg-brand-muted text-brand-textLight"}`}>
          {event?.status}
        </span>
      </div>

      {event?.status === "published" && (
        <div className="mb-6 p-3 bg-amber-50 border border-amber-100 rounded-xl text-xs text-amber-700">
          ⚠️ This event is <strong>published</strong>. Changes will be visible to attendees immediately. Ticket price changes will not affect existing orders.
        </div>
      )}

      <div className="space-y-6">
        {/* Section 1: Event Details */}
        <div className="bg-white rounded-2xl border border-brand-border p-6 space-y-4">
          <h2 className="font-display text-lg font-bold text-brand-text">Event Details</h2>

          <div>
            <label className="block text-sm font-semibold text-brand-text mb-1.5">Event title *</label>
            <input type="text" value={form.title} onChange={(e) => set("title", e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-brand-border bg-brand-muted text-sm outline-none focus:border-brand-accent focus:bg-white transition-colors" />
          </div>

          <div>
            <label className="block text-sm font-semibold text-brand-text mb-1.5">Short description <span className="font-normal text-brand-textLight">(shown on cards)</span></label>
            <input type="text" value={form.short_description} onChange={(e) => set("short_description", e.target.value)}
              maxLength={120}
              className="w-full px-4 py-3 rounded-xl border border-brand-border bg-brand-muted text-sm outline-none focus:border-brand-accent focus:bg-white transition-colors" />
            <p className="text-[11px] text-brand-textLight mt-1 text-right">{form.short_description.length}/120</p>
          </div>

          <div>
            <label className="block text-sm font-semibold text-brand-text mb-1.5">Full description</label>
            <textarea value={form.description} onChange={(e) => set("description", e.target.value)}
              rows={5} className="w-full px-4 py-3 rounded-xl border border-brand-border bg-brand-muted text-sm outline-none focus:border-brand-accent focus:bg-white transition-colors resize-none" />
          </div>

          <div>
            <label className="block text-sm font-semibold text-brand-text mb-3">Category</label>
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
              {CATEGORIES.map((c) => (
                <button key={c.id} type="button" onClick={() => set("category", c.id)}
                  className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all text-center ${form.category === c.id ? "border-brand-accent bg-red-50" : "border-brand-border hover:border-brand-textLight"}`}>
                  <span className="text-2xl">{c.emoji}</span>
                  <span className="text-xs font-semibold text-brand-text">{c.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Section 2: Venue & Time */}
        <div className="bg-white rounded-2xl border border-brand-border p-6 space-y-4">
          <h2 className="font-display text-lg font-bold text-brand-text">{form.is_online ? "Event Timing" : "Venue & Time"}</h2>

          {!form.is_online && (
            <>
              <div>
                <label className="block text-sm font-semibold text-brand-text mb-1.5">Venue name</label>
                <input type="text" value={form.venue_name} onChange={(e) => set("venue_name", e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-brand-border bg-brand-muted text-sm outline-none focus:border-brand-accent focus:bg-white transition-colors" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-brand-text mb-1.5">Venue address</label>
                <input type="text" value={form.venue_address} onChange={(e) => set("venue_address", e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-brand-border bg-brand-muted text-sm outline-none focus:border-brand-accent focus:bg-white transition-colors" />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="block text-sm font-semibold text-brand-text mb-1.5">City</label>
                  <CityDropdown value={form.city} onChange={(v) => set("city", v)} />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-brand-text mb-1.5">State</label>
                  <div className="w-full px-4 py-3 rounded-xl border border-brand-border bg-brand-muted text-sm text-brand-textMid">TX</div>
                </div>
              </div>
            </>
          )}

          {form.is_online && (
            <div>
              <label className="block text-sm font-semibold text-brand-text mb-1.5">Meeting link <span className="font-normal text-brand-textLight">(optional)</span></label>
              <input type="url" value={form.meeting_link} onChange={(e) => set("meeting_link", e.target.value)}
                placeholder="https://zoom.us/j/…"
                className="w-full px-4 py-3 rounded-xl border border-brand-border bg-brand-muted text-sm outline-none focus:border-brand-accent focus:bg-white transition-colors" />
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-brand-text mb-1.5">Start <span className="text-[11px] font-normal text-brand-textLight">(Central Time)</span></label>
              <input type="datetime-local" value={form.event_start} onChange={(e) => set("event_start", e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-brand-border bg-brand-muted text-sm outline-none focus:border-brand-accent focus:bg-white transition-colors" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-brand-text mb-1.5">End <span className="text-[11px] font-normal text-brand-textLight">(Central Time)</span></label>
              <input type="datetime-local" value={form.event_end} onChange={(e) => set("event_end", e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-brand-border bg-brand-muted text-sm outline-none focus:border-brand-accent focus:bg-white transition-colors" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-semibold text-brand-text mb-1.5">Doors open <span className="font-normal text-brand-textLight">(optional)</span></label>
            <input type="datetime-local" value={form.doors_open} onChange={(e) => set("doors_open", e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-brand-border bg-brand-muted text-sm outline-none focus:border-brand-accent focus:bg-white transition-colors" />
          </div>

          <button
            type="button"
            onClick={() => set("is_global", !form.is_global)}
            className={`w-full flex items-center justify-between px-4 py-3.5 rounded-xl border-2 transition-all ${
              form.is_global ? "border-brand-accent bg-red-50" : "border-brand-border hover:border-brand-textLight"
            }`}>
            <div className="text-left">
              <p className="text-sm font-semibold text-brand-text">Show event globally</p>
              <p className="text-xs text-brand-textLight mt-0.5">Appears in all city searches, not just the event's city</p>
            </div>
            <div className={`w-10 h-6 rounded-full flex items-center transition-all shrink-0 ml-4 ${form.is_global ? "bg-brand-accent justify-end" : "bg-brand-muted border border-brand-border justify-start"}`}>
              <div className="w-4 h-4 rounded-full bg-white shadow mx-1" />
            </div>
          </button>
        </div>

        {/* Section 3: Ticket Tiers */}
        <div className="bg-white rounded-2xl border border-brand-border p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-lg font-bold text-brand-text">Ticket Tiers</h2>
            <button type="button" onClick={() => setTiers((t) => [...t, emptyTier()])}
              className="flex items-center gap-1.5 text-sm text-brand-accent font-semibold hover:underline">
              <Plus size={14} /> Add tier
            </button>
          </div>

          {form.ticket_type === "free" && (
            <div className="mb-4 p-3 bg-teal-50 rounded-xl text-sm text-brand-teal border border-teal-100">
              Free event — prices are locked at $0.
            </div>
          )}

          <div className="space-y-4">
            {tiers.map((tier, i) => (
              <div key={tier.id || `new-${i}`} className="p-4 bg-brand-muted rounded-xl border border-brand-border space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold text-brand-textLight uppercase tracking-wider">
                    Tier {i + 1} {!tier.id && <span className="text-brand-accent">· New</span>}
                  </p>
                  <button
                    type="button"
                    disabled={tier.sold_quantity > 0}
                    title={tier.sold_quantity > 0 ? `Cannot remove — ${tier.sold_quantity} tickets sold` : "Remove tier"}
                    onClick={() => setTiers((t) => t.filter((_, idx) => idx !== i))}
                    className="text-brand-textLight hover:text-brand-accent transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
                    <Trash2 size={14} />
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-brand-text mb-1">Name</label>
                    <input type="text" value={tier.name}
                      onChange={(e) => setTiers((t) => t.map((x, idx) => idx === i ? { ...x, name: e.target.value } : x))}
                      className="w-full px-3 py-2 rounded-lg border border-brand-border bg-white text-sm outline-none focus:border-brand-accent" />
                  </div>
                  {form.ticket_type === "paid" && (
                    <div>
                      <label className="block text-xs font-semibold text-brand-text mb-1">Price ($)</label>
                      <input type="number" min={0} step={0.01} value={tier.price}
                        onChange={(e) => setTiers((t) => t.map((x, idx) => idx === i ? { ...x, price: e.target.value === "" ? "" : parseFloat(e.target.value) || 0 } : x))}
                        className="w-full px-3 py-2 rounded-lg border border-brand-border bg-white text-sm outline-none focus:border-brand-accent" />
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-brand-text mb-1">
                      Capacity
                      {tier.sold_quantity > 0 && <span className="ml-1 text-brand-textLight font-normal">({tier.sold_quantity} sold)</span>}
                    </label>
                    <input type="number" min={tier.sold_quantity || 1} value={tier.total_quantity}
                      onChange={(e) => setTiers((t) => t.map((x, idx) => idx === i ? { ...x, total_quantity: e.target.value === "" ? "" : parseInt(e.target.value) || 1 } : x))}
                      className="w-full px-3 py-2 rounded-lg border border-brand-border bg-white text-sm outline-none focus:border-brand-accent" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-brand-text mb-1">Max per person</label>
                    <input type="number" min={1} value={tier.max_per_user}
                      onChange={(e) => setTiers((t) => t.map((x, idx) => idx === i ? { ...x, max_per_user: e.target.value === "" ? "" : parseInt(e.target.value) || 1 } : x))}
                      className="w-full px-3 py-2 rounded-lg border border-brand-border bg-white text-sm outline-none focus:border-brand-accent" />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-brand-text mb-1">Description (optional)</label>
                  <input type="text" value={tier.description || ""}
                    onChange={(e) => setTiers((t) => t.map((x, idx) => idx === i ? { ...x, description: e.target.value } : x))}
                    placeholder="e.g. Includes meet & greet"
                    className="w-full px-3 py-2 rounded-lg border border-brand-border bg-white text-sm outline-none focus:border-brand-accent" />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Save button */}
        <div className="flex items-center justify-between">
          <button type="button" onClick={() => navigate("/organizer/events")}
            className="px-5 py-3 rounded-xl border border-brand-border text-sm font-semibold text-brand-textMid hover:bg-brand-muted transition-colors">
            Cancel
          </button>
          <button type="button" onClick={handleSave} disabled={saving}
            className="flex items-center gap-2 px-8 py-3 rounded-xl bg-brand-accent text-white text-sm font-bold hover:bg-brand-accentHover transition-colors disabled:opacity-60">
            {saving ? "Saving…" : <><Check size={15} /> Save Changes</>}
          </button>
        </div>
      </div>
    </div>
  );
}
