const express = require("express");
const router = express.Router();
const { supabase, supabaseAdmin } = require("../config/supabase");
const { authenticate } = require("../middleware/auth");
const { validate, registerSchema, loginSchema, phoneOtpSchema } = require("../middleware/validate");
const { sendRegistrationOtpEmail } = require("../services/email.service");

// OTP lives in the database — survives server restarts
function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// ─── Send registration OTP ───
router.post("/send-register-otp", async (req, res) => {
  const email = (req.body.email || "").toLowerCase().trim();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: "A valid email address is required" });
  }

  try {
    // Check if email is already registered
    const { data: existing } = await supabaseAdmin
      .from("users")
      .select("id")
      .eq("email", email)
      .maybeSingle();

    if (existing) {
      return res.status(409).json({ error: "Email already registered" });
    }

    // Rate-limit: block re-send within 60 seconds of the last send
    const { data: prev } = await supabaseAdmin
      .from("registration_otps")
      .select("created_at")
      .eq("email", email)
      .maybeSingle();

    if (prev) {
      const secondsAgo = (Date.now() - new Date(prev.created_at).getTime()) / 1000;
      if (secondsAgo < 60) {
        return res.status(429).json({ error: "Please wait 60 seconds before requesting another code" });
      }
    }

    const otp = generateOTP();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 min

    // Upsert into DB — overwrites any previous OTP for this email
    const { error: upsertErr } = await supabaseAdmin
      .from("registration_otps")
      .upsert({ email, code: otp, expires_at: expiresAt, attempts: 0 }, { onConflict: "email" });

    if (upsertErr) throw upsertErr;

    await sendRegistrationOtpEmail({ email, otp });

    res.json({ message: "Verification code sent to your email" });
  } catch (err) {
    console.error("Send register OTP error:", err);
    res.status(500).json({ error: "Failed to send verification code" });
  }
});

// ─── Register with email/password ───
router.post("/register", validate(registerSchema), async (req, res) => {
  const { email, password, full_name, phone, otp_code } = req.validated;
  const normalizedEmail = email.toLowerCase().trim();

  // Validate OTP from database
  const { data: otpRecord } = await supabaseAdmin
    .from("registration_otps")
    .select("*")
    .eq("email", normalizedEmail)
    .maybeSingle();

  if (!otpRecord) {
    return res.status(400).json({ error: "No verification code found — please request a new one" });
  }
  if (new Date(otpRecord.expires_at) < new Date()) {
    await supabaseAdmin.from("registration_otps").delete().eq("email", normalizedEmail);
    return res.status(400).json({ error: "Verification code has expired — please request a new one" });
  }
  if (otpRecord.attempts >= 5) {
    await supabaseAdmin.from("registration_otps").delete().eq("email", normalizedEmail);
    return res.status(400).json({ error: "Too many incorrect attempts — please request a new code" });
  }
  if (otpRecord.code !== otp_code) {
    await supabaseAdmin.from("registration_otps").update({ attempts: otpRecord.attempts + 1 }).eq("email", normalizedEmail);
    return res.status(400).json({ error: "Incorrect verification code" });
  }

  // OTP valid — consume it
  await supabaseAdmin.from("registration_otps").delete().eq("email", normalizedEmail);

  try {
    // Create auth user in Supabase
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name },
    });

    if (authError) {
      if (authError.message.includes("already")) {
        return res.status(409).json({ error: "Email already registered" });
      }
      throw authError;
    }

    // Create user profile in our users table
    const { data: profile, error: profileError } = await supabaseAdmin
      .from("users")
      .insert({
        id: authData.user.id,
        email,
        full_name,
        phone: phone || null,
        auth_provider: "email",
      })
      .select()
      .single();

    if (profileError) throw profileError;

    // Sign in to get session tokens
    const { data: session, error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError) throw signInError;

    // Audit log
    await supabaseAdmin.from("audit_log").insert({
      user_id: profile.id,
      action: "user.registered",
      entity_type: "user",
      entity_id: profile.id,
      metadata: { provider: "email" },
    });

    res.status(201).json({
      user: profile,
      session: {
        access_token: session.session.access_token,
        refresh_token: session.session.refresh_token,
        expires_at: session.session.expires_at,
      },
    });
  } catch (err) {
    console.error("Register error:", err);
    res.status(500).json({ error: "Registration failed" });
  }
});

// ─── Login with email/password ───
router.post("/login", validate(loginSchema), async (req, res) => {
  const { email, password } = req.validated;

  try {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const { data: profile } = await supabaseAdmin
      .from("users")
      .select("*")
      .eq("id", data.user.id)
      .single();

    res.json({
      user: profile,
      session: {
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        expires_at: data.session.expires_at,
      },
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Login failed" });
  }
});

// ─── Google OAuth - finalize session (called after frontend PKCE exchange) ───
// The browser already exchanged the code via supabase.auth.exchangeCodeForSession().
// This endpoint receives the resulting access_token, verifies it, and
// upserts the user's profile row in our users table.
router.post("/google/session", async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "No token provided" });
  }
  const token = authHeader.slice(7);

  try {
    const { data: { user: authUser }, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !authUser) return res.status(401).json({ error: "Invalid token" });

    const { data: profile, error: profileError } = await supabaseAdmin
      .from("users")
      .upsert(
        {
          id: authUser.id,
          email: authUser.email,
          full_name: authUser.user_metadata?.full_name || authUser.email.split("@")[0],
          avatar_url: authUser.user_metadata?.avatar_url || null,
          auth_provider: "google",
          google_id: authUser.user_metadata?.sub || authUser.user_metadata?.provider_id || null,
          email_verified: true,
        },
        { onConflict: "id" }
      )
      .select()
      .single();

    if (profileError) throw profileError;

    await supabaseAdmin.from("audit_log").insert({
      user_id: profile.id,
      action: "user.google_login",
      entity_type: "user",
      entity_id: profile.id,
      metadata: { provider: "google" },
    });

    res.json({ user: profile });
  } catch (err) {
    console.error("Google session error:", err);
    res.status(500).json({ error: "Authentication failed" });
  }
});

// ─── Google OAuth - initiate (legacy - kept for reference) ───
router.post("/google", async (req, res) => {
  try {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${process.env.FRONTEND_URL}/auth/callback`,
      },
    });
    if (error) throw error;
    res.json({ url: data.url });
  } catch (err) {
    console.error("Google OAuth error:", err);
    res.status(500).json({ error: "Google sign-in failed" });
  }
});

// ─── Google OAuth - callback (exchange code for session) ───
router.post("/google/callback", async (req, res) => {
  const { code } = req.body;

  try {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) throw error;

    // Upsert user profile
    const user = data.user;
    const { data: profile } = await supabaseAdmin
      .from("users")
      .upsert(
        {
          id: user.id,
          email: user.email,
          full_name: user.user_metadata?.full_name || user.email.split("@")[0],
          avatar_url: user.user_metadata?.avatar_url,
          auth_provider: "google",
          google_id: user.user_metadata?.provider_id,
          email_verified: true,
        },
        { onConflict: "id" }
      )
      .select()
      .single();

    res.json({
      user: profile,
      session: {
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        expires_at: data.session.expires_at,
      },
    });
  } catch (err) {
    console.error("Google callback error:", err);
    res.status(500).json({ error: "Google authentication failed" });
  }
});

// ─── Phone OTP - send ───
router.post("/phone/otp", validate(phoneOtpSchema), async (req, res) => {
  const { phone } = req.validated;

  try {
    const { error } = await supabase.auth.signInWithOtp({ phone });
    if (error) throw error;
    res.json({ message: "OTP sent successfully" });
  } catch (err) {
    console.error("OTP error:", err);
    res.status(500).json({ error: "Failed to send OTP" });
  }
});

// ─── Phone OTP - verify ───
router.post("/phone/verify", async (req, res) => {
  const { phone, otp_code } = req.body;

  try {
    const { data, error } = await supabase.auth.verifyOtp({
      phone,
      token: otp_code,
      type: "sms",
    });
    if (error) throw error;

    // Upsert user profile
    const { data: profile } = await supabaseAdmin
      .from("users")
      .upsert(
        {
          id: data.user.id,
          email: data.user.email || `${phone}@phone.funasia.events`,
          phone,
          full_name: data.user.user_metadata?.full_name || "User",
          auth_provider: "phone",
          phone_verified: true,
        },
        { onConflict: "id" }
      )
      .select()
      .single();

    res.json({
      user: profile,
      session: {
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        expires_at: data.session.expires_at,
      },
    });
  } catch (err) {
    console.error("OTP verify error:", err);
    res.status(500).json({ error: "OTP verification failed" });
  }
});

// ─── Get current user profile ───
router.get("/me", authenticate, async (req, res) => {
  res.json({ user: req.user });
});

// ─── Update profile ───
router.patch("/me", authenticate, async (req, res) => {
  const { full_name, phone, default_city, default_state, default_lat, default_lng } = req.body;

  try {
    const { data, error } = await supabaseAdmin
      .from("users")
      .update({
        ...(full_name && { full_name }),
        ...(phone && { phone }),
        ...(default_city && { default_city }),
        ...(default_state && { default_state }),
        ...(default_lat && { default_lat }),
        ...(default_lng && { default_lng }),
      })
      .eq("id", req.user.id)
      .select()
      .single();

    if (error) throw error;
    res.json({ user: data });
  } catch (err) {
    console.error("Profile update error:", err);
    res.status(500).json({ error: "Failed to update profile" });
  }
});

// ─── Refresh token ───
router.post("/refresh", async (req, res) => {
  const { refresh_token } = req.body;
  try {
    const { data, error } = await supabase.auth.refreshSession({ refresh_token });
    if (error) throw error;
    res.json({
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
      expires_at: data.session.expires_at,
    });
  } catch (err) {
    res.status(401).json({ error: "Token refresh failed" });
  }
});

// ─── Logout ───
router.post("/logout", authenticate, async (req, res) => {
  try {
    await supabase.auth.signOut();
    res.json({ message: "Logged out successfully" });
  } catch (err) {
    res.status(500).json({ error: "Logout failed" });
  }
});

module.exports = router;
