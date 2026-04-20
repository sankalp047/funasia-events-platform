import { useState, useEffect, useRef } from "react";
import { Save, Upload } from "lucide-react";
import api from "../../utils/api";
import toast from "react-hot-toast";

export default function OrganizerSettings() {
  const [form, setForm] = useState({
    org_name: "", org_logo_url: "", first_name: "", last_name: "",
    job_title: "", company: "", website: "",
    business_email: "", business_phone: "",
    home_address: "", billing_address: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const logoRef = useRef(null);

  useEffect(() => {
    api.get("/organizer/profile")
      .then((r) => { if (r.data.profile) setForm((f) => ({ ...f, ...r.data.profile })); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const set = (field, value) => setForm((f) => ({ ...f, [field]: value }));

  const handleLogoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const { createClient } = await import("@supabase/supabase-js");
      const supabase = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY);
      const path = `org-logos/${Date.now()}-${file.name}`;
      const { error } = await supabase.storage.from("event-media").upload(path, file);
      if (error) throw error;
      const { data: { publicUrl } } = supabase.storage.from("event-media").getPublicUrl(path);
      set("org_logo_url", publicUrl);
      toast.success("Logo updated");
    } catch { toast.error("Upload failed"); }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.patch("/organizer/profile", form);
      toast.success("Settings saved");
    } catch { toast.error("Failed to save"); }
    finally { setSaving(false); }
  };

  if (loading) return <div className="p-8 text-sm text-brand-textMid">Loading…</div>;

  const Field = ({ label, field, type = "text", placeholder, required }) => (
    <div>
      <label className="block text-sm font-semibold text-brand-text mb-1.5">
        {label}{required && <span className="text-brand-accent ml-0.5">*</span>}
      </label>
      <input type={type} value={form[field] || ""} onChange={(e) => set(field, e.target.value)}
        placeholder={placeholder}
        className="w-full px-4 py-3 rounded-xl border border-brand-border bg-brand-muted text-sm outline-none focus:border-brand-accent focus:bg-white transition-colors" />
    </div>
  );

  return (
    <div className="p-6 md:p-8 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-display text-2xl font-bold text-brand-text">Organization Settings</h1>
          <p className="text-sm text-brand-textMid mt-0.5">Update your organizer profile and contact information.</p>
        </div>
        <button onClick={handleSave} disabled={saving}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-brand-accent text-white text-sm font-bold hover:bg-brand-accentHover transition-colors disabled:opacity-60">
          <Save size={14} /> {saving ? "Saving…" : "Save Changes"}
        </button>
      </div>

      <div className="space-y-6">

        {/* Logo */}
        <div className="bg-white rounded-2xl border border-brand-border p-6">
          <h2 className="font-semibold text-brand-text mb-4">Organization Logo</h2>
          <div className="flex items-center gap-4">
            <div className="w-20 h-20 rounded-xl border-2 border-dashed border-brand-border flex items-center justify-center bg-brand-muted overflow-hidden">
              {form.org_logo_url ? (
                <img src={form.org_logo_url} alt="Logo" className="w-full h-full object-cover" />
              ) : (
                <Upload size={20} className="text-brand-textLight" />
              )}
            </div>
            <div>
              <button onClick={() => logoRef.current?.click()}
                className="text-sm font-semibold text-brand-accent hover:underline">
                Change logo
              </button>
              <p className="text-xs text-brand-textLight mt-0.5">JPEG or PNG, max 10MB</p>
              <input ref={logoRef} type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
            </div>
          </div>
        </div>

        {/* Organization */}
        <div className="bg-white rounded-2xl border border-brand-border p-6">
          <h2 className="font-semibold text-brand-text mb-4">Organization</h2>
          <div className="space-y-4">
            <Field label="Organization name" field="org_name" placeholder="e.g. Dallas Desi Events" required />
            <Field label="Company" field="company" placeholder="e.g. 4Visions LLC" />
            <Field label="Website" field="website" type="url" placeholder="https://yoursite.com" />
          </div>
        </div>

        {/* Contact */}
        <div className="bg-white rounded-2xl border border-brand-border p-6">
          <h2 className="font-semibold text-brand-text mb-4">Contact Information</h2>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <Field label="First name" field="first_name" placeholder="First" required />
            <Field label="Last name" field="last_name" placeholder="Last" required />
          </div>
          <div className="space-y-4">
            <Field label="Job title" field="job_title" placeholder="Event Manager" />
            <Field label="Business email" field="business_email" type="email" placeholder="you@company.com" required />
            <Field label="Phone" field="business_phone" type="tel" placeholder="+1 (214) 555-0100" />
          </div>
        </div>

        {/* Address */}
        <div className="bg-white rounded-2xl border border-brand-border p-6">
          <h2 className="font-semibold text-brand-text mb-4">Address</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-brand-text mb-1.5">Home address</label>
              <textarea value={form.home_address || ""} onChange={(e) => set("home_address", e.target.value)}
                rows={2} placeholder="123 Main St, Dallas, TX 75201"
                className="w-full px-4 py-3 rounded-xl border border-brand-border bg-brand-muted text-sm outline-none focus:border-brand-accent focus:bg-white transition-colors resize-none" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-brand-text mb-1.5">Billing address</label>
              <textarea value={form.billing_address || ""} onChange={(e) => set("billing_address", e.target.value)}
                rows={2} placeholder="Same as home or different"
                className="w-full px-4 py-3 rounded-xl border border-brand-border bg-brand-muted text-sm outline-none focus:border-brand-accent focus:bg-white transition-colors resize-none" />
            </div>
          </div>
        </div>

      </div>

      {/* Save bottom */}
      <div className="mt-6 flex justify-end">
        <button onClick={handleSave} disabled={saving}
          className="flex items-center gap-2 px-6 py-3 rounded-xl bg-brand-accent text-white text-sm font-bold hover:bg-brand-accentHover transition-colors disabled:opacity-60">
          <Save size={14} /> {saving ? "Saving…" : "Save Changes"}
        </button>
      </div>
    </div>
  );
}
