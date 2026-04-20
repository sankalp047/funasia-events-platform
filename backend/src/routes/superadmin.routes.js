const express = require("express");
const router = express.Router();
const { supabaseAdmin } = require("../config/supabase");
const { authenticate, requireRole } = require("../middleware/auth");

// All routes require super_admin
router.use(authenticate, requireRole("super_admin"));

// ─── Platform Dashboard ───
router.get("/dashboard", async (req, res) => {
  try {
    const { count: totalUsers } = await supabaseAdmin.from("users").select("id", { count: "exact", head: true });
    const { count: totalAdmins } = await supabaseAdmin.from("users").select("id", { count: "exact", head: true }).eq("role", "admin");
    const { count: totalEvents } = await supabaseAdmin.from("events").select("id", { count: "exact", head: true });
    const { count: publishedEvents } = await supabaseAdmin.from("events").select("id", { count: "exact", head: true }).eq("status", "published");

    const { data: allOrders } = await supabaseAdmin
      .from("orders")
      .select("total, platform_fee, status")
      .eq("status", "paid");

    const totalRevenue = allOrders?.reduce((s, o) => s + parseFloat(o.total), 0) || 0;
    const platformEarnings = allOrders?.reduce((s, o) => s + parseFloat(o.platform_fee), 0) || 0;

    // Recent activity
    const { data: recentActivity } = await supabaseAdmin
      .from("audit_log")
      .select("*, users(full_name, email)")
      .order("created_at", { ascending: false })
      .limit(50);

    res.json({
      stats: {
        total_users: totalUsers,
        total_admins: totalAdmins,
        total_events: totalEvents,
        published_events: publishedEvents,
        total_revenue: totalRevenue,
        platform_earnings: platformEarnings,
        total_orders: allOrders?.length || 0,
      },
      recent_activity: recentActivity,
    });
  } catch (err) {
    console.error("Super admin dashboard error:", err);
    res.status(500).json({ error: "Failed to load dashboard" });
  }
});

// ─── List All Users ───
router.get("/users", async (req, res) => {
  const { page = 1, limit = 50, role, search } = req.query;
  const offset = (page - 1) * limit;

  try {
    let query = supabaseAdmin.from("users").select("*", { count: "exact" });

    if (role) query = query.eq("role", role);
    if (search) query = query.or(`full_name.ilike.%${search}%,email.ilike.%${search}%`);

    const { data: users, count, error } = await query
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;
    res.json({ users, total: count, page: +page, limit: +limit });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch users" });
  }
});

// ─── Update User Role ───
router.patch("/users/:id/role", async (req, res) => {
  const { role } = req.body;
  if (!["user", "admin", "super_admin"].includes(role)) {
    return res.status(400).json({ error: "Invalid role" });
  }

  try {
    const { data, error } = await supabaseAdmin
      .from("users")
      .update({ role })
      .eq("id", req.params.id)
      .select()
      .single();

    if (error) throw error;

    // If promoting to admin, create admin profile
    if (role === "admin") {
      await supabaseAdmin
        .from("admin_profiles")
        .upsert({ user_id: req.params.id }, { onConflict: "user_id" });
    }

    await supabaseAdmin.from("audit_log").insert({
      user_id: req.user.id,
      action: "user.role_changed",
      entity_type: "user",
      entity_id: req.params.id,
      metadata: { new_role: role },
    });

    res.json({ user: data });
  } catch (err) {
    res.status(500).json({ error: "Failed to update role" });
  }
});

// ─── Delete User ───
// Deletes from auth.users (which cascades to public.users via FK)
router.delete("/users/:id", async (req, res) => {
  const { id } = req.params;

  // Prevent self-deletion
  if (id === req.user.id) {
    return res.status(400).json({ error: "You cannot delete your own account" });
  }

  try {
    // deleteUser removes from auth.users; public.users cascades automatically
    const { error } = await supabaseAdmin.auth.admin.deleteUser(id);
    if (error) throw error;

    await supabaseAdmin.from("audit_log").insert({
      user_id: req.user.id,
      action: "user.deleted",
      entity_type: "user",
      entity_id: id,
      metadata: {},
    }).catch(() => {}); // non-fatal

    res.json({ message: "User deleted" });
  } catch (err) {
    console.error("Delete user error:", err);
    res.status(500).json({ error: err.message || "Failed to delete user" });
  }
});

// ─── List All Events (any status) ───
router.get("/events", async (req, res) => {
  const { status, page = 1, limit = 50 } = req.query;
  const offset = (page - 1) * limit;

  try {
    let query = supabaseAdmin
      .from("events")
      .select("*, users!events_admin_id_fkey(full_name, email)", { count: "exact" });

    if (status) query = query.eq("status", status);

    const { data, count, error } = await query
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;
    res.json({ events: data, total: count });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch events" });
  }
});

// ─── Force-publish or cancel any event ───
router.patch("/events/:id/status", async (req, res) => {
  const { status } = req.body;
  if (!["published", "cancelled", "draft"].includes(status)) {
    return res.status(400).json({ error: "Invalid status" });
  }

  try {
    const updates = { status };
    if (status === "published") updates.published_at = new Date().toISOString();

    const { data, error } = await supabaseAdmin
      .from("events")
      .update(updates)
      .eq("id", req.params.id)
      .select()
      .single();

    if (error) throw error;

    await supabaseAdmin.from("audit_log").insert({
      user_id: req.user.id,
      action: `event.${status}`,
      entity_type: "event",
      entity_id: req.params.id,
    });

    res.json({ event: data });
  } catch (err) {
    res.status(500).json({ error: "Failed to update event" });
  }
});

// ─── Platform Settings ───
router.get("/settings", async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin.from("platform_settings").select("*").order("key");
    if (error) throw error;
    res.json({ settings: data });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch settings" });
  }
});

router.patch("/settings", async (req, res) => {
  const { settings } = req.body; // Array of { key, value }

  try {
    for (const s of settings) {
      await supabaseAdmin
        .from("platform_settings")
        .update({ value: s.value, updated_by: req.user.id, updated_at: new Date().toISOString() })
        .eq("key", s.key);
    }

    const { data } = await supabaseAdmin.from("platform_settings").select("*").order("key");
    res.json({ settings: data });
  } catch (err) {
    res.status(500).json({ error: "Failed to update settings" });
  }
});

// ─── All Orders (platform-wide) ───
router.get("/orders", async (req, res) => {
  const { status, event_id, page = 1, limit = 50 } = req.query;
  const offset = (page - 1) * limit;

  try {
    let query = supabaseAdmin
      .from("orders")
      .select("*, users(full_name, email), events(title)", { count: "exact" });

    if (status) query = query.eq("status", status);
    if (event_id) query = query.eq("event_id", event_id);

    const { data, count, error } = await query
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;
    res.json({ orders: data, total: count });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch orders" });
  }
});

// ─── Payouts ───
router.get("/payouts", async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from("payouts")
      .select("*, users(full_name, email), events(title)")
      .order("created_at", { ascending: false });

    if (error) throw error;
    res.json({ payouts: data });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch payouts" });
  }
});

module.exports = router;
