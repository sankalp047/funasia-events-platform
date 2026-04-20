const express = require("express");
const router = express.Router();
const { v4: uuidv4 } = require("uuid");
const { supabaseAdmin } = require("../config/supabase");
const { stripe } = require("../config/stripe");
const { authenticate } = require("../middleware/auth");
const { validate, createOrderSchema } = require("../middleware/validate");
const { sendOrderConfirmation } = require("../services/email.service");

const RESERVATION_MINUTES = 30;

// ─── Validate Promo Code ───
router.post("/validate-promo", authenticate, async (req, res) => {
  const { event_id, promo_code, subtotal } = req.body;
  if (!promo_code) return res.status(400).json({ valid: false, message: "No promo code provided" });

  try {
    const { data: promo } = await supabaseAdmin
      .from("promo_codes")
      .select("*")
      .eq("code", promo_code.toUpperCase())
      .eq("is_active", true)
      .single();

    if (!promo) return res.json({ valid: false, message: "Invalid or inactive promo code" });

    const validForEvent = !promo.event_id || promo.event_id === event_id;
    const notExpired = !promo.valid_until || new Date(promo.valid_until) > new Date();
    const notMaxed = !promo.max_uses || promo.used_count < promo.max_uses;
    const emailAllowed = !promo.restricted_to_email ||
      promo.restricted_to_email.toLowerCase() === req.user.email?.toLowerCase();
    const meetsMinOrder = !promo.min_order_amount || (subtotal || 0) >= promo.min_order_amount;

    if (!validForEvent) return res.json({ valid: false, message: "This code is not valid for this event" });
    if (!notExpired)    return res.json({ valid: false, message: "This promo code has expired" });
    if (!notMaxed)      return res.json({ valid: false, message: "This promo code has reached its usage limit" });
    if (!emailAllowed)  return res.json({ valid: false, message: "This promo code is not valid for your account" });
    if (!meetsMinOrder) return res.json({ valid: false, message: `Minimum order of $${promo.min_order_amount} required` });

    let discountAmount = 0;
    if (promo.discount_type === "percent") {
      discountAmount = Math.round((subtotal || 0) * (promo.discount_value / 100) * 100) / 100;
    } else {
      discountAmount = Math.min(promo.discount_value, subtotal || 0);
    }

    res.json({
      valid: true,
      discount_amount: discountAmount,
      discount_type: promo.discount_type,
      discount_value: promo.discount_value,
      message: promo.discount_type === "percent"
        ? `${promo.discount_value}% off applied!`
        : `$${discountAmount.toFixed(2)} off applied!`,
    });
  } catch (err) {
    console.error("Validate promo error:", err);
    res.status(500).json({ valid: false, message: "Could not validate promo code" });
  }
});

// ─── Create Order (reserve seats for 5 minutes) ───
router.post("/", authenticate, validate(createOrderSchema), async (req, res) => {
  const { event_id, items, food_items, promo_code } = req.validated;

  try {
    // 1. Fetch event with tiers and food
    const { data: event, error: evtErr } = await supabaseAdmin
      .from("events")
      .select("*, ticket_tiers(*), food_options(*)")
      .eq("id", event_id)
      .in("status", ["published"])
      .single();

    if (evtErr || !event) return res.status(404).json({ error: "Event not found" });

    // Guard: reject if event has already ended
    if (new Date(event.event_end) < new Date()) {
      return res.status(400).json({ error: "This event has already ended. Ticket sales are closed." });
    }

    // Guard: reject if organizer paused sales
    if (event.sales_paused) {
      return res.status(400).json({ error: "Ticket sales for this event are currently paused." });
    }

    // 2. Validate items and calculate pricing
    let subtotal = 0;
    const orderItems = [];

    for (const item of items) {
      const tier = event.ticket_tiers.find((t) => t.id === item.tier_id);
      if (!tier) return res.status(400).json({ error: `Invalid ticket tier: ${item.tier_id}` });
      if (!tier.is_active) return res.status(400).json({ error: `Tier "${tier.name}" is not available` });

      const qty = item.quantity || 1;

      // Check availability
      if (tier.sold_quantity + qty > tier.total_quantity) {
        return res.status(409).json({
          error: `Not enough tickets available for "${tier.name}". ${tier.total_quantity - tier.sold_quantity} remaining.`,
        });
      }

      // Check per-user limit
      if (qty > tier.max_per_user) {
        return res.status(400).json({ error: `Max ${tier.max_per_user} tickets per user for "${tier.name}"` });
      }

      // If seat-based, reserve specific seats
      if (item.seat_id) {
        const { data: seat } = await supabaseAdmin
          .from("seats")
          .select("*")
          .eq("id", item.seat_id)
          .eq("is_available", true)
          .eq("is_reserved", false)
          .single();

        if (!seat) return res.status(409).json({ error: "Selected seat is no longer available" });
      }

      for (let i = 0; i < qty; i++) {
        const barcode = `FA-${uuidv4().replace(/-/g, "").substring(0, 12).toUpperCase()}`;
        orderItems.push({
          tier_id: tier.id,
          seat_id: item.seat_id || null,
          attendee_name: item.attendee_name || "",
          attendee_email: item.attendee_email || "",
          price: tier.price,
          barcode,
        });
        subtotal += tier.price;
      }
    }

    // 3. Calculate food total
    let foodTotal = 0;
    const orderFoodItems = [];
    for (const fi of food_items) {
      const foodOpt = event.food_options.find((f) => f.id === fi.food_option_id);
      if (!foodOpt || !foodOpt.is_active) continue;
      const lineTotal = foodOpt.price * fi.quantity;
      foodTotal += lineTotal;
      orderFoodItems.push({
        food_option_id: fi.food_option_id,
        quantity: fi.quantity,
        unit_price: foodOpt.price,
        total_price: lineTotal,
      });
    }

    // 4. Apply promo code
    let discountAmount = 0;
    let promoId = null;
    if (promo_code) {
      const { data: promo } = await supabaseAdmin
        .from("promo_codes")
        .select("*")
        .eq("code", promo_code.toUpperCase())
        .eq("is_active", true)
        .single();

      if (promo) {
        const validForEvent = !promo.event_id || promo.event_id === event_id;
        const notExpired = !promo.valid_until || new Date(promo.valid_until) > new Date();
        const notMaxed = !promo.max_uses || promo.used_count < promo.max_uses;
        const emailAllowed = !promo.restricted_to_email ||
          promo.restricted_to_email.toLowerCase() === req.user.email?.toLowerCase();

        if (validForEvent && notExpired && notMaxed && emailAllowed && subtotal >= promo.min_order_amount) {
          if (promo.discount_type === "percent") {
            discountAmount = Math.round(subtotal * (promo.discount_value / 100) * 100) / 100;
          } else {
            discountAmount = Math.min(promo.discount_value, subtotal);
          }
          promoId = promo.id;
        }
      }
    }

    // 5. Calculate platform & stripe fees
    const afterDiscount = subtotal - discountAmount + foodTotal;
    const platformFee =
      Math.round((afterDiscount * (event.platform_fee_percent / 100) + event.platform_fee_flat) * 100) / 100;
    const stripeFee = event.ticket_type === "free" ? 0 : Math.round((afterDiscount * 0.029 + 0.3) * 100) / 100;
    const total = Math.round((afterDiscount + platformFee + stripeFee) * 100) / 100;

    // 6. Create order in DB with 'reserved' status
    const reservationExpiry = new Date(Date.now() + RESERVATION_MINUTES * 60 * 1000).toISOString();

    const { data: order, error: orderErr } = await supabaseAdmin
      .from("orders")
      .insert({
        user_id: req.user.id,
        event_id,
        status: "reserved",
        subtotal,
        food_total: foodTotal,
        discount_amount: discountAmount,
        platform_fee: platformFee,
        stripe_fee: stripeFee,
        total,
        promo_code_id: promoId,
        reserved_at: new Date().toISOString(),
        reservation_expires_at: reservationExpiry,
      })
      .select()
      .single();

    if (orderErr) throw orderErr;

    // 7. Insert order items
    const itemsToInsert = orderItems.map((oi) => ({ ...oi, order_id: order.id }));
    const { error: itemsErr } = await supabaseAdmin.from("order_items").insert(itemsToInsert);
    if (itemsErr) throw itemsErr;

    // 8. Insert food items
    if (orderFoodItems.length > 0) {
      const foodToInsert = orderFoodItems.map((fi) => ({ ...fi, order_id: order.id }));
      await supabaseAdmin.from("order_food_items").insert(foodToInsert);
    }

    // 9. Reserve seats (mark as reserved for 5 min)
    const seatIds = orderItems.filter((oi) => oi.seat_id).map((oi) => oi.seat_id);
    if (seatIds.length > 0) {
      await supabaseAdmin
        .from("seats")
        .update({
          is_reserved: true,
          reserved_until: reservationExpiry,
          reserved_by: req.user.id,
        })
        .in("id", seatIds);
    }

    // 10. Increment sold_quantity on tiers
    for (const item of items) {
      const qty = item.quantity || 1;
      await supabaseAdmin.rpc("increment_tier_sold", { tier_id: item.tier_id, amount: qty });
    }

    // 11. Increment promo usage
    if (promoId) {
      await supabaseAdmin.rpc("increment_promo_usage", { promo_id: promoId });
    }

    // 12. For free events, mark as paid immediately
    if (event.ticket_type === "free") {
      await supabaseAdmin.from("orders").update({ status: "paid", paid_at: new Date().toISOString() }).eq("id", order.id);

      // Send confirmation email — wrapped so a failure never blocks the order
      try {
        const { data: tickets } = await supabaseAdmin.from("order_items").select("*, ticket_tiers(name), seats(label)").eq("order_id", order.id);
        await sendOrderConfirmation({
          order: { ...order, order_number: order.order_number },
          event,
          tickets,
          userEmail: req.user.email,
          userName: req.user.full_name,
        });
        await supabaseAdmin.from("orders").update({ confirmation_email_sent: true }).eq("id", order.id);
      } catch (emailErr) {
        console.error("Confirmation email failed (order still confirmed):", emailErr.message);
      }

      return res.status(201).json({
        order: { ...order, status: "paid" },
        message: "Free event — tickets confirmed! Check your email.",
      });
    }

    // 13. For paid events, create Stripe Checkout Session
    const lineItems = orderItems.reduce((acc, oi) => {
      const existing = acc.find((a) => a.tier_id === oi.tier_id);
      if (existing) {
        existing.quantity += 1;
      } else {
        const tier = event.ticket_tiers.find((t) => t.id === oi.tier_id);
        acc.push({ tier_id: oi.tier_id, name: tier.name, price: oi.price, quantity: 1 });
      }
      return acc;
    }, []);

    const stripeLineItems = lineItems.map((li) => ({
      price_data: {
        currency: "usd",
        product_data: { name: `${event.title} — ${li.name}` },
        unit_amount: Math.round(li.price * 100),
      },
      quantity: li.quantity,
    }));

    // Add food items to Stripe
    for (const fi of orderFoodItems) {
      const foodOpt = event.food_options.find((f) => f.id === fi.food_option_id);
      stripeLineItems.push({
        price_data: {
          currency: "usd",
          product_data: { name: `🍽 ${foodOpt.name}` },
          unit_amount: Math.round(fi.unit_price * 100),
        },
        quantity: fi.quantity,
      });
    }

    // Add fees as line items
    if (platformFee > 0) {
      stripeLineItems.push({
        price_data: {
          currency: "usd",
          product_data: { name: "Service Fee" },
          unit_amount: Math.round(platformFee * 100),
        },
        quantity: 1,
      });
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: stripeLineItems,
      mode: "payment",
      success_url: `${process.env.FRONTEND_URL}/order/${order.id}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.FRONTEND_URL}/order/${order.id}/cancelled`,
      metadata: {
        order_id: order.id,
        event_id: event.id,
        user_id: req.user.id,
      },
      customer_email: req.user.email,
      expires_at: Math.floor(Date.now() / 1000) + 30 * 60,// Match reservation window
      ...(discountAmount > 0 && {
        discounts: [
          {
            coupon: await getOrCreateStripeCoupon(discountAmount, subtotal + foodTotal),
          },
        ],
      }),
    });

    // Save Stripe session ID to order
    await supabaseAdmin
      .from("orders")
      .update({ stripe_checkout_session_id: session.id })
      .eq("id", order.id);

    res.status(201).json({
      order,
      checkout_url: session.url,
      expires_in_seconds: RESERVATION_MINUTES * 60,
    });
  } catch (err) {
    console.error("Create order error:", err);
    res.status(500).json({ error: "Failed to create order" });
  }
});

// Helper: create one-time Stripe coupon for discount
async function getOrCreateStripeCoupon(discountAmount, orderTotal) {
  const coupon = await stripe.coupons.create({
    amount_off: Math.round(discountAmount * 100),
    currency: "usd",
    duration: "once",
    name: `Promo discount`,
  });
  return coupon.id;
}

// ─── Get Order Status ───
router.get("/:id", authenticate, async (req, res) => {
  try {
    const { data: order, error } = await supabaseAdmin
      .from("orders")
      .select(`
        *,
        events(id, title, event_start, event_end, venue_name, city, state, seat_map_image_url),
        order_items(*, ticket_tiers(name), seats(label)),
        order_food_items(*, food_options(name))
      `)
      .eq("id", req.params.id)
      .eq("user_id", req.user.id)
      .single();

    if (error || !order) return res.status(404).json({ error: "Order not found" });

    // Check if reservation expired
    if (order.status === "reserved" && new Date(order.reservation_expires_at) < new Date()) {
      order.status = "expired";
    }

    res.json({ order });
  } catch (err) {
    console.error("Get order error:", err);
    res.status(500).json({ error: "Failed to fetch order" });
  }
});

// ─── Fulfill Order (paid-event fallback when Stripe webhook is delayed/missing) ───
// Called by the success page with the Stripe session_id to verify payment and send email.
router.post("/:id/fulfill", authenticate, async (req, res) => {
  const { session_id } = req.body;
  if (!session_id) return res.status(400).json({ error: "session_id required" });

  try {
    // 1. Load order — must belong to this user
    const { data: order, error: orderErr } = await supabaseAdmin
      .from("orders")
      .select("*, events(*)")
      .eq("id", req.params.id)
      .eq("user_id", req.user.id)
      .single();

    if (orderErr || !order) return res.status(404).json({ error: "Order not found" });

    // 2. Already handled — just return current status
    if (order.status === "paid") {
      return res.json({ status: "paid", email_sent: order.confirmation_email_sent });
    }

    // 3. Verify payment with Stripe directly
    const session = await stripe.checkout.sessions.retrieve(session_id);
    if (session.payment_status !== "paid" || session.metadata.order_id !== req.params.id) {
      return res.status(400).json({ error: "Payment not confirmed" });
    }

    // 4. Mark order as paid
    await supabaseAdmin
      .from("orders")
      .update({
        status: "paid",
        paid_at: new Date().toISOString(),
        stripe_payment_intent_id: session.payment_intent,
      })
      .eq("id", req.params.id);

    // 5. Mark seats permanently sold
    const { data: items } = await supabaseAdmin
      .from("order_items")
      .select("seat_id, ticket_tiers(name), seats(label)")
      .eq("order_id", req.params.id);

    const seatIds = (items || []).filter((i) => i.seat_id).map((i) => i.seat_id);
    if (seatIds.length > 0) {
      await supabaseAdmin
        .from("seats")
        .update({ is_available: false, is_reserved: false, reserved_until: null })
        .in("id", seatIds);
    }

    // 6. Send confirmation email with PDF
    try {
      const { data: tickets } = await supabaseAdmin
        .from("order_items")
        .select("*, ticket_tiers(name), seats(label)")
        .eq("order_id", req.params.id);

      const { data: user } = await supabaseAdmin
        .from("users")
        .select("email, full_name")
        .eq("id", req.user.id)
        .single();

      await sendOrderConfirmation({
        order,
        event: order.events,
        tickets,
        userEmail: user.email,
        userName: user.full_name,
      });

      await supabaseAdmin
        .from("orders")
        .update({ confirmation_email_sent: true })
        .eq("id", req.params.id);
    } catch (emailErr) {
      console.error("Fulfill email failed (order still paid):", emailErr.message);
    }

    res.json({ status: "paid", email_sent: true });
  } catch (err) {
    console.error("Fulfill order error:", err);
    res.status(500).json({ error: "Failed to fulfill order" });
  }
});

// ─── Get User's Orders ───
router.get("/", authenticate, async (req, res) => {
  try {
    const { data: orders, error } = await supabaseAdmin
      .from("orders")
      .select(`
        *,
        events(id, title, event_start, venue_name, city, state, event_media(url, is_cover))
      `)
      .eq("user_id", req.user.id)
      .in("status", ["paid", "reserved"])
      .order("created_at", { ascending: false });

    if (error) throw error;
    res.json({ orders });
  } catch (err) {
    console.error("List orders error:", err);
    res.status(500).json({ error: "Failed to fetch orders" });
  }
});

// ─── Debug: Resend Confirmation Email ───
// Hit GET /orders/:id/resend-email to force-send and see the full error if it fails.
router.get("/:id/resend-email", authenticate, async (req, res) => {
  try {
    const { data: order } = await supabaseAdmin
      .from("orders")
      .select("*, events(*)")
      .eq("id", req.params.id)
      .eq("user_id", req.user.id)
      .single();

    if (!order) return res.status(404).json({ error: "Order not found" });

    const { data: tickets } = await supabaseAdmin
      .from("order_items")
      .select("*, ticket_tiers(name), seats(label)")
      .eq("order_id", req.params.id);

    const { data: user } = await supabaseAdmin
      .from("users").select("email, full_name").eq("id", req.user.id).single();

    console.log("Resend email attempt →", { to: user.email, tickets: tickets?.length, event: order.events?.title });

    const result = await sendOrderConfirmation({
      order,
      event: order.events,
      tickets,
      userEmail: user.email,
      userName: user.full_name,
    });

    console.log("Email send result:", JSON.stringify(result));
    res.json({ ok: true, result });
  } catch (err) {
    console.error("Resend email FULL error:", err);
    res.status(500).json({ error: err.message, stack: err.stack, details: err.response?.data || err.response?.body || null });
  }
});

// ─── Cancel Order (before payment) ───
router.post("/:id/cancel", authenticate, async (req, res) => {
  try {
    const { data: order } = await supabaseAdmin
      .from("orders")
      .select("*")
      .eq("id", req.params.id)
      .eq("user_id", req.user.id)
      .eq("status", "reserved")
      .single();

    if (!order) return res.status(404).json({ error: "Order not found or already processed" });

    // Release seats
    const { data: items } = await supabaseAdmin
      .from("order_items")
      .select("seat_id, tier_id")
      .eq("order_id", order.id);

    const seatIds = items.filter((i) => i.seat_id).map((i) => i.seat_id);
    if (seatIds.length > 0) {
      await supabaseAdmin
        .from("seats")
        .update({ is_reserved: false, reserved_until: null, reserved_by: null })
        .in("id", seatIds);
    }

    // Decrement tier sold counts
    const tierCounts = {};
    items.forEach((i) => {
      tierCounts[i.tier_id] = (tierCounts[i.tier_id] || 0) + 1;
    });
    for (const [tierId, count] of Object.entries(tierCounts)) {
      await supabaseAdmin.rpc("increment_tier_sold", { tier_id: tierId, amount: -count });
    }

    // Update order status
    await supabaseAdmin
      .from("orders")
      .update({ status: "cancelled", cancelled_at: new Date().toISOString() })
      .eq("id", order.id);

    res.json({ message: "Order cancelled, seats released" });
  } catch (err) {
    console.error("Cancel order error:", err);
    res.status(500).json({ error: "Failed to cancel order" });
  }
});

module.exports = router;
