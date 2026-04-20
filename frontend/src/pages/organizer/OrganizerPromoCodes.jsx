import { useState, useEffect } from "react";
import { Plus, Tag, Trash2, ToggleLeft, ToggleRight, Copy, Check, X } from "lucide-react";
import api from "../../utils/api";
import toast from "react-hot-toast";
import { centralInputToUtc } from "../../utils/dateUtils";

function randomCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

const EMPTY_FORM = {
  code: "",
  event_id: "",
  discount_type: "percent",
  discount_value: "",
  max_uses: "",
  valid_until: "",
  min_order_amount: "",
  restricted_to_email: "",
};

export default function OrganizerPromoCodes() {
  const [codes, setCodes] = useState([]);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_FORM, code: randomCode() });
  const [submitting, setSubmitting] = useState(false);
  const [copiedId, setCopiedId] = useState(null);
  const [eventFilter, setEventFilter] = useState("");

  useEffect(() => {
    // Fetch events and promo codes independently so a failure in one doesn't block the other
    api.get("/organizer/events", { params: { limit: 100 } })
      .then((res) => setEvents(res.data.events || []))
      .catch(() => {});

    api.get("/organizer/promo-codes")
      .then((res) => setCodes(res.data.promo_codes || []))
      .catch(() => toast.error("Could not load promo codes."))
      .finally(() => setLoading(false));
  }, []);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.code.trim() || !form.discount_value) {
      toast.error("Code and discount value are required.");
      return;
    }
    setSubmitting(true);
    try {
      const { data } = await api.post("/organizer/promo-codes", {
        ...form,
        discount_value: parseFloat(form.discount_value),
        max_uses: form.max_uses ? parseInt(form.max_uses) : null,
        min_order_amount: form.min_order_amount ? parseFloat(form.min_order_amount) : 0,
        event_id: form.event_id || null,
        valid_until: form.valid_until ? centralInputToUtc(form.valid_until) : null,
        restricted_to_email: form.restricted_to_email.trim() || null,
      });
      setCodes((prev) => [data.promo_code, ...prev]);
      setForm({ ...EMPTY_FORM, code: randomCode() });
      setShowForm(false);
      toast.success("Promo code created!");
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to create promo code");
    } finally {
      setSubmitting(false);
    }
  };

  const toggleActive = async (id, current) => {
    try {
      const { data } = await api.patch(`/organizer/promo-codes/${id}`, { is_active: !current });
      setCodes((prev) => prev.map((c) => c.id === id ? data.promo_code : c));
      toast.success(data.promo_code.is_active ? "Code activated" : "Code deactivated");
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to update");
    }
  };

  const handleDelete = async (id) => {
    if (!confirm("Delete this promo code?")) return;
    try {
      await api.delete(`/organizer/promo-codes/${id}`);
      setCodes((prev) => prev.filter((c) => c.id !== id));
      toast.success("Promo code deleted");
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to delete");
    }
  };

  const copyCode = (code, id) => {
    navigator.clipboard.writeText(code);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const filtered = eventFilter
    ? codes.filter((c) => c.event_id === eventFilter || (!c.event_id && eventFilter === "__all__"))
    : codes;

  const isExpired = (c) => c.valid_until && new Date(c.valid_until) < new Date();
  const isMaxed = (c) => c.max_uses && c.used_count >= c.max_uses;

  return (
    <div className="p-6 md:p-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-2xl font-bold text-brand-text">Promo Codes</h1>
          <p className="text-sm text-brand-textMid mt-0.5">Create discount codes for your events — general or personalized to a specific attendee.</p>
        </div>
        <button onClick={() => { setShowForm(true); set("code", randomCode()); }}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-brand-accent text-white text-sm font-bold hover:bg-brand-accentHover transition-colors">
          <Plus size={15} /> New Code
        </button>
      </div>

      {/* Create form */}
      {showForm && (
        <div className="bg-white rounded-2xl border border-brand-border p-6 mb-6 shadow-sm">
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-display text-lg font-bold text-brand-text">New Promo Code</h2>
            <button onClick={() => setShowForm(false)} className="text-brand-textLight hover:text-brand-text">
              <X size={18} />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Code */}
              <div>
                <label className="block text-sm font-semibold text-brand-text mb-1.5">Code *</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={form.code}
                    onChange={(e) => set("code", e.target.value.toUpperCase().replace(/\s/g, ""))}
                    className="flex-1 px-4 py-2.5 rounded-xl border border-brand-border bg-brand-muted text-sm font-mono outline-none focus:border-brand-accent focus:bg-white transition-colors uppercase"
                    placeholder="SAVE20"
                    maxLength={20}
                    required
                  />
                  <button type="button" onClick={() => set("code", randomCode())}
                    className="px-3 py-2.5 rounded-xl border border-brand-border text-xs text-brand-textMid hover:bg-brand-muted transition-colors whitespace-nowrap">
                    Randomize
                  </button>
                </div>
              </div>

              {/* Event (optional) */}
              <div>
                <label className="block text-sm font-semibold text-brand-text mb-1.5">
                  Apply to event <span className="text-brand-textLight font-normal">(leave blank for all your events)</span>
                </label>
                <select value={form.event_id} onChange={(e) => set("event_id", e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-brand-border bg-brand-muted text-sm outline-none focus:border-brand-accent">
                  <option value="">All my events</option>
                  {events.map((ev) => <option key={ev.id} value={ev.id}>{ev.title}</option>)}
                </select>
              </div>

              {/* Discount type */}
              <div>
                <label className="block text-sm font-semibold text-brand-text mb-1.5">Discount type *</label>
                <div className="grid grid-cols-2 gap-2">
                  {[{ id: "percent", label: "% Percent" }, { id: "flat", label: "$ Flat amount" }].map((t) => (
                    <button key={t.id} type="button" onClick={() => set("discount_type", t.id)}
                      className={`py-2.5 rounded-xl text-sm font-semibold border-2 transition-all ${
                        form.discount_type === t.id ? "border-brand-accent bg-red-50 text-brand-accent" : "border-brand-border text-brand-textMid"
                      }`}>
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Discount value */}
              <div>
                <label className="block text-sm font-semibold text-brand-text mb-1.5">
                  {form.discount_type === "percent" ? "Discount %" : "Discount amount ($)"} *
                </label>
                <input
                  type="number" min="0" max={form.discount_type === "percent" ? 100 : undefined}
                  step="0.01"
                  value={form.discount_value}
                  onChange={(e) => set("discount_value", e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-brand-border bg-brand-muted text-sm outline-none focus:border-brand-accent focus:bg-white transition-colors"
                  placeholder={form.discount_type === "percent" ? "e.g. 20" : "e.g. 10.00"}
                  required
                />
              </div>

              {/* Max uses */}
              <div>
                <label className="block text-sm font-semibold text-brand-text mb-1.5">
                  Max uses <span className="text-brand-textLight font-normal">(blank = unlimited)</span>
                </label>
                <input type="number" min="1" value={form.max_uses}
                  onChange={(e) => set("max_uses", e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-brand-border bg-brand-muted text-sm outline-none focus:border-brand-accent focus:bg-white transition-colors"
                  placeholder="e.g. 50" />
              </div>

              {/* Expiry */}
              <div>
                <label className="block text-sm font-semibold text-brand-text mb-1.5">
                  Expires on <span className="text-brand-textLight font-normal">(optional)</span>
                </label>
                <input type="datetime-local" value={form.valid_until}
                  onChange={(e) => set("valid_until", e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-brand-border bg-brand-muted text-sm outline-none focus:border-brand-accent focus:bg-white transition-colors" />
              </div>

              {/* Min order */}
              <div>
                <label className="block text-sm font-semibold text-brand-text mb-1.5">
                  Min order amount <span className="text-brand-textLight font-normal">(optional)</span>
                </label>
                <input type="number" min="0" step="0.01" value={form.min_order_amount}
                  onChange={(e) => set("min_order_amount", e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-brand-border bg-brand-muted text-sm outline-none focus:border-brand-accent focus:bg-white transition-colors"
                  placeholder="e.g. 25.00" />
              </div>

              {/* Restricted to email */}
              <div>
                <label className="block text-sm font-semibold text-brand-text mb-1.5">
                  Restrict to email <span className="text-brand-textLight font-normal">(personalized — only this person can use it)</span>
                </label>
                <input type="email" value={form.restricted_to_email}
                  onChange={(e) => set("restricted_to_email", e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-brand-border bg-brand-muted text-sm outline-none focus:border-brand-accent focus:bg-white transition-colors"
                  placeholder="attendee@email.com" />
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button type="submit" disabled={submitting}
                className="px-6 py-2.5 rounded-xl bg-brand-accent text-white text-sm font-bold hover:bg-brand-accentHover disabled:opacity-50 transition-colors">
                {submitting ? "Creating…" : "Create Code"}
              </button>
              <button type="button" onClick={() => setShowForm(false)}
                className="px-6 py-2.5 rounded-xl border border-brand-border text-sm text-brand-textMid hover:bg-brand-muted transition-colors">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Event filter */}
      {events.length > 0 && (
        <div className="flex gap-2 mb-4 flex-wrap">
          <button onClick={() => setEventFilter("")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${!eventFilter ? "bg-brand-accent text-white" : "bg-brand-muted text-brand-textMid hover:text-brand-text"}`}>
            All codes
          </button>
          {events.map((ev) => (
            <button key={ev.id} onClick={() => setEventFilter(ev.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors max-w-[180px] truncate ${eventFilter === ev.id ? "bg-brand-accent text-white" : "bg-brand-muted text-brand-textMid hover:text-brand-text"}`}>
              {ev.title}
            </button>
          ))}
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-2xl border border-brand-border overflow-hidden">
        {loading ? (
          <div className="divide-y divide-brand-border">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-4 px-6 py-4">
                <div className="h-5 w-24 bg-brand-muted rounded animate-pulse" />
                <div className="flex-1 h-4 bg-brand-muted rounded animate-pulse" />
                <div className="h-5 w-16 bg-brand-muted rounded-full animate-pulse" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <Tag size={36} className="text-brand-textLight mx-auto mb-3" />
            <p className="text-sm text-brand-textMid">No promo codes yet.</p>
            <button onClick={() => setShowForm(true)}
              className="mt-4 text-sm text-brand-accent font-semibold hover:underline">
              Create your first code
            </button>
          </div>
        ) : (
          <>
            <div className="hidden md:grid grid-cols-[auto_1fr_auto_auto_auto_auto] gap-4 px-6 py-3 text-[11px] font-semibold text-brand-textLight uppercase tracking-wider bg-brand-muted">
              <span>Code</span><span>Details</span><span>Uses</span><span>Status</span><span>Active</span><span></span>
            </div>
            <div className="divide-y divide-brand-border">
              {filtered.map((c) => {
                const expired = isExpired(c);
                const maxed = isMaxed(c);
                const effectivelyInactive = !c.is_active || expired || maxed;
                return (
                  <div key={c.id} className="grid grid-cols-1 md:grid-cols-[auto_1fr_auto_auto_auto_auto] gap-2 md:gap-4 px-6 py-4 items-center hover:bg-brand-muted transition-colors">
                    {/* Code + copy */}
                    <div className="flex items-center gap-2">
                      <span className={`font-mono text-sm font-bold ${effectivelyInactive ? "text-brand-textLight" : "text-brand-text"}`}>
                        {c.code}
                      </span>
                      <button onClick={() => copyCode(c.code, c.id)}
                        className="text-brand-textLight hover:text-brand-accent transition-colors">
                        {copiedId === c.id ? <Check size={13} className="text-brand-teal" /> : <Copy size={13} />}
                      </button>
                    </div>

                    {/* Details */}
                    <div className="min-w-0 space-y-0.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold text-brand-text">
                          {c.discount_type === "percent" ? `${c.discount_value}% off` : `$${c.discount_value} off`}
                        </span>
                        {c.events && (
                          <span className="text-[10px] text-brand-gold font-semibold bg-amber-50 px-1.5 py-0.5 rounded-full">
                            {c.events.title}
                          </span>
                        )}
                        {!c.event_id && (
                          <span className="text-[10px] text-brand-teal font-semibold bg-teal-50 px-1.5 py-0.5 rounded-full">
                            All events
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-3 text-[11px] text-brand-textLight">
                        {c.restricted_to_email && (
                          <span className="flex items-center gap-1 text-purple-600 font-semibold">
                            👤 {c.restricted_to_email}
                          </span>
                        )}
                        {c.valid_until && (
                          <span className={expired ? "text-brand-accent" : ""}>
                            Expires {new Date(c.valid_until).toLocaleDateString("en-US", { timeZone: "America/Chicago", month: "short", day: "numeric", year: "numeric" })}
                          </span>
                        )}
                        {c.min_order_amount > 0 && <span>Min ${c.min_order_amount}</span>}
                      </div>
                    </div>

                    {/* Uses */}
                    <div className="text-xs text-brand-textMid whitespace-nowrap text-right">
                      <span className={`font-semibold ${maxed ? "text-brand-accent" : "text-brand-text"}`}>{c.used_count}</span>
                      {c.max_uses ? <span> / {c.max_uses}</span> : " uses"}
                    </div>

                    {/* Status badge */}
                    <div>
                      {expired ? (
                        <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-brand-muted text-brand-textLight whitespace-nowrap">Expired</span>
                      ) : maxed ? (
                        <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-red-50 text-brand-accent whitespace-nowrap">Maxed out</span>
                      ) : c.is_active ? (
                        <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-teal-50 text-brand-teal whitespace-nowrap">Active</span>
                      ) : (
                        <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-brand-muted text-brand-textLight whitespace-nowrap">Inactive</span>
                      )}
                    </div>

                    {/* Toggle */}
                    <button onClick={() => toggleActive(c.id, c.is_active)}
                      title={c.is_active ? "Deactivate" : "Activate"}
                      className="text-brand-textLight hover:text-brand-accent transition-colors">
                      {c.is_active
                        ? <ToggleRight size={22} className="text-brand-teal" />
                        : <ToggleLeft size={22} />}
                    </button>

                    {/* Delete */}
                    <button onClick={() => handleDelete(c.id)}
                      className="text-brand-textLight hover:text-brand-accent transition-colors"
                      title="Delete">
                      <Trash2 size={15} />
                    </button>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
