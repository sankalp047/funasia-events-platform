const express = require("express");
const router = express.Router();
const { stripe } = require("../config/stripe");
const { supabaseAdmin } = require("../config/supabase");
const { sendOrderConfirmation } = require("../services/email.service");

// Stripe sends raw body — this route uses express.raw() middleware (configured in server.js)
router.post("/", async (req, res) => {
  const sig = req.headers["stripe-signature"];

  let stripeEvent;
  try {
    stripeEvent = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error("Webhook signature verification failed:", err.message);
    return res.status(400).json({ error: "Invalid signature" });
  }

  try {
    switch (stripeEvent.type) {
      case "checkout.session.completed": {
        const session = stripeEvent.data.object;
        const orderId = session.metadata.order_id;

        // 1. Update order to paid
        const { data: order, error } = await supabaseAdmin
          .from("orders")
          .update({
            status: "paid",
            paid_at: new Date().toISOString(),
            stripe_payment_intent_id: session.payment_intent,
          })
          .eq("id", orderId)
          .eq("status", "reserved")
          .select()
          .single();

        if (error || !order) {
          console.error("Order update failed:", error);
          break;
        }

        // 2. Mark seats as permanently sold (no longer just reserved)
        const { data: items } = await supabaseAdmin
          .from("order_items")
          .select("seat_id")
          .eq("order_id", orderId);

        const seatIds = items?.filter((i) => i.seat_id).map((i) => i.seat_id) || [];
        if (seatIds.length > 0) {
          await supabaseAdmin
            .from("seats")
            .update({ is_available: false, is_reserved: false, reserved_until: null })
            .in("id", seatIds);
        }

        // 3. Fetch data for confirmation email
        const { data: event } = await supabaseAdmin
          .from("events")
          .select("*")
          .eq("id", order.event_id)
          .single();

        const { data: tickets } = await supabaseAdmin
          .from("order_items")
          .select("*, ticket_tiers(name), seats(label)")
          .eq("order_id", orderId);

        const { data: user } = await supabaseAdmin
          .from("users")
          .select("email, full_name")
          .eq("id", order.user_id)
          .single();

        // 4. Send confirmation email with PDF tickets
        try {
          const emailResult = await sendOrderConfirmation({
            order,
            event,
            tickets,
            userEmail: user.email,
            userName: user.full_name,
          });

          // Update email tracking
          await supabaseAdmin
            .from("orders")
            .update({
              confirmation_email_id: emailResult.id,
              confirmation_email_sent: true,
            })
            .eq("id", orderId);
        } catch (emailErr) {
          console.error("Email send failed (order still valid):", emailErr);
        }

        // 5. Audit log
        await supabaseAdmin.from("audit_log").insert({
          user_id: order.user_id,
          action: "order.paid",
          entity_type: "order",
          entity_id: orderId,
          metadata: { amount: order.total, event_id: order.event_id, stripe_session: session.id },
        });

        console.log(`✅ Order ${order.order_number} paid — $${order.total}`);
        break;
      }

      case "checkout.session.expired": {
        const session = stripeEvent.data.object;
        const orderId = session.metadata?.order_id;
        if (orderId) {
          // Release the reservation
          const { data: order } = await supabaseAdmin
            .from("orders")
            .update({ status: "expired" })
            .eq("id", orderId)
            .eq("status", "reserved")
            .select()
            .single();

          if (order) {
            // Release seats
            const { data: items } = await supabaseAdmin
              .from("order_items")
              .select("seat_id, tier_id")
              .eq("order_id", orderId);

            const seatIds = items?.filter((i) => i.seat_id).map((i) => i.seat_id) || [];
            if (seatIds.length > 0) {
              await supabaseAdmin
                .from("seats")
                .update({ is_reserved: false, reserved_until: null, reserved_by: null, is_available: true })
                .in("id", seatIds);
            }

            // Decrement tier sold
            const tierCounts = {};
            items?.forEach((i) => {
              tierCounts[i.tier_id] = (tierCounts[i.tier_id] || 0) + 1;
            });
            for (const [tierId, count] of Object.entries(tierCounts)) {
              await supabaseAdmin.rpc("increment_tier_sold", { tier_id: tierId, amount: -count });
            }
          }
        }
        break;
      }

      case "charge.refunded": {
        const charge = stripeEvent.data.object;
        // Find order by payment intent
        const { data: order } = await supabaseAdmin
          .from("orders")
          .select("id")
          .eq("stripe_payment_intent_id", charge.payment_intent)
          .single();

        if (order) {
          await supabaseAdmin
            .from("orders")
            .update({ status: "refunded", refunded_at: new Date().toISOString() })
            .eq("id", order.id);
        }
        break;
      }

      default:
        console.log(`Unhandled webhook event: ${stripeEvent.type}`);
    }

    res.json({ received: true });
  } catch (err) {
    console.error("Webhook processing error:", err);
    res.status(500).json({ error: "Webhook processing failed" });
  }
});

module.exports = router;
