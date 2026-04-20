// All times in this app are stored as UTC in the database.
// Display and input are standardized to America/Chicago (CT — CST/CDT).

export const APP_TZ = "America/Chicago";

// ─── Display helpers ───────────────────────────────────────────────
// Format a UTC timestamp as a date string in Central Time.
export function fmtDate(utcStr, opts = {}) {
  if (!utcStr) return "";
  return new Date(utcStr).toLocaleDateString("en-US", { timeZone: APP_TZ, ...opts });
}

// Format a UTC timestamp as a time string in Central Time.
export function fmtTime(utcStr, opts = {}) {
  if (!utcStr) return "";
  return new Date(utcStr).toLocaleTimeString("en-US", { timeZone: APP_TZ, ...opts });
}

// Format a UTC timestamp as a date+time string in Central Time.
export function fmtDateTime(utcStr, opts = {}) {
  if (!utcStr) return "";
  return new Date(utcStr).toLocaleString("en-US", { timeZone: APP_TZ, ...opts });
}

// ─── Form input helpers ────────────────────────────────────────────
// Convert a UTC ISO string to a "YYYY-MM-DDTHH:mm" string in Central Time.
// Use this when populating a <input type="datetime-local"> from a server value.
export function utcToCentralInput(utcStr) {
  if (!utcStr) return "";
  // "sv" locale produces "YYYY-MM-DD HH:mm:ss" — easiest to slice
  return new Date(utcStr)
    .toLocaleString("sv", { timeZone: APP_TZ })
    .slice(0, 16)
    .replace(" ", "T");
}

// Convert a "YYYY-MM-DDTHH:mm" Central Time string to a UTC ISO string.
// Use this when reading a <input type="datetime-local"> value before sending to the server.
// DST-aware: correctly handles CST (UTC-6) and CDT (UTC-5) transitions.
export function centralInputToUtc(val) {
  if (!val) return "";
  // Treat the string as UTC to get a reference point, then measure
  // the actual CT offset at that date and correct.
  const refUtc = new Date(val + ":00.000Z");
  const centralStr = refUtc.toLocaleString("sv", { timeZone: APP_TZ }); // "YYYY-MM-DD HH:mm:ss"
  const centralObj = new Date(centralStr.replace(" ", "T") + "Z");
  const offsetMs = refUtc.getTime() - centralObj.getTime(); // positive = CT behind UTC
  return new Date(refUtc.getTime() + offsetMs).toISOString();
}
