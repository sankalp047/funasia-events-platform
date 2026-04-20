import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Search, Trash2 } from "lucide-react";
import api from "../../utils/api";
import toast from "react-hot-toast";
import useAuthStore from "../../hooks/useAuthStore";

export default function SuperAdminUsers() {
  const navigate = useNavigate();
  const { user: me } = useAuthStore();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");

  const fetchUsers = () => {
    setLoading(true);
    const params = { limit: 50 };
    if (search) params.search = search;
    if (roleFilter) params.role = roleFilter;
    api.get("/super-admin/users", { params }).then(({ data }) => setUsers(data.users || [])).catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(() => { fetchUsers(); }, [roleFilter]);

  const changeRole = async (userId, newRole) => {
    try {
      await api.patch(`/super-admin/users/${userId}/role`, { role: newRole });
      toast.success(`Role updated to ${newRole}`);
      fetchUsers();
    } catch { toast.error("Failed to update role"); }
  };

  const deleteUser = async (userId, email) => {
    if (!confirm(`Permanently delete "${email}"? This cannot be undone and will remove their account and all associated data.`)) return;
    try {
      await api.delete(`/super-admin/users/${userId}`);
      toast.success("User deleted");
      setUsers((prev) => prev.filter((u) => u.id !== userId));
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to delete user");
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-10 animate-fade-in">
      <button onClick={() => navigate("/super-admin")} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-white mb-6"><ArrowLeft size={16} /> Back</button>
      <h1 className="font-display text-2xl font-bold text-white mb-6">User Management</h1>

      <div className="flex gap-3 mb-6 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.key === "Enter" && fetchUsers()} placeholder="Search by name or email"
            className="w-full pl-10 pr-4 py-3 bg-brand-card border border-white/5 rounded-xl text-sm text-white placeholder-gray-600 outline-none" />
        </div>
        {["", "user", "admin", "super_admin"].map((r) => (
          <button key={r} onClick={() => setRoleFilter(r)}
            className={`px-4 py-2.5 rounded-full text-sm font-medium ${roleFilter === r ? "bg-brand-gold text-brand-bg" : "bg-brand-card border border-white/5 text-gray-400"}`}>
            {r || "All"}
          </button>
        ))}
      </div>

      <div className="bg-brand-card border border-white/5 rounded-2xl overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-white/5">
            {["User", "Role", "Provider", "Joined", "Actions"].map((h) => (
              <th key={h} className="px-5 py-3 text-left text-[11px] text-gray-600 uppercase tracking-wider font-semibold">{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-b border-white/5 hover:bg-white/[0.02]">
                <td className="px-5 py-3"><p className="text-white font-medium">{u.full_name}</p><p className="text-gray-600 text-xs">{u.email}</p></td>
                <td className="px-5 py-3">
                  <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                    u.role === "super_admin" ? "bg-brand-gold/10 text-brand-gold" : u.role === "admin" ? "bg-brand-purple/10 text-brand-purple" : "bg-white/5 text-gray-500"
                  }`}>{u.role}</span>
                </td>
                <td className="px-5 py-3 text-gray-500 text-xs">{u.auth_provider}</td>
                <td className="px-5 py-3 text-gray-500 text-xs">{new Date(u.created_at).toLocaleDateString("en-US", { timeZone: "America/Chicago" })}</td>
                <td className="px-5 py-3">
                  <div className="flex items-center gap-3">
                    <select value={u.role} onChange={(e) => changeRole(u.id, e.target.value)}
                      className="px-2 py-1 bg-brand-elevated border border-white/5 rounded text-xs text-gray-400 outline-none">
                      <option value="user">User</option><option value="admin">Admin</option><option value="super_admin">Super Admin</option>
                    </select>
                    {u.id !== me?.id && (
                      <button onClick={() => deleteUser(u.id, u.email)}
                        className="text-gray-700 hover:text-red-400 transition-colors"
                        title="Delete user">
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!loading && users.length === 0 && <p className="text-center py-10 text-gray-600 text-sm">No users found</p>}
      </div>
    </div>
  );
}
