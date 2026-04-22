import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Upload, Plus, Trash2, ArrowLeft, ArrowRight, Check,
  DollarSign, Gift, MapPin, Globe, Image, Video, ChevronDown,
} from "lucide-react";
import api from "../../utils/api";
import { supabase } from "../../utils/supabase";
import toast from "react-hot-toast";
import { centralInputToUtc } from "../../utils/dateUtils";

const TX_CITIES = [
  "Abilene", "Allen", "Amarillo", "Arlington", "Austin",
  "Beaumont", "Bedford", "Brownsville", "Bryan", "Carrollton",
  "Cedar Park", "Cleburne", "College Station", "Conroe", "Corpus Christi",
  "Dallas", "Denton", "DeSoto", "Edinburg", "El Paso",
  "Euless", "Flower Mound", "Fort Worth", "Frisco", "Galveston",
  "Garland", "Georgetown", "Grand Prairie", "Grapevine", "Harlingen",
  "Houston", "Hurst", "Irving", "Katy", "Killeen",
  "Kyle", "Laredo", "League City", "Lewisville", "Longview",
  "Lubbock", "Lufkin", "Mansfield", "McAllen", "McKinney",
  "Mesquite", "Midland", "Mission", "Missouri City", "New Braunfels",
  "North Richland Hills", "Odessa", "Pasadena", "Pearland", "Pflugerville",
  "Plano", "Port Arthur", "Richardson", "Rockwall", "Round Rock",
  "Rowlett", "San Angelo", "San Antonio", "San Marcos", "Sherman",
  "Spring", "Sugar Land", "Temple", "Texarkana", "The Colony",
  "The Woodlands", "Tyler", "Victoria", "Waco", "Wichita Falls",
];

function CityDropdown({ value, onChange, placeholder = "Search city…", required = false }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(value || "");
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Keep query in sync if parent resets value
  useEffect(() => { if (!open) setQuery(value || ""); }, [value, open]);

  const filtered = query.trim().length > 0
    ? TX_CITIES.filter((c) => c.toLowerCase().includes(query.toLowerCase()))
    : TX_CITIES;

  const select = (city) => {
    onChange(city);
    setQuery(city);
    setOpen(false);
  };

  return (
    <div ref={ref} className="relative">
      <div className={`flex items-center gap-2 w-full px-4 py-3 rounded-xl border bg-brand-muted text-sm transition-colors ${
        open ? "border-brand-accent bg-white ring-2 ring-red-100" : "border-brand-border"
      }`}>
        <input
          type="text"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); onChange(""); }}
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
          className="flex-1 bg-transparent outline-none text-brand-text placeholder-brand-textLight"
        />
        <ChevronDown size={14} className={`text-brand-textLight shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </div>
      {open && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-brand-border rounded-xl shadow-xl max-h-52 overflow-y-auto">
          {filtered.length === 0 ? (
            <p className="px-4 py-3 text-sm text-brand-textLight">No cities found</p>
          ) : (
            filtered.map((city) => (
              <button key={city} type="button" onClick={() => select(city)}
                className={`w-full text-left px-4 py-2.5 text-sm hover:bg-brand-muted transition-colors ${
                  value === city ? "text-brand-accent font-semibold bg-red-50" : "text-brand-text"
                }`}>
                {city}, TX
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

const CATEGORIES = [
  { id: "Music",     emoji: "🎵", label: "Music" },
  { id: "Nightlife", emoji: "🌙", label: "Nightlife" },
  { id: "Hobbies",   emoji: "🎨", label: "Hobbies" },
  { id: "Business",  emoji: "💼", label: "Business" },
  { id: "Dance",     emoji: "💃", label: "Dance" },
];

const STEPS = [
  "Event Type",
  "Basic Info",
  "Venue & Time",
  "Media",
  "Tickets",
  "Food & Drinks",
  "Review",
];

const emptyTier = () => ({ name: "General Admission", description: "", price: 0, total_quantity: 100, max_per_user: 10 });
const emptyFood = () => ({ name: "", description: "", price: 0, category: "food", is_vegetarian: false, is_vegan: false, max_quantity: null });

export default function OrganizerCreateEvent() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [slugEdited, setSlugEdited] = useState(false);

  const [form, setForm] = useState({
    title: "",
    slug: "",
    description: "",
    short_description: "",
    category: "",
    ticket_type: "",   // "free" | "paid" — chosen on step 0
    is_online: null,   // true | false — chosen on step 0
    is_global: false,
    venue_name: "",
    venue_address: "",
    city: "",
    state: "TX",
    zip_code: "",
    event_start: "",
    event_end: "",
    doors_open: "",
    meeting_link: "",
    max_tickets_per_user: 10,
    seat_map_image_url: "",
  });

  const [mediaFiles, setMediaFiles] = useState([]);
  const [tiers, setTiers] = useState([emptyTier()]);
  const [foodOptions, setFoodOptions] = useState([]);

  const set = (key, val) => setForm((f) => ({ ...f, [key]: val }));

  useEffect(() => {
    if (!slugEdited) {
      set("slug", form.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80));
    }
  }, [form.title]);

  // ── Validation per step ──
  const canAdvance = () => {
    switch (step) {
      case 0: return form.ticket_type !== "" && form.is_online !== null;
      case 1: return form.title.trim().length >= 3 && form.short_description.trim().length >= 5 && form.category;
      case 2:
        if (form.is_online) return form.event_start && form.event_end;
        return form.venue_name && form.venue_address && form.city && form.event_start && form.event_end;
      default: return true;
    }
  };

  // ── Media upload ──
  const handleMediaSelect = (e) => {
    const files = Array.from(e.target.files);
    setMediaFiles((prev) => [...prev, ...files.map((f) => ({
      file: f, preview: URL.createObjectURL(f),
      type: f.type.startsWith("video") ? "video" : "image",
      url: null, uploading: false,
    }))]);
  };

  const removeMedia = (i) => setMediaFiles((prev) => prev.filter((_, idx) => idx !== i));

  const uploadAllMedia = async () => {
    setUploading(true);
    const uploaded = [];
    for (let i = 0; i < mediaFiles.length; i++) {
      const m = mediaFiles[i];
      if (m.url) { uploaded.push(m); continue; }
      const ext = m.file.name.split(".").pop();
      const path = `events/${Date.now()}-${i}.${ext}`;
      const { error } = await supabase.storage.from("event-media").upload(path, m.file, { contentType: m.file.type });
      if (error) { toast.error(`Failed to upload ${m.file.name}`); uploaded.push(m); continue; }
      const { data: { publicUrl } } = supabase.storage.from("event-media").getPublicUrl(path);
      uploaded.push({ ...m, url: publicUrl });
    }
    setMediaFiles(uploaded);
    setUploading(false);
    return uploaded;
  };

  // ── Submit ──
  const handleSubmit = async () => {
    setLoading(true);
    try {
      const uploadedMedia = await uploadAllMedia();

      // For online events the backend still requires venue_name/venue_address
      const venueDefaults = form.is_online
        ? { venue_name: form.venue_name || "Online Event", venue_address: form.venue_address || "Online", city: form.city || "", state: form.state || "TX" }
        : {};

      const { data: { event } } = await api.post("/events", {
        ...form,
        ...venueDefaults,
        slug: form.slug || null,
        // Ensure numbers are clean — never send NaN
        max_tickets_per_user: parseInt(form.max_tickets_per_user) || 10,
        tiers: tiers.map((t) => ({
          ...t,
          price: form.ticket_type === "free" ? 0 : (parseFloat(t.price) || 0),
          total_quantity: parseInt(t.total_quantity) || 1,
          max_per_user: parseInt(t.max_per_user) || 10,
        })),
        food_options: foodOptions
          .filter((f) => f.name.trim())
          .map((f) => ({ ...f, price: parseFloat(f.price) || 0 })),
        // Convert Central Time inputs to UTC before sending to server
        event_start: centralInputToUtc(form.event_start),
        event_end: centralInputToUtc(form.event_end),
        doors_open: form.doors_open ? centralInputToUtc(form.doors_open) : null,
        meeting_link: form.is_online ? (form.meeting_link || null) : null,
      });

      if (uploadedMedia.filter((m) => m.url).length > 0) {
        await api.post(`/events/${event.id}/media`, {
          media: uploadedMedia.filter((m) => m.url).map((m, i) => ({
            url: m.url, media_type: m.type, is_cover: i === 0, display_order: i,
          })),
        });
      }

      toast.success("Event created as draft!");
      navigate("/organizer/events");
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to create event");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 md:p-8 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <button onClick={() => navigate("/organizer/events")}
          className="p-2 rounded-xl border border-brand-border text-brand-textMid hover:bg-brand-muted transition-colors">
          <ArrowLeft size={16} />
        </button>
        <div>
          <h1 className="font-display text-2xl font-bold text-brand-text">Create Event</h1>
          <p className="text-xs text-brand-textLight">Step {step + 1} of {STEPS.length}: {STEPS[step]}</p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="flex gap-1 mb-8">
        {STEPS.map((_, i) => (
          <div key={i} className={`h-1.5 flex-1 rounded-full transition-all ${i <= step ? "bg-brand-accent" : "bg-brand-muted"}`} />
        ))}
      </div>

      {/* Form card */}
      <div className="bg-white rounded-2xl border border-brand-border p-6 sm:p-8">

        {/* STEP 0: Event Type */}
        {step === 0 && (
          <div>
            <h2 className="font-display text-xl font-bold text-brand-text mb-1">What type of event are you hosting?</h2>
            <p className="text-sm text-brand-textMid mb-6">You can change this later.</p>

            <div className="mb-6">
              <p className="text-sm font-semibold text-brand-text mb-3">Pricing</p>
              <div className="grid grid-cols-2 gap-3">
                <button onClick={() => set("ticket_type", "paid")}
                  className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${
                    form.ticket_type === "paid" ? "border-brand-accent bg-red-50" : "border-brand-border hover:border-brand-textLight"
                  }`}>
                  <DollarSign size={24} className={form.ticket_type === "paid" ? "text-brand-accent" : "text-brand-textLight"} />
                  <p className="font-semibold text-sm text-brand-text">Paid Event</p>
                  <p className="text-xs text-brand-textLight text-center">Charge for tickets. Connect a bank account for payouts.</p>
                </button>
                <button onClick={() => set("ticket_type", "free")}
                  className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${
                    form.ticket_type === "free" ? "border-brand-teal bg-teal-50" : "border-brand-border hover:border-brand-textLight"
                  }`}>
                  <Gift size={24} className={form.ticket_type === "free" ? "text-brand-teal" : "text-brand-textLight"} />
                  <p className="font-semibold text-sm text-brand-text">Free Event</p>
                  <p className="text-xs text-brand-textLight text-center">No charge for attendees. No payout setup needed.</p>
                </button>
              </div>
            </div>

            <div>
              <p className="text-sm font-semibold text-brand-text mb-3">Location</p>
              <div className="grid grid-cols-2 gap-3">
                <button onClick={() => set("is_online", false)}
                  className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${
                    form.is_online === false ? "border-brand-accent bg-red-50" : "border-brand-border hover:border-brand-textLight"
                  }`}>
                  <MapPin size={24} className={form.is_online === false ? "text-brand-accent" : "text-brand-textLight"} />
                  <p className="font-semibold text-sm text-brand-text">In-Person</p>
                  <p className="text-xs text-brand-textLight text-center">At a physical venue with an address.</p>
                </button>
                <button onClick={() => set("is_online", true)}
                  className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${
                    form.is_online === true ? "border-blue-500 bg-blue-50" : "border-brand-border hover:border-brand-textLight"
                  }`}>
                  <Globe size={24} className={form.is_online === true ? "text-blue-500" : "text-brand-textLight"} />
                  <p className="font-semibold text-sm text-brand-text">Online Event</p>
                  <p className="text-xs text-brand-textLight text-center">Meeting link sent to attendees the day before.</p>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* STEP 1: Basic Info */}
        {step === 1 && (
          <div className="space-y-4">
            <h2 className="font-display text-xl font-bold text-brand-text mb-4">Event details</h2>

            <div>
              <label className="block text-sm font-semibold text-brand-text mb-1.5">Event title *</label>
              <input type="text" value={form.title} onChange={(e) => set("title", e.target.value)}
                placeholder="Give your event a clear, catchy name"
                className="w-full px-4 py-3 rounded-xl border border-brand-border bg-brand-muted text-sm outline-none focus:border-brand-accent focus:bg-white transition-colors" />
            </div>

            <div>
              <label className="block text-sm font-semibold text-brand-text mb-1.5">
                Event URL <span className="text-brand-textLight font-normal">(custom link)</span>
              </label>
              <div className="flex items-center rounded-xl border border-brand-border bg-brand-muted overflow-hidden focus-within:border-brand-accent focus-within:bg-white transition-colors">
                <span className="pl-4 pr-1 text-sm text-brand-textLight whitespace-nowrap">funasia.events/events/</span>
                <input
                  type="text"
                  value={form.slug}
                  onChange={(e) => {
                    setSlugEdited(true);
                    set("slug", e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 80));
                  }}
                  placeholder="my-event-name"
                  className="flex-1 py-3 pr-4 bg-transparent text-sm text-brand-text outline-none"
                />
              </div>
              <p className="text-[11px] text-brand-textLight mt-1">Lowercase letters, numbers, and hyphens only. Must be unique.</p>
            </div>

            <div>
              <label className="block text-sm font-semibold text-brand-text mb-1.5">Short description * <span className="text-brand-textLight font-normal">(shown on cards)</span></label>
              <input type="text" value={form.short_description} onChange={(e) => set("short_description", e.target.value)}
                placeholder="One sentence summary of your event" maxLength={120}
                className="w-full px-4 py-3 rounded-xl border border-brand-border bg-brand-muted text-sm outline-none focus:border-brand-accent focus:bg-white transition-colors" />
              <p className="text-[11px] text-brand-textLight mt-1 text-right">{form.short_description.length}/120</p>
            </div>

            <div>
              <label className="block text-sm font-semibold text-brand-text mb-1.5">Full description</label>
              <textarea value={form.description} onChange={(e) => set("description", e.target.value)}
                rows={5} placeholder="Tell attendees everything they need to know — schedule, performers, dress code…"
                className="w-full px-4 py-3 rounded-xl border border-brand-border bg-brand-muted text-sm outline-none focus:border-brand-accent focus:bg-white transition-colors resize-none" />
            </div>

            <div>
              <label className="block text-sm font-semibold text-brand-text mb-3">Category *</label>
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                {CATEGORIES.map((c) => (
                  <button key={c.id} onClick={() => set("category", c.id)}
                    className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all text-center ${
                      form.category === c.id ? "border-brand-accent bg-red-50" : "border-brand-border hover:border-brand-textLight"
                    }`}>
                    <span className="text-2xl">{c.emoji}</span>
                    <span className="text-xs font-semibold text-brand-text">{c.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-brand-text mb-1.5">Max tickets per person</label>
              <input type="number" min={1} max={50} value={form.max_tickets_per_user}
                onChange={(e) => set("max_tickets_per_user", e.target.value === "" ? "" : parseInt(e.target.value) || 1)}
                className="w-32 px-4 py-3 rounded-xl border border-brand-border bg-brand-muted text-sm outline-none focus:border-brand-accent focus:bg-white transition-colors" />
            </div>
          </div>
        )}

        {/* STEP 2: Venue & Time */}
        {step === 2 && (
          <div className="space-y-4">
            <h2 className="font-display text-xl font-bold text-brand-text mb-4">
              {form.is_online ? "Event timing" : "Venue & timing"}
            </h2>

            {form.is_online ? (
              <div className="p-4 bg-blue-50 rounded-xl border border-blue-100 text-sm text-blue-700 mb-4">
                <Globe size={14} className="inline mr-1.5" />
                This is an <strong>online event</strong>. The meeting link will be emailed to all attendees 1 day before the event.
              </div>
            ) : (
              <>
                <div>
                  <label className="block text-sm font-semibold text-brand-text mb-1.5">Venue name *</label>
                  <input type="text" value={form.venue_name} onChange={(e) => set("venue_name", e.target.value)}
                    placeholder="e.g. The Venue at Dallas"
                    className="w-full px-4 py-3 rounded-xl border border-brand-border bg-brand-muted text-sm outline-none focus:border-brand-accent focus:bg-white transition-colors" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-brand-text mb-1.5">Venue address *</label>
                  <input type="text" value={form.venue_address} onChange={(e) => set("venue_address", e.target.value)}
                    placeholder="123 Main St"
                    className="w-full px-4 py-3 rounded-xl border border-brand-border bg-brand-muted text-sm outline-none focus:border-brand-accent focus:bg-white transition-colors" />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2">
                    <label className="block text-sm font-semibold text-brand-text mb-1.5">City *</label>
                    <CityDropdown value={form.city} onChange={(v) => set("city", v)} placeholder="Search Texas city…" />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-brand-text mb-1.5">State</label>
                    <div className="w-full px-4 py-3 rounded-xl border border-brand-border bg-brand-muted text-sm text-brand-textMid select-none">
                      TX
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* For online events, still need a city for discovery */}
            {form.is_online && (
              <div>
                <label className="block text-sm font-semibold text-brand-text mb-1.5">Primary city <span className="text-brand-textLight font-normal">(for event discovery)</span></label>
                <CityDropdown value={form.city} onChange={(v) => set("city", v)} placeholder="Search Texas city…" />
              </div>
            )}

            {form.is_online && (
              <div>
                <label className="block text-sm font-semibold text-brand-text mb-1.5">Meeting link <span className="text-brand-textLight font-normal">(optional — can add later)</span></label>
                <input type="url" value={form.meeting_link} onChange={(e) => set("meeting_link", e.target.value)}
                  placeholder="https://zoom.us/j/… or Google Meet link"
                  className="w-full px-4 py-3 rounded-xl border border-brand-border bg-brand-muted text-sm outline-none focus:border-brand-accent focus:bg-white transition-colors" />
                <p className="text-xs text-brand-textLight mt-1">Sent automatically to all attendees 24 hours before the event.</p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-brand-text mb-1.5">Start date & time * <span className="text-brand-textLight font-normal text-xs">(Central Time)</span></label>
                <input type="datetime-local" value={form.event_start} onChange={(e) => set("event_start", e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-brand-border bg-brand-muted text-sm outline-none focus:border-brand-accent focus:bg-white transition-colors" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-brand-text mb-1.5">End date & time * <span className="text-brand-textLight font-normal text-xs">(Central Time)</span></label>
                <input type="datetime-local" value={form.event_end} onChange={(e) => set("event_end", e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-brand-border bg-brand-muted text-sm outline-none focus:border-brand-accent focus:bg-white transition-colors" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-semibold text-brand-text mb-1.5">Doors open <span className="text-brand-textLight font-normal">(optional)</span></label>
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
        )}

        {/* STEP 3: Media */}
        {step === 3 && (
          <div>
            <h2 className="font-display text-xl font-bold text-brand-text mb-1">Event media</h2>
            <p className="text-sm text-brand-textMid mb-6">The first image will be the cover photo shown on event cards.</p>

            <label className="flex flex-col items-center justify-center h-36 border-2 border-dashed border-brand-border rounded-xl cursor-pointer hover:border-brand-accent hover:bg-red-50 transition-colors">
              <Upload size={24} className="text-brand-textLight mb-2" />
              <p className="text-sm font-semibold text-brand-text">Click to upload images or video</p>
              <p className="text-xs text-brand-textLight mt-1">JPEG, PNG, MP4 — multiple files supported</p>
              <input type="file" accept="image/*,video/*" multiple className="hidden" onChange={handleMediaSelect} />
            </label>

            {mediaFiles.length > 0 && (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 mt-4">
                {mediaFiles.map((m, i) => (
                  <div key={i} className="relative group aspect-square rounded-xl overflow-hidden border border-brand-border">
                    {m.type === "image" ? (
                      <img src={m.preview} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full bg-brand-dark flex items-center justify-center">
                        <Video size={24} className="text-white" />
                      </div>
                    )}
                    {i === 0 && (
                      <span className="absolute top-1 left-1 text-[9px] bg-brand-gold text-white font-bold px-1.5 py-0.5 rounded">
                        Cover
                      </span>
                    )}
                    <button onClick={() => removeMedia(i)}
                      className="absolute top-1 right-1 w-5 h-5 bg-black/60 rounded-full flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity">
                      <Trash2 size={10} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* STEP 4: Tickets */}
        {step === 4 && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display text-xl font-bold text-brand-text">Ticket tiers</h2>
              <button onClick={() => setTiers((t) => [...t, emptyTier()])}
                className="flex items-center gap-1.5 text-sm text-brand-accent font-semibold hover:underline">
                <Plus size={14} /> Add tier
              </button>
            </div>

            {form.ticket_type === "free" && (
              <div className="mb-4 p-3 bg-teal-50 rounded-xl text-sm text-brand-teal border border-teal-100">
                Free event — no pricing needed. Tiers are just for capacity management.
              </div>
            )}

            <div className="space-y-4">
              {tiers.map((tier, i) => (
                <div key={i} className="p-4 bg-brand-muted rounded-xl border border-brand-border space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold text-brand-textLight uppercase tracking-wider">Tier {i + 1}</p>
                    {tiers.length > 1 && (
                      <button onClick={() => setTiers((t) => t.filter((_, idx) => idx !== i))}
                        className="text-brand-textLight hover:text-brand-accent transition-colors">
                        <Trash2 size={14} />
                      </button>
                    )}
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
                      <label className="block text-xs font-semibold text-brand-text mb-1">Capacity</label>
                      <input type="number" min={1} value={tier.total_quantity}
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
                    <input type="text" value={tier.description} placeholder="e.g. Includes meet & greet"
                      onChange={(e) => setTiers((t) => t.map((x, idx) => idx === i ? { ...x, description: e.target.value } : x))}
                      className="w-full px-3 py-2 rounded-lg border border-brand-border bg-white text-sm outline-none focus:border-brand-accent" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* STEP 5: Food & Drinks */}
        {step === 5 && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <h2 className="font-display text-xl font-bold text-brand-text">Food & Drinks</h2>
              <button onClick={() => setFoodOptions((f) => [...f, emptyFood()])}
                className="flex items-center gap-1.5 text-sm text-brand-accent font-semibold hover:underline">
                <Plus size={14} /> Add item
              </button>
            </div>
            <p className="text-sm text-brand-textMid mb-4">Optional — let attendees pre-order food and drinks with their tickets.</p>

            {foodOptions.length === 0 ? (
              <div className="text-center py-10 bg-brand-muted rounded-xl border border-brand-border">
                <p className="text-sm text-brand-textLight">No food options added. You can skip this step.</p>
                <button onClick={() => setFoodOptions([emptyFood()])}
                  className="mt-3 text-sm text-brand-accent font-semibold hover:underline">
                  + Add food/drink item
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {foodOptions.map((item, i) => (
                  <div key={i} className="p-4 bg-brand-muted rounded-xl border border-brand-border space-y-3">
                    <div className="flex justify-between items-center">
                      <p className="text-xs font-bold text-brand-textLight uppercase tracking-wider">Item {i + 1}</p>
                      <button onClick={() => setFoodOptions((f) => f.filter((_, idx) => idx !== i))}
                        className="text-brand-textLight hover:text-brand-accent">
                        <Trash2 size={14} />
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-brand-text mb-1">Name</label>
                        <input type="text" value={item.name} placeholder="e.g. Butter Chicken"
                          onChange={(e) => setFoodOptions((f) => f.map((x, idx) => idx === i ? { ...x, name: e.target.value } : x))}
                          className="w-full px-3 py-2 rounded-lg border border-brand-border bg-white text-sm outline-none focus:border-brand-accent" />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-brand-text mb-1">Price ($)</label>
                        <input type="number" min={0} step={0.01} value={item.price}
                          onChange={(e) => setFoodOptions((f) => f.map((x, idx) => idx === i ? { ...x, price: e.target.value === "" ? "" : parseFloat(e.target.value) || 0 } : x))}
                          className="w-full px-3 py-2 rounded-lg border border-brand-border bg-white text-sm outline-none focus:border-brand-accent" />
                      </div>
                    </div>
                    <div className="flex items-center gap-4 text-sm">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={item.is_vegetarian}
                          onChange={(e) => setFoodOptions((f) => f.map((x, idx) => idx === i ? { ...x, is_vegetarian: e.target.checked } : x))}
                          className="rounded border-brand-border" />
                        Vegetarian
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={item.is_vegan}
                          onChange={(e) => setFoodOptions((f) => f.map((x, idx) => idx === i ? { ...x, is_vegan: e.target.checked } : x))}
                          className="rounded border-brand-border" />
                        Vegan
                      </label>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* STEP 6: Review */}
        {step === 6 && (
          <div>
            <h2 className="font-display text-xl font-bold text-brand-text mb-1">Review & create</h2>
            <p className="text-sm text-brand-textMid mb-6">Your event will be saved as a <strong>draft</strong>. You can publish it from your Events page.</p>

            <div className="space-y-3 text-sm">
              <Row label="Title" value={form.title} />
              <Row label="Category" value={form.category} />
              <Row label="Type" value={`${form.ticket_type === "free" ? "Free" : "Paid"} · ${form.is_online ? "Online" : "In-Person"}`} />
              {!form.is_online && <Row label="Venue" value={`${form.venue_name}, ${form.city}, ${form.state}`} />}
              {form.is_online && form.city && <Row label="City" value={form.city} />}
              <Row label="Start" value={form.event_start ? `${new Date(form.event_start).toLocaleString("en-US", { timeZone: "America/Chicago" })} CT` : "—"} />
              <Row label="End" value={form.event_end ? `${new Date(form.event_end).toLocaleString("en-US", { timeZone: "America/Chicago" })} CT` : "—"} />
              <Row label="Ticket tiers" value={`${tiers.length} tier${tiers.length !== 1 ? "s" : ""}`} />
              <Row label="Media" value={`${mediaFiles.length} file${mediaFiles.length !== 1 ? "s" : ""}`} />
              {foodOptions.filter((f) => f.name).length > 0 && (
                <Row label="Food options" value={`${foodOptions.filter((f) => f.name).length} item${foodOptions.filter((f) => f.name).length !== 1 ? "s" : ""}`} />
              )}
              {form.is_online && form.meeting_link && (
                <Row label="Meeting link" value="Provided ✓" />
              )}
            </div>
          </div>
        )}

        {/* Nav buttons */}
        <div className="flex items-center justify-between mt-8 pt-6 border-t border-brand-border">
          {step > 0 ? (
            <button onClick={() => setStep((s) => s - 1)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-brand-border text-sm font-medium text-brand-textMid hover:bg-brand-muted transition-colors">
              <ArrowLeft size={15} /> Back
            </button>
          ) : <div />}

          {step < STEPS.length - 1 ? (
            <button onClick={() => setStep((s) => s + 1)} disabled={!canAdvance()}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-brand-accent text-white text-sm font-bold hover:bg-brand-accentHover transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
              Continue <ArrowRight size={15} />
            </button>
          ) : (
            <button onClick={handleSubmit} disabled={loading || uploading}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-brand-accent text-white text-sm font-bold hover:bg-brand-accentHover transition-colors disabled:opacity-60">
              {loading || uploading ? "Creating…" : <><Check size={15} /> Create Event</>}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex items-start justify-between py-2.5 border-b border-brand-border last:border-0">
      <span className="text-brand-textLight font-medium shrink-0 mr-4">{label}</span>
      <span className="text-brand-text font-semibold text-right">{value || "—"}</span>
    </div>
  );
}
