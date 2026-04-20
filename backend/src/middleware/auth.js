const { supabaseAdmin } = require("../config/supabase");

/**
 * Authenticate user via Supabase JWT from Authorization header
 */
async function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing authorization token" });
  }

  const token = authHeader.split(" ")[1];

  try {
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !user) {
      return res.status(401).json({ error: "Invalid or expired token" });
    }

    // Fetch full user profile from our users table
    const { data: profile } = await supabaseAdmin
      .from("users")
      .select("*")
      .eq("id", user.id)
      .single();

    req.user = profile || { id: user.id, email: user.email, role: "user" };
    req.token = token;
    next();
  } catch (err) {
    console.error("Auth error:", err);
    res.status(401).json({ error: "Authentication failed" });
  }
}

/**
 * Require specific role(s)
 */
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: "Insufficient permissions" });
    }
    next();
  };
}

/**
 * Optional auth — sets req.user if token present, continues otherwise
 */
async function optionalAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) return next();

  try {
    const token = authHeader.split(" ")[1];
    const { data: { user } } = await supabaseAdmin.auth.getUser(token);
    if (user) {
      const { data: profile } = await supabaseAdmin
        .from("users")
        .select("*")
        .eq("id", user.id)
        .single();
      req.user = profile || { id: user.id, email: user.email, role: "user" };
    }
  } catch (_) { /* continue without auth */ }
  next();
}

module.exports = { authenticate, requireRole, optionalAuth };
