import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Clock, ShieldCheck } from "lucide-react";
import api from "../utils/api";

export default function CheckoutPage() {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState(null);
  const [timeLeft, setTimeLeft] = useState(1800); // 30 min default

  useEffect(() => {
    api.get(`/orders/${orderId}`)
      .then(({ data }) => {
        setOrder(data.order);
        if (data.order.status === "paid") navigate(`/order/${orderId}/success`);
        if (data.order.reservation_expires_at) {
          const diff = Math.max(0, Math.floor((new Date(data.order.reservation_expires_at) - Date.now()) / 1000));
          setTimeLeft(diff);
        }
      })
      .catch(() => navigate("/"));
  }, [orderId]);

  useEffect(() => {
    if (timeLeft <= 0) { navigate("/events"); return; }
    const t = setInterval(() => setTimeLeft((p) => Math.max(0, p - 1)), 1000);
    return () => clearInterval(t);
  }, [timeLeft]);

  if (!order) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-brand-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const mins = Math.floor(timeLeft / 60);
  const secs = timeLeft % 60;
  const isUrgent = timeLeft < 120;

  return (
    <div className="max-w-lg mx-auto px-4 py-12">
      {/* Timer */}
      <div className="text-center mb-8">
        <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold mb-3 ${
          isUrgent ? "bg-red-50 text-brand-accent border border-red-100" : "bg-amber-50 text-amber-700 border border-amber-100"
        }`}>
          <Clock size={14} />
          Seats reserved
        </div>
        <div className={`font-display text-5xl font-extrabold ${isUrgent ? "text-brand-accent" : "text-brand-text"}`}>
          {mins}:{secs.toString().padStart(2, "0")}
        </div>
        <p className="text-sm text-brand-textMid mt-2">Complete payment before your reservation expires</p>
      </div>

      {/* Order summary */}
      <div className="bg-white border border-brand-border rounded-2xl p-6 shadow-sm">
        <h3 className="font-display text-lg font-bold text-brand-text mb-4">{order.events?.title}</h3>

        <div className="space-y-2 border-t border-brand-border pt-4">
          <div className="flex justify-between text-sm text-brand-textMid">
            <span>Subtotal</span>
            <span>${parseFloat(order.subtotal || 0).toFixed(2)}</span>
          </div>
          {parseFloat(order.food_total) > 0 && (
            <div className="flex justify-between text-sm text-brand-textMid">
              <span>Food & drinks</span>
              <span>${parseFloat(order.food_total).toFixed(2)}</span>
            </div>
          )}
          {parseFloat(order.discount_amount) > 0 && (
            <div className="flex justify-between text-sm text-brand-teal font-semibold">
              <span>Discount</span>
              <span>-${parseFloat(order.discount_amount).toFixed(2)}</span>
            </div>
          )}
          {parseFloat(order.platform_fee) > 0 && (
            <div className="flex justify-between text-sm text-brand-textMid">
              <span>Platform fee</span>
              <span>${parseFloat(order.platform_fee).toFixed(2)}</span>
            </div>
          )}
          <div className="flex justify-between text-lg font-bold text-brand-text font-display pt-3 border-t border-brand-border">
            <span>Total</span>
            <span>${parseFloat(order.total).toFixed(2)}</span>
          </div>
        </div>

        <div className="flex items-center justify-center gap-1.5 mt-5 text-xs text-brand-textLight">
          <ShieldCheck size={13} className="text-brand-teal" />
          Secure payment via Stripe — you'll be redirected momentarily
        </div>
      </div>
    </div>
  );
}
