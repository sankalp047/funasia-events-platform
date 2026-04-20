import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Save } from "lucide-react";
import api from "../../utils/api";
import toast from "react-hot-toast";

export default function SuperAdminSettings() {
  const navigate = useNavigate();
  const [settings, setSettings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get("/super-admin/settings").then(({ data }) => setSettings(data.settings || [])).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const updateSetting = (key, value) => setSettings((s) => s.map((item) => item.key === key ? { ...item, value } : item));

  const save = async () => {
    setSaving(true);
    try {
      await api.patch("/super-admin/settings", { settings: settings.map((s) => ({ key: s.key, value: s.value })) });
      toast.success("Settings saved");
    } catch { toast.error("Failed to save"); }
    finally { setSaving(false); }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-10 animate-fade-in">
      <button onClick={() => navigate("/super-admin")} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-white mb-6"><ArrowLeft size={16} /> Back</button>
      <h1 className="font-display text-2xl font-bold text-white mb-6">Platform Settings</h1>

      {loading ? <div className="h-48 bg-brand-card rounded-2xl animate-pulse" /> : (
        <div className="bg-brand-card border border-white/5 rounded-2xl p-6 space-y-4">
          {settings.map((s) => (
            <div key={s.key} className="flex items-center justify-between py-3 border-b border-white/5 last:border-0">
              <div className="flex-1 mr-4">
                <p className="text-sm text-white font-medium">{s.key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}</p>
                {s.description && <p className="text-xs text-gray-600 mt-0.5">{s.description}</p>}
              </div>
              <input value={s.value} onChange={(e) => updateSetting(s.key, e.target.value)}
                className="w-48 px-3 py-2 bg-brand-elevated border border-white/5 rounded-lg text-sm text-white outline-none text-right" />
            </div>
          ))}
          <button onClick={save} disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 bg-brand-gold text-brand-bg font-semibold rounded-lg hover:brightness-110 disabled:opacity-50 mt-4">
            <Save size={14} /> {saving ? "Saving..." : "Save Settings"}
          </button>
        </div>
      )}
    </div>
  );
}
