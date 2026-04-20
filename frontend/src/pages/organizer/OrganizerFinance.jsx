import { useState, useEffect } from "react";
import { Banknote, ExternalLink, CheckCircle, AlertCircle, ArrowRight } from "lucide-react";
import api from "../../utils/api";
import toast from "react-hot-toast";

export default function OrganizerFinance() {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);

  useEffect(() => {
    api.get("/organizer/profile")
      .then((r) => setProfile(r.data.profile))
      .catch(() => {})
      .finally(() => setLoading(false));
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
    </div>
  );
}
