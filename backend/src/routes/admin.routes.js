const express = require("express");
const router = express.Router();
const { supabaseAdmin } = require("../config/supabase");
const { stripe } = require("../config/stripe");
const { authenticate, requireRole } = require("../middleware/auth");

// ─── Get Admin Dashboard Stats ───
router.get("/dashboard", authenticate, requireRole("admin", "super_admin"), async (req, res) => {
  const adminId = req.user.id;

  try {
    // My events
    const { data: events } = await supabaseAdmin
      .from("events")
      .select("id, title, status, event_start, ticket_type")
      .eq("admin_id", adminId)
      .order("event_start", { ascending: false });

    const eventIds = events?.map((e) => e.id) || [];

    // Orders for my events
    const { data: orders } = await supabaseAdmin
      .from("orders")
      .select("id, total, status, event_id, created_at")
      .in("event_id", eventIds)
      .eq("status", "paid");

    const totalRevenue = orders?.reduce((s, o) => s + parseFloat(o.total), 0) || 0;
    const totalOrders = orders?.length || 0;

    // Tickets sold
    const { count: ticketsSold } = await supabaseAdmin
      .from("order_items")
      .select("id", { count: "exact", head: true })
      .in("order_id", orders?.map((o) => o.id) || []);

    // Revenue by event
    const revenueByEvent = eventIds.map((eid) => {
      const evtOrders = orders?.filter((o) => o.event_id === eid) || [];
      const evt = events.find((e) => e.id === eid);
      return {
        event_id: eid,
        title: evt?.title,
        revenue: evtOrders.reduce((s, o) => s + parseFloat(o.total), 0),
        order_count: evtOrders.length,
      };
    });

    // Revenue over time (last 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const recentOrders = orders?.filter((o) => o.created_at >= thirtyDaysAgo) || [];
    const dailyRevenue = {};
    recentOrders.forEach((o) => {
      const day = o.created_at.split("T")[0];
      dailyRevenue[day] = (dailyRevenue[day] || 0) + parseFloat(o.total);
    });

    res.json({
      stats: {
        total_events: events?.length || 0,
        active_events: events?.filter((e) => e.status === "published").length || 0,
        total_revenue: totalRevenue,
        total_orders: totalOrders,
        tickets_sold: ticketsSold || 0,
      },
      revenue_by_event: revenueByEvent.sort((a, b) => b.revenue - a.revenue),
      daily_revenue: Object.entries(dailyRevenue)
        .map(([date, amount]) => ({ date, amount }))
        .sort((a, b) => a.date.localeCompare(b.date)),
      events,
    });
  } catch (err) {
    console.error("Admin dashboard error:", err);
    res.status(500).json({ error: "Failed to load dashboard" });
  }
});

// ─── Get Orders for an Event (admin) ───
router.get("/events/:eventId/orders", authenticate, requireRole("admin", "super_admin"), async (req, res) => {
  try {
    // Verify ownership
    if (req.user.role !== "super_admin") {
      const { data: evt } = await supabaseAdmin
        .from("events")
        .select("id")
        .eq("id", req.params.eventId)
        .eq("admin_id", req.user.id)
        .single();
      if (!evt) return res.status(403).json({ error: "Not your event" });
    }

    const { data: orders, error } = await supabaseAdmin
      .from("orders")
      .select(`
        *,
        users(id, full_name, email, phone),
        order_items(*, ticket_tiers(name), seats(label)),
        order_food_items(*, food_options(name))
      `)
      .eq("event_id", req.params.eventId)
      .in("status", ["paid", "reserved", "refunded", "cancelled"])
      .order("created_at", { ascending: false });

    if (error) throw error;
    res.json({ orders });
  } catch (err) {
    console.error("Event orders error:", err);
    res.status(500).json({ error: "Failed to fetch orders" });
  }
});

// ─── Get Attendee List for an Event (for check-in app) ───
router.get("/events/:eventId/attendees", authenticate, requireRole("admin", "super_admin"), async (req, res) => {
  try {
    const { data: attendees, error } = await supabaseAdmin
      .from("order_items")
      .select(`
        id, barcode, attendee_name, attendee_email, is_checked_in, checked_in_at,
        ticket_tiers(name, price),
        seats(label, section, row_label, seat_number),
        orders!inner(id, order_number, user_id, status, users(full_name, email, phone))
      `)
      .eq("orders.event_id", req.params.eventId)
      .eq("orders.status", "paid")
      .order("attendee_name");

    if (error) throw error;
    res.json({ attendees });
  } catch (err) {
    console.error("Attendees error:", err);
    res.status(500).json({ error: "Failed to fetch attendees" });
  }
});

// ─── Check-in a Ticket (scan barcode) ───
router.post("/checkin", authenticate, requireRole("admin", "super_admin"), async (req, res) => {
  const { barcode } = req.body;

  try {
    const { data: ticket, error } = await supabaseAdmin
      .from("order_items")
      .select("*, orders!inner(event_id, status, users(full_name))")
      .eq("barcode", barcode)
      .eq("orders.status", "paid")
      .single();

    if (error || !ticket) return res.status(404).json({ error: "Invalid barcode" });
    if (ticket.is_checked_in) {
      return res.status(409).json({
        error: "Already checked in",
        checked_in_at: ticket.checked_in_at,
      });
    }

    const { data: updated } = await supabaseAdmin
      .from("order_items")
      .update({
        is_checked_in: true,
        checked_in_at: new Date().toISOString(),
        checked_in_by: req.user.id,
      })
      .eq("id", ticket.id)
      .select()
      .single();

    res.json({
      message: "Check-in successful",
      attendee: ticket.orders.users.full_name,
      ticket: updated,
    });
  } catch (err) {
    console.error("Check-in error:", err);
    res.status(500).json({ error: "Check-in failed" });
  }
});

// ─── Setup Stripe Connect (payout bank account) ───
router.post("/stripe/connect", authenticate, requireRole("admin", "super_admin"), async (req, res) => {
  try {
    // Check if admin already has a Stripe account
    const { data: profile } = await supabaseAdmin
      .from("admin_profiles")
      .select("stripe_account_id, stripe_onboarded")
      .eq("user_id", req.user.id)
      .single();

    let accountId = profile?.stripe_account_id;

    if (!accountId) {
      // Create Stripe Connect Express account
      const account = await stripe.accounts.create({
        type: "express",
        email: req.user.email,
        metadata: { user_id: req.user.id },
        capabilities: { card_payments: { requested: true }, transfers: { requested: true } },
      });
      accountId = account.id;

      // Upsert admin profile
      await supabaseAdmin
        .from("admin_profiles")
        .upsert({
          user_id: req.user.id,
          stripe_account_id: accountId,
        }, { onConflict: "user_id" });
    }

    // Create onboarding link
    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${process.env.FRONTEND_URL}/admin/stripe/refresh`,
      return_url: `${process.env.FRONTEND_URL}/admin/stripe/complete`,
      type: "account_onboarding",
    });

    res.json({ url: accountLink.url });
  } catch (err) {
    console.error("Stripe Connect error:", err);
    res.status(500).json({ error: "Failed to setup payment account" });
  }
});

// ─── Admin Profile ───
router.get("/profile", authenticate, requireRole("admin", "super_admin"), async (req, res) => {
  try {
    const { data } = await supabaseAdmin
      .from("admin_profiles")
      .select("*")
      .eq("user_id", req.user.id)
      .single();

    res.json({ profile: data });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch profile" });
  }
});

module.exports = router;
