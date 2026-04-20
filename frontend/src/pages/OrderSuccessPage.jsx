import { useState, useEffect } from "react";
import { useParams, useSearchParams, Link } from "react-router-dom";
import { CheckCircle, Mail, Calendar, MapPin, Globe, Ticket } from "lucide-react";
import api from "../utils/api";

export default function OrderSuccessPage() {
  const { orderId } = useParams();
  const [searchParams] = useSearchParams();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [emailSent, setEmailSent] = useState(false);

  useEffect(() => {
    const sessionId = searchParams.get("session_id");

    const load = async () => {
      try {
        // For paid events: verify payment with Stripe and trigger email if needed
        if (sessionId) {
          try {
            const { data } = await api.post(`/orders/${orderId}/fulfill`, { session_id: sessionId });
            setEmailSent(data.email_sent);
          } catch {
            // Non-fatal — order may already be paid via webhook
          }
        }
        // Load the order (now paid)
        const { data } = await api.get(`/orders/${orderId}`);
        setOrder(data.order);
        if (data.order.confirmation_email_sent) setEmailSent(true);
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [orderId]);

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-brand-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center text-center px-4">
        <div>
          <p className="text-brand-textMid text-sm mb-4">Order not found.</p>
          <Link to="/my-tickets" className="text-brand-accent font-semibold hover:underline">View My Tickets</Link>
        </div>
      </div>
    );
  }

  const evt = order.events;

  return (
    <div className="max-w-lg mx-auto px-4 py-16 text-center">
      {/* Success icon */}
      <div className="w-20 h-20 rounded-full bg-teal-50 flex items-center justify-center mx-auto mb-5 border-2 border-brand-teal">
        <CheckCircle size={40} className="text-brand-teal" />
      </div>

      <h1 className="font-display text-3xl font-bold text-brand-text mb-2">Booking Confirmed!</h1>
      <p className="text-brand-textMid font-mono text-sm mb-3">Order #{order.order_number}</p>

      <div className="flex items-center justify-center gap-1.5 text-sm text-brand-textMid mb-8 bg-teal-50 border border-teal-100 rounded-xl px-4 py-2.5">
        <Mail size={14} className="text-brand-teal" />
        {emailSent
          ? "Ticket PDF sent to your inbox — check email"
          : "Confirmation email on its way to your inbox"}
      </div>

      {/* Order card */}
      <div className="bg-white border border-brand-border rounded-2xl p-6 text-left mb-6 shadow-sm">
        <h3 className="font-display text-lg font-bold text-brand-text mb-1">{evt?.title}</h3>

        {evt && (
          <div className="flex flex-wrap gap-3 text-xs text-brand-textLight mb-4">
            {evt.event_start && (
              <span className="flex items-center gap-1">
                <Calendar size={11} />
                {new Date(evt.event_start).toLocaleDateString("en-US", { timeZone: "America/Chicago", weekday: "short", month: "long", day: "numeric" })}
              </span>
            )}
            <span className="flex items-center gap-1">
              {evt.is_online ? <Globe size={11} /> : <MapPin size={11} />}
              {evt.is_online ? "Online Event" : `${evt.venue_name}, ${evt.city}`}
            </span>
          </div>
        )}

        <div className="divide-y divide-brand-border">
          {order.order_items?.map((item, i) => (
            <div key={item.id} className="flex items-center justify-between py-3">
              <div>
                <p className="text-sm font-semibold text-brand-text">
                  Ticket {i + 1} — {item.ticket_tiers?.name}
                </p>
                {item.seats?.label && (
                  <p className="text-xs text-brand-textLight">Seat: {item.seats.label}</p>
                )}
                <p className="text-xs text-brand-textLight font-mono mt-0.5 tracking-wider">{item.barcode}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-brand-text">${parseFloat(item.price).toFixed(2)}</span>
                <CheckCircle size={15} className="text-brand-teal" />
              </div>
            </div>
          ))}
        </div>

        <div className="pt-4 mt-2 flex justify-between items-center border-t border-brand-border">
          <span className="font-display text-base font-bold text-brand-text">Total Paid</span>
          <span className="font-display text-xl font-bold text-brand-text">
            {parseFloat(order.total) === 0 ? "Free" : `$${parseFloat(order.total).toFixed(2)}`}
          </span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3 justify-center">
        <Link to="/my-tickets"
          className="flex items-center gap-2 px-6 py-3 rounded-xl bg-brand-accent text-white font-bold text-sm hover:bg-brand-accentHover transition-colors">
          <Ticket size={15} /> My Tickets
        </Link>
        <Link to="/events"
          className="px-6 py-3 rounded-xl border-2 border-brand-border text-brand-text font-semibold text-sm hover:bg-brand-muted transition-colors">
          Browse More
        </Link>
      </div>
    </div>
  );
}
