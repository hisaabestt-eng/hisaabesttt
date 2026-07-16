import crypto from "crypto";
import { cookies } from "next/headers";
import { pool } from "./db";

// The cookie only carries a signed userId — name/role/active-status are
// looked up fresh from the DB on every request. This means deactivating a
// user or changing their role takes effect immediately, instead of waiting
// for their existing cookie to expire or for them to log in again.
//
// The cookie's expiry is a sliding 10-minute window rather than a long-lived
// "remember me": proxy.js re-sets it with a fresh maxAge on every
// authenticated request, so it keeps extending while the user is active but
// expires (forcing a fresh login) after ~10 minutes of no requests at all.
export const SESSION_MAX_AGE_SECONDS = 60 * 10;

function sign(payload) {
  return crypto.createHmac("sha256", process.env.SESSION_SECRET).update(payload).digest("hex");
}

export function signSession(userId) {
  const payload = Buffer.from(JSON.stringify({ userId })).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

function decodeToken(token) {
  if (!token) return null;
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;

  try {
    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(sign(payload)))) {
      return null;
    }
  } catch {
    return null;
  }

  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    return data?.userId ? data : null;
  } catch {
    return null;
  }
}

export async function resolveSession(token) {
  const decoded = decodeToken(token);
  if (!decoded) return null;

  const { rows } = await pool.query(
    "SELECT user_id, name, role, is_active FROM users WHERE user_id = $1",
    [decoded.userId]
  );
  const user = rows[0];
  if (!user || !user.is_active) return null;
  return { userId: user.user_id, name: user.name, role: user.role };
}

// For Server Components / Route Handlers (proxy.js already gated the
// request, so this is just for reading who's logged in — activity log
// attribution, hiding a button, etc.).
export async function getServerSession() {
  const store = await cookies();
  return resolveSession(store.get("session")?.value);
}
