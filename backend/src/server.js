require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");
const cron = require("node-cron");
const { supabaseAdmin } = require("./config/supabase");

const app = express();
const PORT = process.env.PORT || 4000;

// ─── Middleware ───
app.use(helmet());
app.use(cors({ origin: process.env.FRONTEND_URL, credentials: true }));
app.use(morgan("short"));

// Stripe webhooks need raw body — mount BEFORE express.json()
app.use("/api/webhooks/stripe", express.raw({ type: "application/json" }), require("./routes/webhook.routes"));

// Parse JSON for all other routes
app.use(express.json({ limit: "10mb" }));

// Rate limiting
const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 200, standardHeaders: true });
app.use("/api/", limiter);

// Stricter limit for auth endpoints
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20, standardHeaders: true });
app.use("/api/auth/", authLimiter);

// ─── Routes ───
app.use("/api/auth", require("./routes/auth.routes"));
app.use("/api/events", require("./routes/events.routes"));
app.use("/api/orders", require("./routes/orders.routes"));
app.use("/api/organizer", require("./routes/organizer.routes"));
app.use("/api/admin", require("./routes/admin.routes"));
app.use("/api/super-admin", require("./routes/superadmin.routes"));

// ─── Health Check ───
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString(), service: "funasia-api" });
});

// ─── 404 ───
app.use((req, res) => {
  res.status(404).json({ error: "Endpoint not found" });
});

// ─── Error Handler ───
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ error: "Internal server error" });
});

// ─── Cron: Release expired seat reservations every 30 seconds ───
cron.schedule("*/30 * * * * *", async () => {
  try {
    await supabaseAdmin.rpc("release_expired_reservations");
  } catch (err) {
    console.error("Reservation cleanup error:", err.message);
  }
});

// ─── Cron: Auto-complete events whose end time has passed (every 5 minutes) ───
cron.schedule("*/5 * * * *", async () => {
  try {
    const { error } = await supabaseAdmin
      .from("events")
      .update({ status: "completed" })
      .eq("status", "published")
      .lt("event_end", new Date().toISOString());
    if (error) console.error("Auto-complete events error:", error.message);
  } catch (err) {
    console.error("Auto-complete events error:", err.message);
  }
});

// ─── Start ───
app.listen(PORT, () => {
  console.log(`
  ╔══════════════════════════════════════════╗
  ║  🎪 FunAsia Events API                  ║
  ║  Running on http://localhost:${PORT}       ║
  ║  Environment: ${process.env.NODE_ENV || "development"}            ║
  ╚══════════════════════════════════════════╝
  `);
});

module.exports = app;
