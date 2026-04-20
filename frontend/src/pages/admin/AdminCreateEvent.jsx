import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Upload, Plus, Trash2, Image, Video, ArrowLeft, ArrowRight, Check } from "lucide-react";
import api from "../../utils/api";
import { supabase } from "../../utils/supabase";
import toast from "react-hot-toast";
import { centralInputToUtc } from "../../utils/dateUtils";

const CATEGORIES = [
  { id: "concerts", label: "🎵 Concerts & Live Music" },
  { id: "cultural", label: "🪔 Cultural & Desi Events" },
  { id: "conferences", label: "🎤 Conferences & Workshops" },
  { id: "sports", label: "⚽ Sports & Outdoor" },
];

const STEPS = ["Basic Info", "Venue & Timing", "Media", "Tickets & Pricing", "Food & Drinks", "Payout & Review"];

export default function AdminCreateEvent() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [form, setForm] = useState({
    title: "",
    description: "",
    short_description: "",
    category: "concerts",
    ticket_type: "paid",
    venue_name: "",
    venue_address: "",
    city: "",
    state: "",
    zip_code: "",
    event_start: "",
    event_end: "",
    doors_open: "",
    max_tickets_per_user: 10,
    seat_map_image_url: "",
  });

  const [mediaFiles, setMediaFiles] = useState([]); // { file, preview, type, uploading, url }
  const [tiers, setTiers] = useState([{ name: "General Admission", description: "", price: 0, total_quantity: 100, max_per_user: 10 }]);
  const [foodOptions, setFoodOptions] = useState([]);

  const update = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  // ─── Media upload to Supabase Storage ───
  const handleMediaSelect = (e) => {
    const files = Array.from(e.target.files);
    const newMedia = files.map((file) => ({
      file,
      preview: URL.createObjectURL(file),
      type: file.type.startsWith("video") ? "video" : "image",
      uploading: false,
      url: null,
    }));
    setMediaFiles((prev) => [...prev, ...newMedia]);
  };

  const uploadAllMedia = async () => {
    setUploading(true);
    const uploaded = [];
    for (let i = 0; i < mediaFiles.length; i++) {
      const m = mediaFiles[i];
      if (m.url) { uploaded.push(m); continue; }

      const ext = m.file.name.split(".").pop();
      const path = `events/${Date.now()}-${i}.${ext}`;

      const { data, error } = await supabase.storage.from("event-media").upload(path, m.file, {
        contentType: m.file.type,
        upsert: false,
      });

      if (error) {
        toast.error(`Failed to upload ${m.file.name}`);
        continue;
      }

      const { data: urlData } = supabase.storage.from("event-media").getPublicUrl(path);
      uploaded.push({ ...m, url: urlData.publicUrl, uploading: false });
    }
    setMediaFiles(uploaded);
    setUploading(false);
    return uploaded;
  };

  const handleSeatMapUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const path = `seat-maps/${Date.now()}-${file.name}`;
    const { error } = await supabase.storage.from("event-media").upload(path, file);
    if (error) { toast.error("Upload failed"); return; }
    const { data } = supabase.storage.from("event-media").getPublicUrl(path);
    setForm((f) => ({ ...f, seat_map_image_url: data.publicUrl }));
    toast.success("Seat map uploaded");
  };

  // ─── Tier management ───
  const addTier = () => setTiers((t) => [...t, { name: "", description: "", price: 0, total_quantity: 50, max_per_user: 10 }]);
  const removeTier = (i) => setTiers((t) => t.filter((_, idx) => idx !== i));
  const updateTier = (i, key, value) => setTiers((t) => t.map((tier, idx) => idx === i ? { ...tier, [key]: value } : tier));

  // ─── Food management ───
  const addFood = () => setFoodOptions((f) => [...f, { name: "", description: "", price: 0, category: "food", is_vegetarian: false, is_vegan: false, max_quantity: null, image_url: "" }]);
  const removeFood = (i) => setFoodOptions((f) => f.filter((_, idx) => idx !== i));
  const updateFood = (i, key, value) => setFoodOptions((f) => f.map((item, idx) => idx === i ? { ...item, [key]: value } : item));

  // ─── Submit ───
  const handleSubmit = async () => {
    setLoading(true);
    try {
      // Upload media first
      const uploaded = await uploadAllMedia();

      // Create event
      const { data } = await api.post("/events", {
        ...form,
        event_start: centralInputToUtc(form.event_start),
        event_end: centralInputToUtc(form.event_end),
        doors_open: form.doors_open ? centralInputToUtc(form.doors_open) : null,
        tiers: tiers.map((t) => ({
          ...t,
          price: form.ticket_type === "free" ? 0 : parseFloat(t.price),
          total_quantity: parseInt(t.total_quantity),
          max_per_user: parseInt(t.max_per_user),
        })),
        food_options: foodOptions.filter((f) => f.name).map((f) => ({
          ...f,
          price: parseFloat(f.price),
        })),
      });

      // Upload media refs
      if (uploaded.filter((m) => m.url).length > 0) {
        await api.post(`/events/${data.event.id}/media`, {
          media: uploaded.filter((m) => m.url).map((m, i) => ({
            url: m.url,
            media_type: m.type,
            is_cover: i === 0,
            width: 1920,
            height: 1080,
          })),
        });
      }

      toast.success("Event created! You can now publish it.");
      navigate("/admin");
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to create event");
    } finally {
      setLoading(false);
    }
  };

  const canNext = () => {
    if (step === 0) return form.title && form.description;
    if (step === 1) return form.venue_name && form.city && form.state && form.event_start && form.event_end;
    if (step === 3) return tiers.length > 0 && tiers.every((t) => t.name && t.total_quantity > 0);
    return true;
  };

  const inputCls = "w-full px-4 py-3 bg-brand-elevated border border-white/5 rounded-lg text-sm text-white placeholder-gray-600 outline-none focus:border-brand-accent/30 transition-colors";
  const labelCls = "block text-[11px] text-gray-500 uppercase tracking-wider mb-1.5 font-medium";

  return (
    <div className="max-w-3xl mx-auto px-4 py-10 animate-fade-in">
      <button onClick={() => navigate("/admin")} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-white mb-6">
        <ArrowLeft size={16} /> Back to Dashboard
      </button>

      <h1 className="font-display text-3xl font-bold text-white mb-2">Create New Event</h1>
      <p className="text-gray-500 text-sm mb-8">Fill in the details to create your event</p>

      {/* Step indicator */}
      <div className="flex gap-1 mb-8">
        {STEPS.map((s, i) => (
          <div key={s} className="flex-1">
            <div className={`h-1 rounded-full transition-colors ${i <= step ? "bg-brand-accent" : "bg-brand-elevated"}`} />
            <p className={`text-[10px] mt-1.5 ${i <= step ? "text-brand-accent" : "text-gray-700"} hidden sm:block`}>{s}</p>
          </div>
        ))}
      </div>

      <div className="bg-brand-card border border-white/5 rounded-2xl p-6 sm:p-8">
        {/* Step 0: Basic Info */}
        {step === 0 && (
          <div className="space-y-5">
            <h2 className="font-display text-xl font-bold text-white mb-4">Event Details</h2>
            <div><label className={labelCls}>Event Name</label><input value={form.title} onChange={update("title")} placeholder="e.g. Arijit Singh Live" className={inputCls} /></div>
            <div><label className={labelCls}>Short Description</label><input value={form.short_description} onChange={update("short_description")} placeholder="One-liner for event cards" maxLength={500} className={inputCls} /></div>
            <div><label className={labelCls}>Full Description</label><textarea value={form.description} onChange={update("description")} placeholder="Detailed event description..." rows={5} className={inputCls + " resize-none"} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Category</label>
                <select value={form.category} onChange={update("category")} className={inputCls}>
                  {CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>Event Type</label>
                <div className="flex gap-3 mt-1">
                  {["free", "paid"].map((t) => (
                    <button key={t} onClick={() => setForm((f) => ({ ...f, ticket_type: t }))}
                      className={`flex-1 py-3 rounded-lg text-sm font-semibold transition-all ${form.ticket_type === t ? "bg-brand-accent/10 border border-brand-accent/30 text-brand-accent" : "bg-brand-elevated border border-white/5 text-gray-500"}`}>
                      {t === "free" ? "🎉 Free" : "💳 Paid"}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Step 1: Venue & Timing */}
        {step === 1 && (
          <div className="space-y-5">
            <h2 className="font-display text-xl font-bold text-white mb-4">Venue & Timing</h2>
            <div><label className={labelCls}>Venue Name</label><input value={form.venue_name} onChange={update("venue_name")} placeholder="e.g. AT&T Stadium" className={inputCls} /></div>
            <div><label className={labelCls}>Full Address</label><input value={form.venue_address} onChange={update("venue_address")} placeholder="Street address" className={inputCls} /></div>
            <div className="grid grid-cols-3 gap-4">
              <div><label className={labelCls}>City</label><input value={form.city} onChange={update("city")} placeholder="Dallas" className={inputCls} /></div>
              <div><label className={labelCls}>State</label><input value={form.state} onChange={update("state")} placeholder="Texas" className={inputCls} /></div>
              <div><label className={labelCls}>Zip Code</label><input value={form.zip_code} onChange={update("zip_code")} placeholder="75001" className={inputCls} /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><label className={labelCls}>Event Start</label><input type="datetime-local" value={form.event_start} onChange={update("event_start")} className={inputCls} /></div>
              <div><label className={labelCls}>Event End</label><input type="datetime-local" value={form.event_end} onChange={update("event_end")} className={inputCls} /></div>
            </div>
            <div><label className={labelCls}>Doors Open (optional)</label><input type="datetime-local" value={form.doors_open} onChange={update("doors_open")} className={inputCls} /></div>

            {/* Seat Map Upload */}
            <div>
              <label className={labelCls}>Seat Map Image (optional)</label>
              <p className="text-xs text-gray-600 mb-2">Upload a venue seat map image so users can see the layout</p>
              {form.seat_map_image_url ? (
                <div className="relative rounded-xl overflow-hidden border border-white/5">
                  <img src={form.seat_map_image_url} alt="Seat map" className="w-full max-h-48 object-contain bg-brand-elevated" />
                  <button onClick={() => setForm((f) => ({ ...f, seat_map_image_url: "" }))} className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/60 flex items-center justify-center text-white hover:bg-red-500/80">
                    <Trash2 size={12} />
                  </button>
                </div>
              ) : (
                <label className="flex items-center justify-center gap-2 py-8 border-2 border-dashed border-white/10 rounded-xl cursor-pointer hover:border-brand-accent/30 transition-colors">
                  <Image size={18} className="text-gray-600" />
                  <span className="text-sm text-gray-500">Click to upload seat map</span>
                  <input type="file" accept="image/*" onChange={handleSeatMapUpload} className="hidden" />
                </label>
              )}
            </div>
          </div>
        )}

        {/* Step 2: Media */}
        {step === 2 && (
          <div className="space-y-5">
            <h2 className="font-display text-xl font-bold text-white mb-1">Event Media</h2>
            <p className="text-sm text-gray-500 mb-4">Upload images (16:9 ratio recommended) or a short video</p>

            <label className="flex flex-col items-center justify-center gap-2 py-10 border-2 border-dashed border-white/10 rounded-xl cursor-pointer hover:border-brand-accent/30 transition-colors">
              <Upload size={24} className="text-gray-600" />
              <span className="text-sm text-gray-400">Drop images or video here, or click to browse</span>
              <span className="text-xs text-gray-600">JPG, PNG, MP4 • Images should be 16:9 ratio</span>
              <input type="file" accept="image/*,video/*" multiple onChange={handleMediaSelect} className="hidden" />
            </label>

            {mediaFiles.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-4">
                {mediaFiles.map((m, i) => (
                  <div key={i} className="relative rounded-xl overflow-hidden border border-white/5 aspect-video bg-brand-elevated">
                    {m.type === "video" ? (
                      <video src={m.preview} className="w-full h-full object-cover" />
                    ) : (
                      <img src={m.preview} alt="" className="w-full h-full object-cover" />
                    )}
                    <div className="absolute top-2 left-2">
                      {m.type === "video" ? <Video size={14} className="text-brand-gold" /> : <Image size={14} className="text-brand-teal" />}
                    </div>
                    {i === 0 && <span className="absolute bottom-2 left-2 px-2 py-0.5 rounded text-[10px] bg-brand-accent text-white font-semibold">Cover</span>}
                    <button onClick={() => setMediaFiles((f) => f.filter((_, idx) => idx !== i))}
                      className="absolute top-2 right-2 w-6 h-6 rounded-full bg-black/60 flex items-center justify-center text-white hover:bg-red-500/80">
                      <Trash2 size={10} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Step 3: Tickets & Pricing */}
        {step === 3 && (
          <div className="space-y-5">
            <h2 className="font-display text-xl font-bold text-white mb-4">Ticket Tiers</h2>
            {form.ticket_type === "free" && (
              <div className="p-3 bg-brand-teal/10 border border-brand-teal/20 rounded-lg text-sm text-brand-teal mb-4">
                🎉 This is a free event — all tickets will be $0
              </div>
            )}

            {tiers.map((tier, i) => (
              <div key={i} className="p-4 bg-brand-elevated border border-white/5 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500 font-semibold uppercase">Tier {i + 1}</span>
                  {tiers.length > 1 && (
                    <button onClick={() => removeTier(i)} className="text-gray-600 hover:text-red-400"><Trash2 size={14} /></button>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className={labelCls}>Tier Name</label><input value={tier.name} onChange={(e) => updateTier(i, "name", e.target.value)} placeholder="e.g. VIP, General" className={inputCls} /></div>
                  {form.ticket_type === "paid" && (
                    <div><label className={labelCls}>Price ($)</label><input type="number" min={0} step={0.01} value={tier.price} onChange={(e) => updateTier(i, "price", e.target.value)} className={inputCls} /></div>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className={labelCls}>Total Tickets Available</label><input type="number" min={1} value={tier.total_quantity} onChange={(e) => updateTier(i, "total_quantity", e.target.value)} className={inputCls} /></div>
                  <div><label className={labelCls}>Max Per User</label><input type="number" min={1} max={50} value={tier.max_per_user} onChange={(e) => updateTier(i, "max_per_user", e.target.value)} className={inputCls} /></div>
                </div>
                <div><label className={labelCls}>Description (optional)</label><input value={tier.description} onChange={(e) => updateTier(i, "description", e.target.value)} placeholder="What's included" className={inputCls} /></div>
              </div>
            ))}

            <button onClick={addTier} className="flex items-center gap-2 text-sm text-brand-accent hover:text-brand-accent/80 font-medium">
              <Plus size={14} /> Add Another Tier
            </button>

            <div>
              <label className={labelCls}>Max Tickets Per User (Global)</label>
              <input type="number" min={1} max={50} value={form.max_tickets_per_user} onChange={update("max_tickets_per_user")} className={inputCls + " max-w-[200px]"} />
            </div>
          </div>
        )}

        {/* Step 4: Food & Drinks */}
        {step === 4 && (
          <div className="space-y-5">
            <h2 className="font-display text-xl font-bold text-white mb-1">Food & Drinks</h2>
            <p className="text-sm text-gray-500 mb-4">Optional — add food and drink options attendees can purchase</p>

            {foodOptions.length === 0 ? (
              <div className="text-center py-8 border-2 border-dashed border-white/10 rounded-xl">
                <p className="text-gray-600 text-sm mb-3">No food options added yet</p>
                <button onClick={addFood} className="px-4 py-2 bg-brand-accent/10 text-brand-accent text-sm font-semibold rounded-lg hover:bg-brand-accent/20">
                  <Plus size={14} className="inline mr-1" /> Add Food / Drink
                </button>
              </div>
            ) : (
              <>
                {foodOptions.map((item, i) => (
                  <div key={i} className="p-4 bg-brand-elevated border border-white/5 rounded-xl space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-500 font-semibold uppercase">Item {i + 1}</span>
                      <button onClick={() => removeFood(i)} className="text-gray-600 hover:text-red-400"><Trash2 size={14} /></button>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div><label className={labelCls}>Item Name</label><input value={item.name} onChange={(e) => updateFood(i, "name", e.target.value)} placeholder="e.g. Chicken Biryani Plate" className={inputCls} /></div>
                      <div><label className={labelCls}>Price ($)</label><input type="number" min={0} step={0.01} value={item.price} onChange={(e) => updateFood(i, "price", e.target.value)} className={inputCls} /></div>
                    </div>
                    <div><label className={labelCls}>Description</label><input value={item.description} onChange={(e) => updateFood(i, "description", e.target.value)} placeholder="Short description" className={inputCls} /></div>
                    <div className="flex gap-4">
                      <select value={item.category} onChange={(e) => updateFood(i, "category", e.target.value)} className={inputCls + " max-w-[150px]"}>
                        <option value="food">🍽 Food</option>
                        <option value="drink">🥤 Drink</option>
                        <option value="combo">🎁 Combo</option>
                      </select>
                      <label className="flex items-center gap-2 text-sm text-gray-400 cursor-pointer">
                        <input type="checkbox" checked={item.is_vegetarian} onChange={(e) => updateFood(i, "is_vegetarian", e.target.checked)} className="accent-green-500" /> 🌱 Vegetarian
                      </label>
                      <label className="flex items-center gap-2 text-sm text-gray-400 cursor-pointer">
                        <input type="checkbox" checked={item.is_vegan} onChange={(e) => updateFood(i, "is_vegan", e.target.checked)} className="accent-green-500" /> 🌿 Vegan
                      </label>
                    </div>
                  </div>
                ))}
                <button onClick={addFood} className="flex items-center gap-2 text-sm text-brand-accent hover:text-brand-accent/80 font-medium">
                  <Plus size={14} /> Add Another Item
                </button>
              </>
            )}
          </div>
        )}

        {/* Step 5: Payout & Review */}
        {step === 5 && (
          <div className="space-y-6">
            <h2 className="font-display text-xl font-bold text-white mb-4">Payout & Review</h2>

            {form.ticket_type === "paid" && (
              <div className="p-5 bg-brand-elevated border border-white/5 rounded-xl">
                <h3 className="text-sm font-semibold text-white mb-2">💳 Payout Account</h3>
                <p className="text-xs text-gray-500 mb-4">Connect your bank account via Stripe to receive payouts</p>
                <button onClick={async () => {
                  try {
                    const { data } = await api.post("/admin/stripe/connect");
                    window.open(data.url, "_blank");
                  } catch { toast.error("Failed to start Stripe setup"); }
                }} className="px-5 py-2.5 bg-brand-purple text-white text-sm font-semibold rounded-lg hover:brightness-110 transition-all">
                  Setup Stripe Payout
                </button>
              </div>
            )}

            {/* Summary */}
            <div className="p-5 bg-brand-elevated border border-white/5 rounded-xl space-y-3">
              <h3 className="text-sm font-semibold text-white mb-3">📋 Event Summary</h3>
              {[
                { l: "Event", v: form.title || "—" },
                { l: "Type", v: form.ticket_type === "free" ? "Free Event" : "Paid Event" },
                { l: "Venue", v: `${form.venue_name}, ${form.city} ${form.state}` },
                { l: "Date", v: form.event_start ? new Date(form.event_start).toLocaleString("en-US", { timeZone: "America/Chicago" }) : "—" },
                { l: "Tiers", v: tiers.map((t) => `${t.name} ($${form.ticket_type === "free" ? 0 : t.price})`).join(", ") },
                { l: "Media", v: `${mediaFiles.length} file(s)` },
                { l: "Food Options", v: foodOptions.length > 0 ? `${foodOptions.length} item(s)` : "None" },
              ].map((row) => (
                <div key={row.l} className="flex justify-between py-1.5 border-b border-white/5 last:border-0">
                  <span className="text-xs text-gray-500">{row.l}</span>
                  <span className="text-sm text-white font-medium text-right max-w-[60%] truncate">{row.v}</span>
                </div>
              ))}
            </div>

            <p className="text-xs text-gray-600">Your event will be saved as a <strong className="text-gray-400">draft</strong>. You can publish it from the dashboard once ready.</p>
          </div>
        )}

        {/* Navigation */}
        <div className="flex justify-between mt-8 pt-6 border-t border-white/5">
          <button onClick={() => setStep(Math.max(0, step - 1))} disabled={step === 0}
            className="flex items-center gap-1.5 px-5 py-2.5 border border-white/10 rounded-lg text-sm text-gray-400 hover:text-white disabled:opacity-30 transition-colors">
            <ArrowLeft size={14} /> Back
          </button>

          {step < STEPS.length - 1 ? (
            <button onClick={() => setStep(step + 1)} disabled={!canNext()}
              className="flex items-center gap-1.5 px-5 py-2.5 bg-brand-accent text-white text-sm font-semibold rounded-lg glow-accent hover:brightness-110 disabled:opacity-40 transition-all">
              Next <ArrowRight size={14} />
            </button>
          ) : (
            <button onClick={handleSubmit} disabled={loading}
              className="flex items-center gap-1.5 px-6 py-2.5 bg-brand-gold text-brand-bg text-sm font-bold rounded-lg glow-gold hover:brightness-110 disabled:opacity-50 transition-all">
              {loading ? "Creating..." : <><Check size={14} /> Create Event</>}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
