import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Calendar, Clock, MapPin, ArrowLeft, Minus, Plus, UtensilsCrossed, ChevronLeft, ChevronRight, Star, Share2, Copy, Check, X } from "lucide-react";
import api from "../utils/api";
import useAuthStore from "../hooks/useAuthStore";
import toast from "react-hot-toast";

export default function EventDetailPage() {
  const { idOrSlug } = useParams();
  const navigate = useNavigate();
  const { user } = useAuthStore();

  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [mediaIndex, setMediaIndex] = useState(0);

  const [tierSelections, setTierSelections] = useState({}); // { tierId: qty }
  const [selectedSeats, setSelectedSeats] = useState([]);
  const [foodSelections, setFoodSelections] = useState({});
  const [promoCode, setPromoCode] = useState("");
  const [bookingLoading, setBookingLoading] = useState(false);
  const [promoApplied, setPromoApplied] = useState(null); // { discount_amount, message }
  const [promoLoading, setPromoLoading] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const shareRef = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (shareRef.current && !shareRef.current.contains(e.target)) setShareOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    const fetchEvent = async () => {
      try {
        const { data } = await api.get(`/events/${idOrSlug}`);
        setEvent(data.event);
            // no auto-selection needed — user picks qty per tier
      } catch {
        toast.error("Event not found");
        navigate("/events");
      } finally {
        setLoading(false);
      }
    };
    fetchEvent();
  }, [idOrSlug]);

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-10">
        <div className="h-80 bg-brand-muted rounded-2xl animate-pulse" />
      </div>
    );
  }

  if (!event) return null;

  const isPast = new Date(event.event_end) < new Date() || event.status === "completed";
  const isCancelled = event.status === "cancelled";
  const isSalesPaused = event.sales_paused && !isPast && !isCancelled;
  const eventUrl = `${window.location.origin}/events/${event.slug || event.id}`;

  const media = event.event_media || [];
  const tiers = (event.ticket_tiers || []).filter((t) => t.is_active);
  const food = (event.food_options || []).filter((f) => f.is_active);
  const seats = event.seats || [];

  // Per-tier qty helper
  const updateTierQty = (tierId, maxPerUser, delta) => {
    setTierSelections((prev) => {
      const current = prev[tierId] || 0;
      const next = Math.min(maxPerUser || 10, Math.max(0, current + delta));
      if (next === 0) { const { [tierId]: _, ...rest } = prev; return rest; }
      return { ...prev, [tierId]: next };
    });
  };

  const totalTickets = Object.values(tierSelections).reduce((s, q) => s + q, 0);

  // Pricing
  const ticketSubtotal = tiers.reduce((sum, t) => sum + (tierSelections[t.id] || 0) * t.price, 0);
  const foodTotal = Object.entries(foodSelections).reduce((sum, [id, q]) => {
    const item = food.find((f) => f.id === id);
    return sum + (item ? item.price * q : 0);
  }, 0);
  const rawSubtotal = ticketSubtotal + foodTotal;
  const discountAmount = promoApplied?.discount_amount || 0;
  const subtotalAfterDiscount = Math.max(0, rawSubtotal - discountAmount);
  const serviceFee = event.ticket_type === "free" ? 0 : Math.round(subtotalAfterDiscount * 0.05 * 100) / 100;
  const total = Math.max(0, subtotalAfterDiscount + serviceFee);

  const updateFood = (foodId, delta) => {
    setFoodSelections((prev) => {
      const current = prev[foodId] || 0;
      const next = Math.max(0, current + delta);
      if (next === 0) { const { [foodId]: _, ...rest } = prev; return rest; }
      return { ...prev, [foodId]: next };
    });
  };

  const handleApplyPromo = async () => {
    if (!promoCode.trim()) return;
    setPromoLoading(true);
    setPromoApplied(null);
    try {
      const { data } = await api.post("/orders/validate-promo", {
        event_id: event.id,
        promo_code: promoCode,
        subtotal: rawSubtotal,
      });
      if (data.valid) {
        setPromoApplied(data);
        toast.success(data.message);
      } else {
        toast.error(data.message);
      }
    } catch {
      toast.error("Could not validate promo code");
    } finally {
      setPromoLoading(false);
    }
  };

  const handleBook = async () => {
    if (!user) { toast.error("Please sign in to book tickets"); navigate("/login"); return; }
    if (totalTickets === 0) { toast.error("Please select at least one ticket"); return; }

    setBookingLoading(true);
    try {
      const items = selectedSeats.length > 0
        ? selectedSeats.map((seat) => ({ tier_id: seat.tier_id || tiers[0]?.id, seat_id: seat.id, quantity: 1 }))
        : tiers.filter((t) => (tierSelections[t.id] || 0) > 0).map((t) => ({ tier_id: t.id, quantity: tierSelections[t.id] }));

      const foodItems = Object.entries(foodSelections).map(([food_option_id, quantity]) => ({ food_option_id, quantity }));

      const { data } = await api.post("/orders", {
        event_id: event.id, items, food_items: foodItems, promo_code: promoCode || null,
      });

      if (event.ticket_type === "free") {
        toast.success("Free tickets confirmed! Check your email.");
        navigate(`/order/${data.order.id}/success`);
      } else {
        window.location.href = data.checkout_url;
      }
    } catch (err) {
      toast.error(err.response?.data?.error || "Booking failed");
    } finally {
      setBookingLoading(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 animate-fade-in">
      <div className="flex items-center justify-between mb-5">
        <button onClick={() => navigate(-1)} className="flex items-center gap-1.5 text-sm text-brand-textLight hover:text-brand-text transition-colors">
          <ArrowLeft size={16} /> Back
        </button>

        {/* Share */}
        <div ref={shareRef} className="relative">
          <button onClick={() => {
            if (navigator.share) {
              navigator.share({ title: event.title, text: event.short_description, url: eventUrl }).catch(() => {});
            } else {
              setShareOpen((o) => !o);
            }
          }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-brand-border text-sm text-brand-textMid hover:bg-brand-muted hover:text-brand-text transition-colors">
            <Share2 size={15} /> Share
          </button>

          {shareOpen && (
            <div className="absolute right-0 top-11 w-56 bg-white border border-brand-border rounded-xl shadow-xl overflow-hidden z-50 animate-slide-up">
              <p className="px-4 py-2.5 text-[11px] font-semibold text-brand-textLight uppercase tracking-wider border-b border-brand-border">
                Share this event
              </p>
              <button onClick={() => {
                navigator.clipboard.writeText(eventUrl);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              }}
                className="w-full flex items-center gap-3 px-4 py-3 text-sm text-brand-textMid hover:bg-brand-muted transition-colors">
                {copied ? <Check size={15} className="text-brand-teal" /> : <Copy size={15} />}
                {copied ? "Copied!" : "Copy link"}
              </button>
              <a href={`https://wa.me/?text=${encodeURIComponent(`${event.title} — ${eventUrl}`)}`}
                target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-3 px-4 py-3 text-sm text-brand-textMid hover:bg-brand-muted transition-colors border-t border-brand-border">
                <span className="text-base leading-none">💬</span> WhatsApp
              </a>
              <a href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(`${event.title}`)}&url=${encodeURIComponent(eventUrl)}`}
                target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-3 px-4 py-3 text-sm text-brand-textMid hover:bg-brand-muted transition-colors border-t border-brand-border">
                <span className="text-base leading-none">𝕏</span> Post on X
              </a>
              <a href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(eventUrl)}`}
                target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-3 px-4 py-3 text-sm text-brand-textMid hover:bg-brand-muted transition-colors border-t border-brand-border">
                <span className="text-base leading-none">📘</span> Facebook
              </a>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-8 items-start">
        {/* Left Column */}
        <div>
          {/* Media */}
          <div className="relative rounded-2xl overflow-hidden mb-5 bg-brand-muted">
            {media.length > 0 ? (
              <>
                {media[mediaIndex]?.media_type === "video" ? (
                  <video src={media[mediaIndex].url} controls className="w-full h-72 sm:h-80 object-cover" />
                ) : (
                  <img src={media[mediaIndex]?.url} alt={event.title} className="w-full h-72 sm:h-80 object-cover" />
                )}
                {media.length > 1 && (
                  <>
                    <button onClick={() => setMediaIndex((i) => (i - 1 + media.length) % media.length)}
                      className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/90 shadow flex items-center justify-center hover:bg-white transition-colors">
                      <ChevronLeft size={16} />
                    </button>
                    <button onClick={() => setMediaIndex((i) => (i + 1) % media.length)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/90 shadow flex items-center justify-center hover:bg-white transition-colors">
                      <ChevronRight size={16} />
                    </button>
                    <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
                      {media.map((_, i) => (
                        <div key={i} className={`w-2 h-2 rounded-full ${i === mediaIndex ? "bg-white" : "bg-white/40"}`} />
                      ))}
                    </div>
                  </>
                )}
              </>
            ) : (
              <div className="w-full h-72 sm:h-80 flex items-center justify-center text-6xl bg-brand-muted">🎪</div>
            )}
          </div>

          {/* Badges */}
          <div className="flex gap-2 mb-3">
            {event.is_sponsored && <span className="badge badge-sponsored"><Star size={10} /> Sponsored</span>}
            {event.ticket_type === "free" && <span className="badge badge-free">Free Event</span>}
            {event.category && <span className="badge badge-category">{event.category}</span>}
          </div>

          <h1 className="font-display text-3xl sm:text-4xl font-extrabold text-brand-text mb-2 leading-tight">{event.title}</h1>
          <p className="text-brand-textMid mb-6">{event.short_description}</p>

          {/* Details Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
            {[
              { icon: <Calendar size={18} />, label: "Date", value: new Date(event.event_start).toLocaleDateString("en-US", { timeZone: "America/Chicago", weekday: "short", month: "long", day: "numeric", year: "numeric" }) },
              { icon: <Clock size={18} />, label: "Time", value: `${new Date(event.event_start).toLocaleTimeString("en-US", { timeZone: "America/Chicago", hour: "numeric", minute: "2-digit" })} — ${new Date(event.event_end).toLocaleTimeString("en-US", { timeZone: "America/Chicago", hour: "numeric", minute: "2-digit" })} CT` },
              { icon: <MapPin size={18} />, label: "Venue", value: `${event.venue_name}, ${event.city}` },
            ].map((d) => (
              <div key={d.label} className="p-4 bg-brand-muted rounded-xl">
                <div className="text-brand-accent mb-2">{d.icon}</div>
                <p className="text-[11px] text-brand-textLight uppercase tracking-wider font-semibold">{d.label}</p>
                <p className="text-sm text-brand-text font-semibold mt-0.5">{d.value}</p>
              </div>
            ))}
          </div>

          {/* Description */}
          {event.description && (
            <div className="mb-6">
              <h3 className="font-display text-lg font-bold text-brand-text mb-2">About this event</h3>
              <p className="text-sm text-brand-textMid leading-relaxed whitespace-pre-line">{event.description}</p>
            </div>
          )}

          {/* Transportation Widget */}
          {!event.is_online && (
            <div className="bg-white rounded-2xl border border-brand-border p-5 mb-6">
              <h3 className="font-display text-lg font-bold text-brand-text mb-1">How do you want to get there?</h3>
              {(event.venue_name || event.venue_address) && (
                <p className="text-xs text-brand-textLight mb-4">
                  {event.venue_name}{event.venue_name && event.venue_address ? " · " : ""}{event.venue_address}
                </p>
              )}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { emoji: "🚗", label: "Driving", mode: "driving" },
                  { emoji: "🚌", label: "Public transport", mode: "transit" },
                  { emoji: "🚲", label: "Biking", mode: "bicycling" },
                  { emoji: "🚶", label: "Walking", mode: "walking" },
                ].map(({ emoji, label, mode }) => (
                  <a
                    key={mode}
                    href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${event.venue_address}, ${event.city}, TX`)}&travelmode=${mode}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex flex-col items-center gap-2 p-3 rounded-xl border border-brand-border hover:border-brand-accent hover:bg-red-50 transition-all text-center group"
                  >
                    <span className="text-2xl">{emoji}</span>
                    <span className="text-xs font-semibold text-brand-textMid group-hover:text-brand-text">{label}</span>
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Seat Map */}
          {event.seat_map_image_url && (
            <div className="mb-6 p-5 bg-white rounded-2xl border border-brand-border">
              <h3 className="font-display text-lg font-bold text-brand-text mb-3">Venue map</h3>
              <div className="rounded-xl overflow-hidden border border-brand-border">
                <img src={event.seat_map_image_url} alt="Venue seat map" className="w-full object-contain max-h-96" />
              </div>
            </div>
          )}

          {/* Food & Drinks */}
          {food.length > 0 && (
            <div className="p-5 bg-white rounded-2xl border border-brand-border">
              <h3 className="font-display text-lg font-bold text-brand-text mb-1 flex items-center gap-2">
                <UtensilsCrossed size={18} className="text-brand-gold" /> Food & Drinks
              </h3>
              <p className="text-xs text-brand-textLight mb-4">Add to your order</p>
              <div className="space-y-2">
                {food.map((f) => (
                  <div key={f.id} className="flex items-center justify-between p-3 bg-brand-muted rounded-xl">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      {f.image_url && <img src={f.image_url} alt={f.name} className="w-11 h-11 rounded-lg object-cover flex-shrink-0" />}
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-brand-text truncate">
                          {f.name}
                          {f.is_vegetarian && <span className="ml-1 text-[10px] text-green-600">🌱</span>}
                          {f.is_vegan && <span className="ml-1 text-[10px] text-green-600">🌿</span>}
                        </p>
                        {f.description && <p className="text-xs text-brand-textLight truncate">{f.description}</p>}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 ml-3">
                      <span className="text-sm font-bold text-brand-gold font-display">${f.price}</span>
                      <div className="flex items-center gap-1.5">
                        <button onClick={() => updateFood(f.id, -1)}
                          className="w-7 h-7 rounded-md bg-white border border-brand-border flex items-center justify-center text-brand-textMid hover:border-brand-textLight">
                          <Minus size={12} />
                        </button>
                        <span className="text-sm text-brand-text w-5 text-center font-semibold">{foodSelections[f.id] || 0}</span>
                        <button onClick={() => updateFood(f.id, 1)}
                          className="w-7 h-7 rounded-md bg-white border border-brand-border flex items-center justify-center text-brand-textMid hover:border-brand-textLight">
                          <Plus size={12} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right — Booking Panel or Status Banner */}
        <div className="lg:sticky lg:top-20">
          {isCancelled ? (
            <div className="bg-white rounded-2xl border border-brand-border p-6 shadow-sm text-center">
              <div className="w-14 h-14 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-3">
                <span className="text-2xl">🚫</span>
              </div>
              <h3 className="font-display text-lg font-bold text-brand-text mb-1">Event Cancelled</h3>
              <p className="text-sm text-brand-textMid">This event has been cancelled by the organizer. No new tickets can be purchased.</p>
            </div>
          ) : isPast ? (
            <div className="bg-white rounded-2xl border border-brand-border p-6 shadow-sm text-center">
              <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-3">
                <span className="text-2xl">🎪</span>
              </div>
              <h3 className="font-display text-lg font-bold text-brand-text mb-1">This event has ended</h3>
              <p className="text-sm text-brand-textMid">
                This event took place on {new Date(event.event_start).toLocaleDateString("en-US", { timeZone: "America/Chicago", month: "long", day: "numeric", year: "numeric" })}. Ticket sales are now closed.
              </p>
            </div>
          ) : isSalesPaused ? (
            <div className="bg-white rounded-2xl border border-brand-border p-6 shadow-sm text-center">
              <div className="w-14 h-14 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-3">
                <span className="text-2xl">⏸️</span>
              </div>
              <h3 className="font-display text-lg font-bold text-brand-text mb-1">Sales Paused</h3>
              <p className="text-sm text-brand-textMid">Ticket sales for this event are temporarily paused by the organizer. Check back soon.</p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-brand-border p-5 shadow-sm">
              <h3 className="font-display text-xl font-bold text-brand-text mb-5">Select tickets</h3>

              {/* Tiers — per-tier quantity controls */}
              <div className="space-y-2 mb-5">
                {tiers.map((t) => {
                  const remaining = t.total_quantity - t.sold_quantity;
                  const selected = tierSelections[t.id] || 0;
                  const soldOut = remaining <= 0;
                  return (
                    <div key={t.id} className={`p-3.5 rounded-xl border transition-all ${
                      selected > 0 ? "border-2 border-brand-accent bg-red-50/30" : "border border-brand-border bg-white"
                    } ${soldOut ? "opacity-40" : ""}`}>
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-brand-text">{t.name}</p>
                          {t.description && <p className="text-xs text-brand-textLight mt-0.5">{t.description}</p>}
                          <p className="text-[11px] text-brand-textLight mt-1">{soldOut ? "Sold out" : `${remaining} left`}</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="font-display text-base font-bold text-brand-text">
                            {t.price === 0 ? "Free" : `$${t.price}`}
                          </span>
                          {!soldOut && (
                            <div className="flex items-center gap-1">
                              <button onClick={() => updateTierQty(t.id, t.max_per_user, -1)} disabled={selected === 0}
                                className="w-7 h-7 rounded-md bg-brand-muted border border-brand-border flex items-center justify-center hover:border-brand-textLight disabled:opacity-30">
                                <Minus size={12} />
                              </button>
                              <span className="text-sm font-bold text-brand-text w-5 text-center">{selected}</span>
                              <button onClick={() => updateTierQty(t.id, t.max_per_user, 1)} disabled={selected >= (t.max_per_user || 10)}
                                className="w-7 h-7 rounded-md bg-brand-muted border border-brand-border flex items-center justify-center hover:border-brand-textLight disabled:opacity-30">
                                <Plus size={12} />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Promo */}
              <div className="mb-5">
                <div className="flex gap-2">
                  <input
                    value={promoCode}
                    onChange={(e) => { setPromoCode(e.target.value.toUpperCase()); setPromoApplied(null); }}
                    placeholder="Promo code"
                    className="input-field flex-1 text-sm py-2.5"
                    onKeyDown={(e) => e.key === "Enter" && handleApplyPromo()}
                  />
                  <button
                    onClick={handleApplyPromo}
                    disabled={promoLoading || !promoCode.trim()}
                    className="px-4 py-2.5 border border-brand-accent text-brand-accent rounded-xl text-sm font-semibold hover:bg-red-50 transition-colors disabled:opacity-40">
                    {promoLoading ? "…" : promoApplied ? "Applied" : "Apply"}
                  </button>
                </div>
                {promoApplied && (
                  <p className="mt-1.5 text-xs text-brand-teal font-semibold flex items-center gap-1">
                    <Check size={12} /> {promoApplied.message}
                  </p>
                )}
              </div>

              {/* Price Breakdown */}
              <div className="border-t border-brand-border pt-4 mb-5 space-y-1.5">
                {tiers.filter((t) => (tierSelections[t.id] || 0) > 0).map((t) => (
                  <div key={t.id} className="flex justify-between text-sm text-brand-textMid">
                    <span>{t.name} × {tierSelections[t.id]}</span>
                    <span>{t.price === 0 ? "Free" : `$${(t.price * tierSelections[t.id]).toFixed(2)}`}</span>
                  </div>
                ))}
                {foodTotal > 0 && (
                  <div className="flex justify-between text-sm text-brand-textMid">
                    <span>Food & Drinks</span><span>${foodTotal.toFixed(2)}</span>
                  </div>
                )}
                {discountAmount > 0 && (
                  <div className="flex justify-between text-sm text-brand-teal font-semibold">
                    <span>Promo discount</span><span>−${discountAmount.toFixed(2)}</span>
                  </div>
                )}
                {serviceFee > 0 && (
                  <div className="flex justify-between text-sm text-brand-textLight">
                    <span>Service fee</span><span>${serviceFee.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between text-lg font-bold text-brand-text font-display pt-3 border-t border-brand-border">
                  <span>Total</span><span>${total.toFixed(2)}</span>
                </div>
              </div>

              <button onClick={handleBook} disabled={bookingLoading || totalTickets === 0}
                className={`w-full py-3.5 rounded-xl font-semibold text-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
                  event.ticket_type === "free"
                    ? "bg-brand-teal text-white hover:brightness-110"
                    : "btn-primary"
                }`}>
                {bookingLoading
                  ? "Processing..."
                  : !user
                  ? "Sign in to book"
                  : totalTickets === 0
                  ? "Select tickets above"
                  : event.ticket_type === "free"
                  ? `🎟 Get ${totalTickets} free ticket${totalTickets !== 1 ? "s" : ""}`
                  : `🎟 Reserve & pay $${total.toFixed(2)}`}
              </button>

              {event.ticket_type !== "free" && (
                <p className="text-[11px] text-brand-textLight text-center mt-2">Seats held for 30 minutes during checkout</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
