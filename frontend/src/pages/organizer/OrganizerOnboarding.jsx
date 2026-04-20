import { useState, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Upload, ArrowRight, ArrowLeft, Check, Building2, User, MapPin } from "lucide-react";
import useAuthStore from "../../hooks/useAuthStore";
import api from "../../utils/api";
import toast from "react-hot-toast";

const STEPS = [
  { id: "org",     label: "Organization",  icon: Building2 },
  { id: "contact", label: "Contact Info",  icon: User },
  { id: "address", label: "Address",       icon: MapPin },
];

export default function OrganizerOnboarding() {
  const { user, init } = useAuthStore();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const logoInputRef = useRef(null);

  const [form, setForm] = useState({
    org_name: "",
    org_logo_url: "",
    first_name: user?.full_name?.split(" ")[0] || "",
    last_name: user?.full_name?.split(" ").slice(1).join(" ") || "",
    job_title: "",
    company: "",
    website: "",
    business_email: user?.email || "",
    business_phone: "",
    home_address: "",
    billing_address: "",
  });

  const set = (field, value) => setForm((f) => ({ ...f, [field]: value }));

  const isStepValid = () => {
    if (step === 0) return form.org_name.trim().length >= 2;
    if (step === 1) return form.first_name.trim() && form.last_name.trim() && form.business_email.trim();
    return true;
  };

  const handleLogoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const { createClient } = await import("@supabase/supabase-js");
      const supabase = createClient(
        import.meta.env.VITE_SUPABASE_URL,
        import.meta.env.VITE_SUPABASE_ANON_KEY
      );
      const path = `org-logos/${Date.now()}-${file.name}`;
      const { error } = await supabase.storage.from("event-media").upload(path, file);
      if (error) throw error;
      const { data: { publicUrl } } = supabase.storage.from("event-media").getPublicUrl(path);
      set("org_logo_url", publicUrl);
      toast.success("Logo uploaded");
    } catch {
      toast.error("Failed to upload logo");
    }
  };

  const handleSubmit = async () => {
    if (!isStepValid()) return;
    setSubmitting(true);
    try {
      await api.post("/organizer/profile", form);
      await init(); // Re-fetch user so role updates to 'admin'
      toast.success("Welcome to FunAsia for Organizers!");
      navigate("/organizer");
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to save profile");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-brand-bg flex flex-col">
      {/* Top bar */}
      <div className="bg-white border-b border-brand-border px-4 py-4 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2">
          <span className="text-xl">🎪</span>
          <span className="font-display text-lg font-extrabold text-brand-text">
            Fun<span className="text-brand-accent">Asia</span>
          </span>
        </Link>
        <Link to="/" className="text-sm text-brand-textMid hover:text-brand-text transition-colors">
          ← Back to events
        </Link>
      </div>

      <div className="flex-1 flex items-start justify-center py-12 px-4">
        <div className="w-full max-w-xl">
          {/* Progress steps */}
          <div className="flex items-center justify-between mb-10">
            {STEPS.map((s, i) => {
              const Icon = s.icon;
              const done = i < step;
              const active = i === step;
              return (
                <div key={s.id} className="flex items-center gap-2 flex-1">
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0 transition-all ${
                    done ? "bg-brand-teal text-white" :
                    active ? "bg-brand-accent text-white" :
                    "bg-brand-muted text-brand-textLight border border-brand-border"
                  }`}>
                    {done ? <Check size={15} strokeWidth={3} /> : <Icon size={15} />}
                  </div>
                  <div className="hidden sm:block">
                    <p className={`text-xs font-semibold ${active ? "text-brand-text" : "text-brand-textLight"}`}>{s.label}</p>
                  </div>
                  {i < STEPS.length - 1 && (
                    <div className={`h-px flex-1 mx-2 ${i < step ? "bg-brand-teal" : "bg-brand-border"}`} />
                  )}
                </div>
              );
            })}
          </div>

          {/* Card */}
          <div className="bg-white rounded-2xl border border-brand-border shadow-sm p-8">

            {/* Step 0: Organization */}
            {step === 0 && (
              <div>
                <h1 className="font-display text-2xl font-bold text-brand-text mb-1">Your organization</h1>
                <p className="text-sm text-brand-textMid mb-6">This is how attendees will see you on FunAsia.</p>

                {/* Logo upload */}
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-20 h-20 rounded-xl border-2 border-dashed border-brand-border flex items-center justify-center bg-brand-muted overflow-hidden">
                    {form.org_logo_url ? (
                      <img src={form.org_logo_url} alt="Logo" className="w-full h-full object-cover" />
                    ) : (
                      <Upload size={20} className="text-brand-textLight" />
                    )}
                  </div>
                  <div>
                    <button onClick={() => logoInputRef.current?.click()}
                      className="text-sm font-semibold text-brand-accent hover:underline">
                      Upload logo
                    </button>
                    <p className="text-xs text-brand-textLight mt-0.5">JPEG or PNG, max 10MB</p>
                    <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-brand-text mb-1.5">Organization name *</label>
                    <input
                      type="text"
                      value={form.org_name}
                      onChange={(e) => set("org_name", e.target.value)}
                      placeholder="e.g. Dallas Desi Events"
                      className="w-full px-4 py-3 rounded-xl border border-brand-border bg-brand-muted text-sm text-brand-text placeholder-brand-textLight outline-none focus:border-brand-accent focus:bg-white transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-brand-text mb-1.5">Company (optional)</label>
                    <input
                      type="text"
                      value={form.company}
                      onChange={(e) => set("company", e.target.value)}
                      placeholder="e.g. 4Visions LLC"
                      className="w-full px-4 py-3 rounded-xl border border-brand-border bg-brand-muted text-sm text-brand-text placeholder-brand-textLight outline-none focus:border-brand-accent focus:bg-white transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-brand-text mb-1.5">Website (optional)</label>
                    <input
                      type="url"
                      value={form.website}
                      onChange={(e) => set("website", e.target.value)}
                      placeholder="https://yoursite.com"
                      className="w-full px-4 py-3 rounded-xl border border-brand-border bg-brand-muted text-sm text-brand-text placeholder-brand-textLight outline-none focus:border-brand-accent focus:bg-white transition-colors"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Step 1: Contact Info */}
            {step === 1 && (
              <div>
                <h1 className="font-display text-2xl font-bold text-brand-text mb-1">Contact information</h1>
                <p className="text-sm text-brand-textMid mb-6">Used for event communications and payouts.</p>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-brand-text mb-1.5">First name *</label>
                    <input type="text" value={form.first_name} onChange={(e) => set("first_name", e.target.value)}
                      placeholder="Sankalp"
                      className="w-full px-4 py-3 rounded-xl border border-brand-border bg-brand-muted text-sm outline-none focus:border-brand-accent focus:bg-white transition-colors" />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-brand-text mb-1.5">Last name *</label>
                    <input type="text" value={form.last_name} onChange={(e) => set("last_name", e.target.value)}
                      placeholder="Singh"
                      className="w-full px-4 py-3 rounded-xl border border-brand-border bg-brand-muted text-sm outline-none focus:border-brand-accent focus:bg-white transition-colors" />
                  </div>
                </div>
                <div className="space-y-4 mt-4">
                  <div>
                    <label className="block text-sm font-semibold text-brand-text mb-1.5">Job title (optional)</label>
                    <input type="text" value={form.job_title} onChange={(e) => set("job_title", e.target.value)}
                      placeholder="Event Manager"
                      className="w-full px-4 py-3 rounded-xl border border-brand-border bg-brand-muted text-sm outline-none focus:border-brand-accent focus:bg-white transition-colors" />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-brand-text mb-1.5">Business email *</label>
                    <input type="email" value={form.business_email} onChange={(e) => set("business_email", e.target.value)}
                      placeholder="you@company.com"
                      className="w-full px-4 py-3 rounded-xl border border-brand-border bg-brand-muted text-sm outline-none focus:border-brand-accent focus:bg-white transition-colors" />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-brand-text mb-1.5">Phone (optional)</label>
                    <input type="tel" value={form.business_phone} onChange={(e) => set("business_phone", e.target.value)}
                      placeholder="+1 (214) 555-0100"
                      className="w-full px-4 py-3 rounded-xl border border-brand-border bg-brand-muted text-sm outline-none focus:border-brand-accent focus:bg-white transition-colors" />
                  </div>
                </div>
              </div>
            )}

            {/* Step 2: Address */}
            {step === 2 && (
              <div>
                <h1 className="font-display text-2xl font-bold text-brand-text mb-1">Your address</h1>
                <p className="text-sm text-brand-textMid mb-6">Required for tax documents and payout processing.</p>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-brand-text mb-1.5">Home address</label>
                    <textarea value={form.home_address} onChange={(e) => set("home_address", e.target.value)}
                      placeholder="123 Main St, Dallas, TX 75201"
                      rows={2}
                      className="w-full px-4 py-3 rounded-xl border border-brand-border bg-brand-muted text-sm outline-none focus:border-brand-accent focus:bg-white transition-colors resize-none" />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-brand-text mb-1.5">Billing address</label>
                    <p className="text-xs text-brand-textLight mb-1.5">Leave blank if same as home address</p>
                    <textarea value={form.billing_address} onChange={(e) => set("billing_address", e.target.value)}
                      placeholder="Same as above, or enter a different address"
                      rows={2}
                      className="w-full px-4 py-3 rounded-xl border border-brand-border bg-brand-muted text-sm outline-none focus:border-brand-accent focus:bg-white transition-colors resize-none" />
                  </div>
                </div>

                {/* Summary */}
                <div className="mt-6 p-4 bg-brand-muted rounded-xl border border-brand-border">
                  <p className="text-xs font-bold text-brand-textLight uppercase tracking-wider mb-2">Review</p>
                  <p className="text-sm font-semibold text-brand-text">{form.org_name}</p>
                  <p className="text-xs text-brand-textMid">{form.first_name} {form.last_name} · {form.business_email}</p>
                  {form.company && <p className="text-xs text-brand-textLight">{form.company}</p>}
                </div>
              </div>
            )}

            {/* Nav buttons */}
            <div className="flex items-center justify-between mt-8">
              {step > 0 ? (
                <button onClick={() => setStep((s) => s - 1)}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-brand-border text-sm font-medium text-brand-textMid hover:bg-brand-muted transition-colors">
                  <ArrowLeft size={15} /> Back
                </button>
              ) : <div />}

              {step < STEPS.length - 1 ? (
                <button onClick={() => setStep((s) => s + 1)} disabled={!isStepValid()}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-brand-accent text-white text-sm font-bold hover:bg-brand-accentHover transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                  Continue <ArrowRight size={15} />
                </button>
              ) : (
                <button onClick={handleSubmit} disabled={submitting}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-brand-accent text-white text-sm font-bold hover:bg-brand-accentHover transition-colors disabled:opacity-60">
                  {submitting ? "Creating account…" : <>Finish setup <Check size={15} /></>}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
