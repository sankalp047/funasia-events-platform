const express = require("express");
const router = express.Router();
const { supabaseAdmin } = require("../config/supabase");
const { authenticate, requireRole, optionalAuth } = require("../middleware/auth");
const { validate, validateQuery, createEventSchema, searchEventsSchema } = require("../middleware/validate");

// ─── Autocomplete Search ───
router.get("/autocomplete", optionalAuth, async (req, res) => {
  const q = (req.query.q || "").trim();
  if (q.length < 2) return res.json({ results: [] });

  try {
    const { data, error } = await supabaseAdmin
      .from("events")
      .select("id, title, slug, city, state, event_start, category, is_online")
      .in("status", ["published", "completed", "cancelled"])
      .or(`title.ilike.%${q}%,venue_name.ilike.%${q}%,city.ilike.%${q}%`)
      .limit(8);

    if (error) throw error;
    res.json({ results: data || [] });
  } catch (err) {
    res.status(500).json({ results: [] });
  }
});

// ─── Search Events (city-first + nearby + sponsored) ───
router.get("/", validateQuery(searchEventsSchema), optionalAuth, async (req, res) => {
  const { lat, lng, radius_miles, city, state, category, search, ticket_type, is_online, page, limit, sort } = req.validatedQuery;
  const offset = (page - 1) * limit;

  try {
    let query = supabaseAdmin
      .from("events")
      .select(`
        *,
        event_media(id, url, media_type, is_cover, display_order),
        ticket_tiers(id, name, price, total_quantity, sold_quantity, is_active)
      `, { count: "exact" })
      .in("status", ["published", "completed", "cancelled"]);

    // City/State filter — global events always included
    if (city) query = query.or(`city.ilike.%${city}%,is_global.eq.true`);
    if (state) query = query.or(`state.ilike.%${state}%,is_global.eq.true`);

    // Category filter
    if (category) query = query.eq("category", category);

    // Free vs paid
    if (ticket_type) query = query.eq("ticket_type", ticket_type);

    // Online events filter
    if (is_online !== undefined) query = query.eq("is_online", is_online);

    // Text search
    if (search) {
      query = query.or(`title.ilike.%${search}%,short_description.ilike.%${search}%,venue_name.ilike.%${search}%,city.ilike.%${search}%`);
    }

    // Base sorting — upcoming first, then past; sponsored/featured float to top within each group
    query = query
      .order("is_sponsored", { ascending: false })
      .order("is_featured", { ascending: false })
      .order("event_start", { ascending: sort === "date_desc" ? false : true });

    query = query.range(offset, offset + limit - 1);

    const { data: events, error, count } = await query;
    if (error) throw error;

    // Compute distance if user has location
    let distanceMap = {};
    if (lat && lng) {
      const radiusMeters = (radius_miles || 100) * 1609.34;
      const { data: nearbyIds } = await supabaseAdmin.rpc("events_within_radius", {
        user_lat: lat,
        user_lng: lng,
        radius_m: radiusMeters,
      });
      if (nearbyIds) {
        nearbyIds.forEach((r) => { distanceMap[r.id] = r.distance_m; });
      }
    }

    // Enrich events
    const enriched = events.map((evt) => {
      const activeTiers = (evt.ticket_tiers || []).filter((t) => t.is_active);
      const minPrice = activeTiers.length > 0 ? Math.min(...activeTiers.map((t) => t.price)) : 0;
      const maxPrice = activeTiers.length > 0 ? Math.max(...activeTiers.map((t) => t.price)) : 0;
      const totalSeats = activeTiers.reduce((s, t) => s + t.total_quantity, 0);
      const totalSold = activeTiers.reduce((s, t) => s + t.sold_quantity, 0);
      const coverImage = (evt.event_media || []).find((m) => m.is_cover) || evt.event_media?.[0];
      const distanceM = distanceMap[evt.id];
      const distanceMiles = distanceM ? Math.round(distanceM / 1609.34) : null;

      return {
        ...evt,
        min_price: minPrice,
        max_price: maxPrice,
        total_seats: totalSeats,
        total_sold: totalSold,
        availability_percent: totalSeats > 0 ? Math.round((totalSold / totalSeats) * 100) : 0,
        cover_image: coverImage?.url || null,
        distance_miles: distanceMiles,
        is_past: new Date(evt.event_end) < new Date(),
      };
    });

    // Sort: sponsored → same-city → distance → date
    const userCity = city?.toLowerCase();
    enriched.sort((a, b) => {
      if (a.is_sponsored && !b.is_sponsored) return -1;
      if (!a.is_sponsored && b.is_sponsored) return 1;
      if (a.is_sponsored && b.is_sponsored) return (b.sponsored_priority || 0) - (a.sponsored_priority || 0);

      if (a.is_featured && !b.is_featured) return -1;
      if (!a.is_featured && b.is_featured) return 1;

      if (userCity) {
        const aInCity = a.city?.toLowerCase().includes(userCity);
        const bInCity = b.city?.toLowerCase().includes(userCity);
        if (aInCity && !bInCity) return -1;
        if (!aInCity && bInCity) return 1;
      }

      if (a.distance_miles !== null && b.distance_miles !== null) {
        return a.distance_miles - b.distance_miles;
      }

      return new Date(a.event_start) - new Date(b.event_start);
    });

    res.json({ events: enriched, total: count, page, limit, total_pages: Math.ceil(count / limit) });
  } catch (err) {
    console.error("Event search error:", err);
    res.status(500).json({ error: "Failed to fetch events" });
  }
});

// ─── Get Single Event ───
router.get("/:idOrSlug", optionalAuth, async (req, res) => {
  const { idOrSlug } = req.params;
  try {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idOrSlug);
    let query = supabaseAdmin
      .from("events")
      .select(`*, event_media(*), ticket_tiers(*), food_options(*), users!events_admin_id_fkey(id, full_name, avatar_url)`)
      .in("status", ["published", "completed", "cancelled"]);

    query = isUuid ? query.eq("id", idOrSlug) : query.eq("slug", idOrSlug);

    const { data: event, error } = await query.single();
    if (error || !event) return res.status(404).json({ error: "Event not found" });

    const { data: seats } = await supabaseAdmin
      .from("seats")
      .select("id, tier_id, section, row_label, seat_number, label, is_available, is_reserved")
      .eq("event_id", event.id).order("section").order("row_label").order("seat_number");

    event.event_media?.sort((a, b) => a.display_order - b.display_order);
    event.ticket_tiers?.sort((a, b) => a.sort_order - b.sort_order);
    event.food_options?.sort((a, b) => a.sort_order - b.sort_order);

    res.json({ event: { ...event, seats: seats || [], organizer: event.users } });
  } catch (err) {
    console.error("Event detail error:", err);
    res.status(500).json({ error: "Failed to fetch event" });
  }
});

// ─── Create Event ───
router.post("/", authenticate, requireRole("admin", "super_admin"), validate(createEventSchema), async (req, res) => {
  const data = req.validated;
  try {
    let slug;
    if (data.slug) {
      const { data: existing } = await supabaseAdmin.from("events").select("id").eq("slug", data.slug).maybeSingle();
      if (existing) return res.status(400).json({ error: "That URL is already taken. Choose a different one." });
      slug = data.slug;
    } else {
      slug = data.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") + "-" + Date.now().toString(36);
    }

    const { data: feeSettings } = await supabaseAdmin
      .from("platform_settings").select("key, value")
      .in("key", ["default_platform_fee_percent", "default_platform_fee_flat"]);
    const feeMap = Object.fromEntries((feeSettings || []).map((s) => [s.key, parseFloat(s.value)]));

    const { data: event, error: eventError } = await supabaseAdmin.from("events").insert({
      admin_id: req.user.id, title: data.title, slug,
      description: data.description, short_description: data.short_description,
      ticket_type: data.ticket_type, venue_name: data.venue_name,
      venue_address: data.venue_address, city: data.city, state: data.state,
      zip_code: data.zip_code, event_start: data.event_start, event_end: data.event_end,
      doors_open: data.doors_open, seat_map_image_url: data.seat_map_image_url,
      max_tickets_per_user: data.max_tickets_per_user, category: data.category || null,
      is_online: data.is_online || false,
      is_global: data.is_global || false,
      meeting_link: data.is_online ? (data.meeting_link || null) : null,
      platform_fee_percent: data.ticket_type === "free" ? 0 : (feeMap.default_platform_fee_percent || 0),
      platform_fee_flat: data.ticket_type === "free" ? 0 : (feeMap.default_platform_fee_flat || 0),
      status: "draft",
    }).select().single();

    if (eventError) throw eventError;

    const tiers = data.tiers.map((t, i) => ({
      event_id: event.id, name: t.name, description: t.description,
      price: data.ticket_type === "free" ? 0 : t.price,
      total_quantity: t.total_quantity, max_per_user: t.max_per_user,
      sale_start: t.sale_start, sale_end: t.sale_end, sort_order: i,
    }));
    const { data: insertedTiers, error: tierError } = await supabaseAdmin.from("ticket_tiers").insert(tiers).select();
    if (tierError) throw tierError;

    if (data.food_options?.length > 0) {
      await supabaseAdmin.from("food_options").insert(data.food_options.map((f, i) => ({
        event_id: event.id, name: f.name, description: f.description, price: f.price,
        category: f.category, is_vegetarian: f.is_vegetarian, is_vegan: f.is_vegan,
        max_quantity: f.max_quantity, image_url: f.image_url, sort_order: i,
      })));
    }

    await supabaseAdmin.from("audit_log").insert({
      user_id: req.user.id, action: "event.created", entity_type: "event",
      entity_id: event.id, metadata: { title: event.title },
    });

    res.status(201).json({ event: { ...event, ticket_tiers: insertedTiers } });
  } catch (err) {
    console.error("Create event error:", err);
    res.status(500).json({ error: "Failed to create event" });
  }
});

// ─── Publish Event ───
router.post("/:id/publish", authenticate, requireRole("admin", "super_admin"), async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin.from("events")
      .update({ status: "published", published_at: new Date().toISOString() })
      .eq("id", req.params.id).select().single();
    if (error) throw error;
    res.json({ event: data });
  } catch (err) {
    res.status(500).json({ error: "Failed to publish event" });
  }
});

// ─── Toggle Sponsored (super admin) ───
router.post("/:id/sponsor", authenticate, requireRole("super_admin"), async (req, res) => {
  const { is_sponsored, sponsored_priority } = req.body;
  try {
    const { data, error } = await supabaseAdmin.from("events").update({
      is_sponsored: is_sponsored !== undefined ? is_sponsored : true,
      sponsored_priority: sponsored_priority || 1,
    }).eq("id", req.params.id).select().single();
    if (error) throw error;
    res.json({ event: data });
  } catch (err) {
    res.status(500).json({ error: "Failed to update sponsored status" });
  }
});

// ─── Upload Media ───
router.post("/:id/media", authenticate, requireRole("admin", "super_admin"), async (req, res) => {
  const { media } = req.body;
  try {
    const items = media.map((m, i) => ({
      event_id: req.params.id, url: m.url, thumbnail_url: m.thumbnail_url || null,
      media_type: m.media_type, is_cover: m.is_cover || false,
      width: m.width, height: m.height, display_order: i,
    }));
    const { data, error } = await supabaseAdmin.from("event_media").insert(items).select();
    if (error) throw error;
    res.status(201).json({ media: data });
  } catch (err) {
    res.status(500).json({ error: "Failed to save media" });
  }
});

// ─── Update Event ───
router.patch("/:id", authenticate, requireRole("admin", "super_admin"), async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin.from("events").update(req.body).eq("id", req.params.id).select().single();
    if (error) throw error;
    res.json({ event: data });
  } catch (err) {
    res.status(500).json({ error: "Failed to update event" });
  }
});

// ─── Delete Event (draft only) ───
router.delete("/:id", authenticate, requireRole("admin", "super_admin"), async (req, res) => {
  try {
    await supabaseAdmin.from("events").delete().eq("id", req.params.id).eq("status", "draft");
    res.json({ message: "Event deleted" });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete event" });
  }
});

module.exports = router;