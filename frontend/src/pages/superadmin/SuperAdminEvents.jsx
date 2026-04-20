import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import api from "../../utils/api";
import toast from "react-hot-toast";

export default function SuperAdminEvents() {
  const navigate = useNavigate();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");

  const fetchEvents = () => {
    setLoading(true);
    const params = { limit: 50 };
    if (statusFilter) params.status = statusFilter;
    api.get("/super-admin/events", { params }).then(({ data }) => setEvents(data.events || [])).catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(() => { fetchEvents(); }, [statusFilter]);

  const changeStatus = async (id, status) => {
    try {
      await api.patch(`/super-admin/events/${id}/status`, { status });
      toast.success(`Event ${status}`);
      fetchEvents();
    } catch { toast.error("Failed"); }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-10 animate-fade-in">
      <button onClick={() => navigate("/super-admin")} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-white mb-6"><ArrowLeft size={16} /> Back</button>
      <h1 className="font-display text-2xl font-bold text-white mb-6">All Events</h1>
      <div className="flex gap-2 mb-6">
        {["", "draft", "published", "cancelled"].map((s) => (
          <button key={s} onClick={() => setStatusFilter(s)}
            className={`px-4 py-2 rounded-full text-sm ${statusFilter === s ? "bg-brand-gold text-brand-bg font-semibold" : "bg-brand-card border border-white/5 text-gray-400"}`}>{s || "All"}</button>
        ))}
      </div>
      <div className="bg-brand-card border border-white/5 rounded-2xl overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-white/5">
            {["Event", "Admin", "Status", "Date", "Actions"].map((h) => (
              <th key={h} className="px-5 py-3 text-left text-[11px] text-gray-600 uppercase tracking-wider font-semibold">{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {events.map((e) => (
              <tr key={e.id} className="border-b border-white/5">
                <td className="px-5 py-3 text-white font-medium">{e.title}</td>
                <td className="px-5 py-3 text-gray-500 text-xs">{e.users?.full_name}<br/>{e.users?.email}</td>
                <td className="px-5 py-3">
                  <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                    e.status === "published" ? "bg-brand-teal/10 text-brand-teal" : e.status === "draft" ? "bg-brand-gold/10 text-brand-gold" : "bg-red-500/10 text-red-400"
                  }`}>{e.status}</span>
                </td>
                <td className="px-5 py-3 text-gray-500 text-xs">{new Date(e.event_start).toLocaleDateString("en-US", { timeZone: "America/Chicago" })}</td>
                <td className="px-5 py-3 flex gap-2">
                  {e.status !== "published" && <button onClick={() => changeStatus(e.id, "published")} className="text-xs text-brand-teal hover:underline">Publish</button>}
                  {e.status !== "cancelled" && <button onClick={() => changeStatus(e.id, "cancelled")} className="text-xs text-red-400 hover:underline">Cancel</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
