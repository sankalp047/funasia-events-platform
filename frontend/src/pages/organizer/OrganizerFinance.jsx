import { useState, useEffect } from "react";
import { Banknote, ExternalLink, CheckCircle, AlertCircle, ArrowRight } from "lucide-react";
import api from "../../utils/api";
import toast from "react-hot-toast";

export default function OrganizerFinance() {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [revenue, setRevenue] = useState([]);
  const [revenueLoading, setRevenueLoading] = useState(true);

  useEffect(() => {
    api.get("/organizer/profile")
      .then((r) => setProfile(r.data.profile))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    api.get("/organizer/revenue")
      .then((r) => setRevenue(r.data.revenue || []))
      .catch(() => {})
      .finally(() => setRevenueLoading(false));
  }, []);

  const handleConnectStripe = async () => {
    setConnecting(true);
    try {
      const { data } = await api.post("/admin/stripe/connect");
      if (data.url) window.location.href = data.url;
    } catch {
      toast.error("Failed to connect Stripe. Please try again.");
    } finally {
      setConnecting(false);
    }
  };

  const isConnected = profile?.stripe_onboarded && profile?.stripe_account_id;

  return (
    <div className="p-6 md:p-8 max-w-3xl mx-auto">
      <div className="mb-8">
        <h1 className="font-display text-2xl font-bold text-brand-text">Finance</h1>
        <p className="text-sm text-brand-textMid mt-0.5">Manage your payout account and bank details.</p>
      </div>

      {/* Stripe Connect card */}
      <div className="bg-white rounded-2xl border border-brand-border p-6 mb-6">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-brand-muted flex items-center justify-center shrink-0">
            <Banknote size={22} className="text-brand-textMid" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <h2 className="font-semibold text-brand-text">Payout Account</h2>
              {isConnected ? (
                <span className="flex items-center gap-1 text-[10px] font-bold bg-teal-50 text-brand-teal px-2 py-0.5 rounded-full">
                  <CheckCircle size={10} /> Connected
                </span>
              ) : (
                <span className="flex items-center gap-1 text-[10px] font-bold bg-amber-50 text-amber-600 px-2 py-0.5 rounded-full">
                  <AlertCircle size={10} /> Not connected
                </span>
              )}
            </div>
            <p className="text-sm text-brand-textMid mb-4">
              {isConnected
                ? "Your Stripe account is connected. Payouts are automatically sent after your events."
                : "Connect your bank account via Stripe to receive payouts from ticket sales. Required before publishing paid events."}
            </p>

            {isConnected ? (
              <div className="space-y-2">
                {profile?.stripe_account_id && (
                  <p className="text-xs text-brand-textLight">
                    Account ID: <span className="font-mono">{profile.stripe_account_id}</span>
                  </p>
                )}
                {profile?.default_bank_name && (
                  <p className="text-xs text-brand-textLight">
                    Bank: {profile.default_bank_name}
                    {profile.default_bank_last4 && ` ····${profile.default_bank_last4}`}
                  </p>
                )}
                <button onClick={handleConnectStripe} disabled={connecting}
                  className="flex items-center gap-2 text-sm text-brand-accent font-semibold hover:underline mt-2">
                  Update payout settings <ExternalLink size={13} />
                </button>
              </div>
            ) : (
              <button onClick={handleConnectStripe} disabled={connecting || loading}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-brand-accent text-white text-sm font-bold hover:bg-brand-accentHover transition-colors disabled:opacity-60">
                {connecting ? "Connecting…" : <>Connect Bank Account <ArrowRight size={14} /></>}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* How payouts work */}
      <div className="bg-brand-muted rounded-2xl p-6">
        <h3 className="font-semibold text-brand-text mb-4">How payouts work</h3>
        <div className="space-y-3">
          {[
            { step: "1", text: "Attendees purchase tickets via Stripe Checkout." },
            { step: "2", text: "FunAsia collects a platform fee per ticket." },
            { step: "3", text: "The remaining balance is transferred to your connected bank account." },
            { step: "4", text: "Payouts are processed within 2 business days after your event." },
          ].map(({ step, text }) => (
            <div key={step} className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-brand-accent text-white text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                {step}
              </div>
              <p className="text-sm text-brand-textMid">{text}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Revenue by Event */}
      <div className="mt-6">
        <h3 className="font-display text-lg font-bold text-brand-text mb-4">Revenue by Event</h3>

        {revenueLoading ? (
          <div className="space-y-3">
            {[1,2,3].map((i) => <div key={i} className="h-16 bg-brand-muted rounded-2xl animate-pulse" />)}
          </div>
        ) : revenue.length === 0 ? (
          <div className="bg-brand-muted rounded-2xl p-8 text-center">
            <p className="text-sm text-brand-textMid">No paid orders yet. Revenue will appear here once attendees purchase tickets.</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-brand-border overflow-hidden">
            {/* Header row */}
            <div className="hidden sm:grid grid-cols-[1fr_auto_auto_auto_auto] gap-4 px-5 py-3 bg-brand-muted text-[11px] font-semibold text-brand-textLight uppercase tracking-wider">
              <span>Event</span>
              <span className="text-right">Tickets</span>
              <span className="text-right">Orders</span>
              <span className="text-right">Gross</span>
              <span className="text-right">Net</span>
            </div>
            <div className="divide-y divide-brand-border">
              {revenue.map((evt) => (
                <div key={evt.id} className="grid grid-cols-1 sm:grid-cols-[1fr_auto_auto_auto_auto] gap-1 sm:gap-4 px-5 py-4 items-center hover:bg-brand-muted transition-colors">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-brand-text truncate">{evt.title}</p>
                    <p className="text-xs text-brand-textLight">
                      {new Date(evt.event_start).toLocaleDateString("en-US", { timeZone: "America/Chicago", month: "short", day: "numeric", year: "numeric" })}
                      <span className={`ml-2 text-[10px] font-bold px-1.5 py-0.5 rounded-full capitalize ${
                        evt.status === "published" ? "bg-teal-50 text-brand-teal" :
                        evt.status === "completed" ? "bg-blue-50 text-blue-600" :
                        "bg-brand-muted text-brand-textLight"
                      }`}>{evt.status}</span>
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-brand-text">{evt.tickets_sold}/{evt.total_tickets}</p>
                    <p className="text-[10px] text-brand-textLight">tickets</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-brand-text">{evt.orders_count}</p>
                    <p className="text-[10px] text-brand-textLight">orders</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-brand-text">${evt.gross_revenue.toFixed(2)}</p>
                    <p className="text-[10px] text-brand-textLight">gross</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-brand-teal">${evt.net_revenue.toFixed(2)}</p>
                    <p className="text-[10px] text-brand-textLight">net</p>
                  </div>
                </div>
              ))}
            </div>
            {/* Total row */}
            {revenue.length > 0 && (
              <div className="flex items-center justify-between px-5 py-4 bg-brand-muted border-t border-brand-border">
                <p className="text-sm font-bold text-brand-text">Total across all events</p>
                <div className="flex items-center gap-8">
                  <div className="text-right">
                    <p className="text-xs text-brand-textLight">Gross</p>
                    <p className="text-base font-bold text-brand-text">${revenue.reduce((s, e) => s + e.gross_revenue, 0).toFixed(2)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-brand-textLight">Net</p>
                    <p className="text-base font-bold text-brand-teal">${revenue.reduce((s, e) => s + e.net_revenue, 0).toFixed(2)}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
