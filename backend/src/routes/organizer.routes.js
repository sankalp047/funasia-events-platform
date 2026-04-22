const express = require("express");
const router = express.Router();
const { supabaseAdmin } = require("../config/supabase");
const { authenticate } = require("../middleware/auth");

// ─── Get organizer profile (check if onboarding complete) ───
router.get("/profile", authenticate, async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from("admin_profiles")
      .select("*")
      .eq("user_id", req.user.id)
      .single();

    if (error && error.code !== "PGRST116") throw error; // PGRST116 = not found

    res.json({ profile: data || null, onboarding_complete: data?.onboarding_complete || false });
  } catch (err) {
    console.error("Get organizer profile error:", err);
    res.status(500).json({ error: "Failed to fetch organizer profile" });
  }
});

// ─── Create / update organizer profile (first-time onboarding) ───
router.post("/profile", authenticate, async (req, res) => {
  const {
    org_name, org_logo_url,
    first_name, last_name, job_title, company, website,
    business_email, business_phone,
    home_address, billing_address,
  } = req.body;

  if (!org_name || !first_name || !last_name) {
    return res.status(400).json({ error: "org_name, first_name, and last_name are required" });
  }

  try {
    // Upsert admin profile
    const { data: profile, error: profileError } = await supabaseAdmin
      .from("admin_profiles")
      .upsert({
        user_id: req.user.id,
        org_name, org_logo_url: org_logo_url || null,
        first_name, last_name,
        job_title: job_title || null,
        company: company || null,
        website: website || null,
        business_name: org_name,
        business_email: business_email || req.user.email,
        business_phone: business_phone || null,
        home_address: home_address || null,
        billing_address: billing_address || null,
        onboarding_complete: true,
      }, { onConflict: "user_id" })
      .select()
      .single();

    if (profileError) throw profileError;

    // Auto-promote user to admin role
    const { error: userError } = await supabaseAdmin
      .from("users")
      .update({ role: "admin" })
      .eq("id", req.user.id);

    if (userError) throw userError;

    await supabaseAdmin.from("audit_log").insert({
      user_id: req.user.id,
      action: "organizer.onboarding_complete",
      entity_type: "admin_profile",
      entity_id: profile.id,
      metadata: { org_name },
    });

    res.status(201).json({ profile, message: "Organizer profile created successfully" });
  } catch (err) {
    console.error("Create organizer profile error:", err);
    res.status(500).json({ error: "Failed to create organizer profile" });
  }
});

// ─── Update organizer profile ───
router.patch("/profile", authenticate, async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from("admin_profiles")
      .update(req.body)
      .eq("user_id", req.user.id)
      .select()
      .single();

    if (error) throw error;
    res.json({ profile: data });
  } catch (err) {
    console.error("Update organizer profile error:", err);
    res.status(500).json({ error: "Failed to update organizer profile" });
  }
});

// ─── Get organizer dashboard stats ───
router.get("/dashboard", authenticate, async (req, res) => {
  try {
    // All events for this organizer
    const { data: events, error: eventsError } = await supabaseAdmin
      .from("events")
      .select(`
        id, title, status, event_start, event_end, is_online,
        ticket_tiers(id, name, total_quantity, sold_quantity, price)
      `)
      .eq("admin_id", req.user.id)
      .order("event_start", { ascending: false });

    if (eventsError) throw eventsError;

    // All paid orders for this organizer's events
    const eventIds = (events || []).map((e) => e.id);
    let totalRevenue = 0;
    let totalTicketsSold = 0;
    let totalOrders = 0;

    if (eventIds.length > 0) {
      const { data: orders } = await supabaseAdmin
        .from("orders")
        .select("id, total, status")
        .in("event_id", eventIds)
        .eq("status", "paid");

      if (orders) {
        totalOrders = orders.length;
        totalRevenue = orders.reduce((sum, o) => sum + parseFloat(o.total || 0), 0);
      }

      const { data: items } = await supabaseAdmin
        .from("order_items")
        .select("id, order_id, orders!inner(event_id, status)")
        .in("orders.event_id", eventIds)
        .eq("orders.status", "paid");

      totalTicketsSold = (items || []).length;
    }

    const now = new Date().toISOString();
    const upcomingEvents = (events || []).filter((e) => e.event_end >= now && e.status === "published");
    const pastEvents = (events || []).filter((e) => e.event_end < now);
    const draftEvents = (events || []).filter((e) => e.status === "draft");

    res.json({
      stats: {
        total_events: (events || []).length,
        upcoming_events: upcomingEvents.length,
        past_events: pastEvents.length,
        draft_events: draftEvents.length,
        total_revenue: parseFloat(totalRevenue.toFixed(2)),
        total_tickets_sold: totalTicketsSold,
        total_orders: totalOrders,
      },
      recent_events: (events || []).slice(0, 5).map((e) => ({
        id: e.id,
        title: e.title,
        status: e.status,
        event_start: e.event_start,
        is_online: e.is_online,
        tickets_sold: (e.ticket_tiers || []).reduce((s, t) => s + (t.sold_quantity || 0), 0),
        total_tickets: (e.ticket_tiers || []).reduce((s, t) => s + (t.total_quantity || 0), 0),
      })),
    });
  } catch (err) {
    console.error("Organizer dashboard error:", err);
    res.status(500).json({ error: "Failed to fetch dashboard stats" });
  }
});

// ─── Get organizer's events ───
router.get("/events", authenticate, async (req, res) => {
  const { status, page = 1, limit = 20 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);

  try {
    let query = supabaseAdmin
      .from("events")
      .select(`
        id, title, slug, status, sales_paused, event_start, event_end, city, state,
        is_online, category, created_at,
        ticket_tiers(id, name, price, total_quantity, sold_quantity),
        event_media(url, is_cover)
      `, { count: "exact" })
      .eq("admin_id", req.user.id)
      .order("created_at", { ascending: false })
      .range(offset, offset + parseInt(limit) - 1);

    if (status) query = query.eq("status", status);

    const { data: events, error, count } = await query;
    if (error) throw error;

    const enriched = (events || []).map((e) => ({
      ...e,
      tickets_sold: (e.ticket_tiers || []).reduce((s, t) => s + (t.sold_quantity || 0), 0),
      total_tickets: (e.ticket_tiers || []).reduce((s, t) => s + (t.total_quantity || 0), 0),
      cover_image: (e.event_media || []).find((m) => m.is_cover)?.url || e.event_media?.[0]?.url || null,
    }));

    res.json({ events: enriched, total: count, page: parseInt(page), limit: parseInt(limit) });
  } catch (err) {
    console.error("Organizer events error:", err);
    res.status(500).json({ error: "Failed to fetch events" });
  }
});

// ─── Publish own event ───
router.post("/events/:id/publish", authenticate, async (req, res) => {
  try {
    // Verify this event belongs to the organizer
    const { data: event } = await supabaseAdmin
      .from("events").select("id, admin_id, status").eq("id", req.params.id).single();

    if (!event) return res.status(404).json({ error: "Event not found" });
    if (event.admin_id !== req.user.id) return res.status(403).json({ error: "Not your event" });
    if (event.status === "published") return res.status(400).json({ error: "Already published" });

    const { data, error } = await supabaseAdmin.from("events")
      .update({ status: "published", published_at: new Date().toISOString() })
      .eq("id", req.params.id).select().single();

    if (error) throw error;

    await supabaseAdmin.from("audit_log").insert({
      user_id: req.user.id, action: "event.published",
      entity_type: "event", entity_id: req.params.id,
    });

    res.json({ event: data });
  } catch (err) {
    console.error("Publish event error:", err);
    res.status(500).json({ error: "Failed to publish event" });
  }
});

// ─── Get orders for organizer's events ───
router.get("/orders", authenticate, async (req, res) => {
  const { event_id, status, page = 1, limit = 100 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);

  try {
    // First get all event IDs owned by this organizer
    let eventIds;
    if (event_id) {
      // Verify this event belongs to the organizer
      const { data: evt } = await supabaseAdmin
        .from("events").select("id, admin_id").eq("id", event_id).single();
      if (!evt || evt.admin_id !== req.user.id) {
        return res.status(403).json({ error: "Not your event" });
      }
      eventIds = [event_id];
    } else {
      const { data: events } = await supabaseAdmin
        .from("events").select("id").eq("admin_id", req.user.id);
      eventIds = (events || []).map((e) => e.id);
    }

    if (eventIds.length === 0) return res.json({ orders: [], total: 0 });

    let query = supabaseAdmin
      .from("orders")
      .select(`
        *,
        events(id, title, event_start),
        users(id, full_name, email),
        order_items(id, price, ticket_tiers(name)),
        order_food_items(id, quantity, food_options(name))
      `, { count: "exact" })
      .in("event_id", eventIds)
      .in("status", ["paid", "reserved", "refunded", "cancelled"])
      .order("created_at", { ascending: false })
      .range(offset, offset + parseInt(limit) - 1);

    if (status) query = query.eq("status", status);

    const { data: orders, error, count } = await query;
    if (error) throw error;

    res.json({ orders: orders || [], total: count || 0 });
  } catch (err) {
    console.error("Organizer orders error:", err);
    res.status(500).json({ error: "Failed to fetch orders" });
  }
});

// ─── List promo codes for this organizer ───
router.get("/promo-codes", authenticate, async (req, res) => {
  const { event_id } = req.query;
  try {
    let query = supabaseAdmin
      .from("promo_codes")
      .select("*, events(id, title)")
      .eq("admin_id", req.user.id)
      .order("created_at", { ascending: false });

    if (event_id) query = query.eq("event_id", event_id);

    const { data, error } = await query;
    if (error) throw error;
    res.json({ promo_codes: data || [] });
  } catch (err) {
    console.error("List promo codes error:", err);
    res.status(500).json({ error: "Failed to fetch promo codes" });
  }
});

// ─── Create promo code ───
router.post("/promo-codes", authenticate, async (req, res) => {
  const {
    code, event_id, discount_type, discount_value,
    max_uses, valid_until, min_order_amount,
    restricted_to_email,
  } = req.body;

  if (!code || !discount_type || discount_value == null) {
    return res.status(400).json({ error: "code, discount_type, and discount_value are required" });
  }
  if (!["percent", "flat"].includes(discount_type)) {
    return res.status(400).json({ error: "discount_type must be 'percent' or 'flat'" });
  }

  try {
    // If event_id supplied, verify ownership
    if (event_id) {
      const { data: evt } = await supabaseAdmin
        .from("events").select("id, admin_id").eq("id", event_id).single();
      if (!evt || evt.admin_id !== req.user.id) {
        return res.status(403).json({ error: "Not your event" });
      }
    }

    const { data, error } = await supabaseAdmin.from("promo_codes").insert({
      admin_id: req.user.id,
      code: code.toUpperCase().trim(),
      event_id: event_id || null,
      discount_type,
      discount_value: parseFloat(discount_value),
      max_uses: max_uses ? parseInt(max_uses) : null,
      valid_until: valid_until || null,
      min_order_amount: min_order_amount ? parseFloat(min_order_amount) : 0,
      restricted_to_email: restricted_to_email?.toLowerCase().trim() || null,
      is_active: true,
      used_count: 0,
    }).select("*, events(id, title)").single();

    if (error) {
      if (error.code === "23505") return res.status(409).json({ error: "Promo code already exists" });
      throw error;
    }
    res.status(201).json({ promo_code: data });
  } catch (err) {
    console.error("Create promo code error:", err);
    res.status(500).json({ error: "Failed to create promo code" });
  }
});

// ─── Toggle promo code active/inactive ───
router.patch("/promo-codes/:id", authenticate, async (req, res) => {
  try {
    const { data: existing } = await supabaseAdmin
      .from("promo_codes").select("id, admin_id").eq("id", req.params.id).single();

    if (!existing || existing.admin_id !== req.user.id) {
      return res.status(403).json({ error: "Not your promo code" });
    }

    const allowed = ["is_active", "max_uses", "valid_until", "restricted_to_email", "discount_value"];
    const updates = Object.fromEntries(
      Object.entries(req.body).filter(([k]) => allowed.includes(k))
    );

    const { data, error } = await supabaseAdmin
      .from("promo_codes").update(updates).eq("id", req.params.id)
      .select("*, events(id, title)").single();

    if (error) throw error;
    res.json({ promo_code: data });
  } catch (err) {
    console.error("Update promo code error:", err);
    res.status(500).json({ error: "Failed to update promo code" });
  }
});

// ─── Delete promo code ───
router.delete("/promo-codes/:id", authenticate, async (req, res) => {
  try {
    const { data: existing } = await supabaseAdmin
      .from("promo_codes").select("id, admin_id, used_count").eq("id", req.params.id).single();

    if (!existing || existing.admin_id !== req.user.id) {
      return res.status(403).json({ error: "Not your promo code" });
    }
    if (existing.used_count > 0) {
      return res.status(400).json({ error: "Cannot delete a code that has already been used. Deactivate it instead." });
    }

    await supabaseAdmin.from("promo_codes").delete().eq("id", req.params.id);
    res.json({ message: "Promo code deleted" });
  } catch (err) {
    console.error("Delete promo code error:", err);
    res.status(500).json({ error: "Failed to delete promo code" });
  }
});

// ─── Toggle ticket sales pause/resume ───
router.patch("/events/:id/sales", authenticate, async (req, res) => {
  try {
    const { data: event } = await supabaseAdmin
      .from("events").select("id, admin_id, status, sales_paused").eq("id", req.params.id).single();

    if (!event) return res.status(404).json({ error: "Event not found" });
    if (event.admin_id !== req.user.id) return res.status(403).json({ error: "Not your event" });
    if (event.status !== "published") return res.status(400).json({ error: "Only published events can have sales toggled" });

    const newState = !event.sales_paused;
    const { data, error } = await supabaseAdmin.from("events")
      .update({ sales_paused: newState })
      .eq("id", req.params.id).select("id, sales_paused").single();

    if (error) throw error;

    await supabaseAdmin.from("audit_log").insert({
      user_id: req.user.id,
      action: newState ? "event.sales_paused" : "event.sales_resumed",
      entity_type: "event", entity_id: req.params.id,
    });

    res.json({ sales_paused: data.sales_paused });
  } catch (err) {
    console.error("Toggle sales error:", err);
    res.status(500).json({ error: "Failed to toggle sales" });
  }
});

// ─── Get single event for editing ───
router.get("/events/:id", authenticate, async (req, res) => {
  try {
    const { data: event, error } = await supabaseAdmin
      .from("events")
      .select("*, ticket_tiers(*), event_media(url, is_cover, media_type, display_order)")
      .eq("id", req.params.id)
      .single();

    if (error || !event) return res.status(404).json({ error: "Event not found" });
    if (event.admin_id !== req.user.id) return res.status(403).json({ error: "Not your event" });

    res.json({ event });
  } catch (err) {
    console.error("Get event error:", err);
    res.status(500).json({ error: "Failed to fetch event" });
  }
});

// ─── Update event (organizer) ───
router.patch("/events/:id", authenticate, async (req, res) => {
  try {
    const { data: existing } = await supabaseAdmin
      .from("events").select("id, admin_id, status").eq("id", req.params.id).single();

    if (!existing) return res.status(404).json({ error: "Event not found" });
    if (existing.admin_id !== req.user.id) return res.status(403).json({ error: "Not your event" });

    const { tiers, ...eventFields } = req.body;

    // Don't allow changing status through this endpoint
    delete eventFields.status;
    delete eventFields.admin_id;

    const { data: event, error } = await supabaseAdmin
      .from("events").update(eventFields).eq("id", req.params.id).select().single();

    if (error) throw error;

    // Update tiers if provided
    if (tiers && Array.isArray(tiers)) {
      for (const tier of tiers) {
        if (tier.id) {
          // Update existing tier
          await supabaseAdmin.from("ticket_tiers").update({
            name: tier.name,
            description: tier.description || "",
            price: parseFloat(tier.price) || 0,
            total_quantity: parseInt(tier.total_quantity) || 1,
            max_per_user: parseInt(tier.max_per_user) || 10,
          }).eq("id", tier.id).eq("event_id", req.params.id);
        } else {
          // New tier
          await supabaseAdmin.from("ticket_tiers").insert({
            event_id: req.params.id,
            name: tier.name,
            description: tier.description || "",
            price: parseFloat(tier.price) || 0,
            total_quantity: parseInt(tier.total_quantity) || 1,
            max_per_user: parseInt(tier.max_per_user) || 10,
            sold_quantity: 0,
            is_active: true,
          });
        }
      }
    }

    await supabaseAdmin.from("audit_log").insert({
      user_id: req.user.id, action: "event.updated",
      entity_type: "event", entity_id: req.params.id,
      metadata: { fields_updated: Object.keys(eventFields) },
    });

    res.json({ event });
  } catch (err) {
    console.error("Update event error:", err);
    res.status(500).json({ error: "Failed to update event" });
  }
});

// ─── Revenue per event ───
router.get("/revenue", authenticate, async (req, res) => {
  try {
    const { data: events } = await supabaseAdmin
      .from("events")
      .select("id, title, event_start, status, ticket_tiers(id, total_quantity, sold_quantity, price)")
      .eq("admin_id", req.user.id)
      .order("event_start", { ascending: false });

    if (!events || events.length === 0) return res.json({ revenue: [] });

    const eventIds = events.map((e) => e.id);

    const { data: orders } = await supabaseAdmin
      .from("orders")
      .select("id, event_id, total, subtotal, platform_fee, stripe_fee")
      .in("event_id", eventIds)
      .eq("status", "paid");

    const revenueByEvent = events.map((evt) => {
      const evtOrders = (orders || []).filter((o) => o.event_id === evt.id);
      const gross = evtOrders.reduce((s, o) => s + parseFloat(o.total || 0), 0);
      const fees = evtOrders.reduce((s, o) => s + parseFloat(o.platform_fee || 0) + parseFloat(o.stripe_fee || 0), 0);
      const tickets_sold = (evt.ticket_tiers || []).reduce((s, t) => s + (t.sold_quantity || 0), 0);
      const total_tickets = (evt.ticket_tiers || []).reduce((s, t) => s + (t.total_quantity || 0), 0);
      return {
        id: evt.id,
        title: evt.title,
        event_start: evt.event_start,
        status: evt.status,
        tickets_sold,
        total_tickets,
        orders_count: evtOrders.length,
        gross_revenue: parseFloat(gross.toFixed(2)),
        fees: parseFloat(fees.toFixed(2)),
        net_revenue: parseFloat((gross - fees).toFixed(2)),
      };
    });

    res.json({ revenue: revenueByEvent });
  } catch (err) {
    console.error("Revenue error:", err);
    res.status(500).json({ error: "Failed to fetch revenue" });
  }
});

module.exports = router;
