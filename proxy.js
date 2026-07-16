import { NextResponse } from "next/server";
import { resolveSession, SESSION_MAX_AGE_SECONDS } from "@/lib/session";
import { getPermissions } from "@/lib/permissions";

// Every entity's mutating routes live under one of these prefixes and follow
// the same shape: bare path (or /bulk) + POST = create, [id] + PUT = update,
// [id] + DELETE = delete, any other sub-path (archive/cancel/reject/progress/
// document/allocate/...) = some other edit to an existing row. Classifying by
// shape here means new sub-routes are covered automatically, instead of
// needing a permission check added to every individual route file.
const ENTITY_PREFIXES = [
  "/api/records-admin",
  "/api/estimates-admin",
  "/api/po-admin",
  "/api/invoices-admin",
  "/api/payments-admin",
];

// These configure the app itself (companies/clients/status labels/who's
// allowed to do what) rather than day-to-day records, so they're admin-only
// regardless of method — a "user" role has no business even reading them.
const ADMIN_ONLY_PREFIXES = [
  "/api/companies-admin",
  "/api/clients-admin",
  "/api/status-labels-admin",
  "/api/permissions-admin",
  "/api/users-admin",
];

// Returns null when no permission check applies (GET requests, or paths
// outside the entity families above), otherwise "add" | "edit" | "delete".
function classifyAction(pathname, method) {
  if (pathname === "/api/bulk-chain") return method === "GET" ? null : "add";

  for (const prefix of ENTITY_PREFIXES) {
    if (pathname !== prefix && !pathname.startsWith(`${prefix}/`)) continue;
    if (method === "GET") return null;
    const rest = pathname.slice(prefix.length);
    if (rest === "" ) return "add";
    if (rest === "/bulk") return "add";
    if (method === "DELETE") return "delete";
    return "edit";
  }

  return null;
}

function unauthorized(pathname, request) {
  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.redirect(new URL("/login", request.url));
}

function forbidden(pathname, request, message) {
  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: message }, { status: 403 });
  }
  return NextResponse.redirect(new URL("/", request.url));
}

// Re-stamps the session cookie with a fresh 10-minute expiry on every
// authenticated request (whether it ultimately succeeds or gets a 403), so
// active use keeps sliding the window forward — only genuine inactivity lets
// it expire and forces a fresh login.
function refreshSession(response, token) {
  response.cookies.set("session", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
  return response;
}

export async function proxy(request) {
  const { pathname } = request.nextUrl;

  if (pathname === "/login" || pathname === "/api/login") {
    return NextResponse.next();
  }

  const token = request.cookies.get("session")?.value;
  const session = await resolveSession(token);
  if (!session) {
    return unauthorized(pathname, request);
  }

  const isAdminOnlyPath =
    pathname === "/settings" || ADMIN_ONLY_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  if (isAdminOnlyPath && session.role !== "admin") {
    return refreshSession(forbidden(pathname, request, "Admin access required"), token);
  }

  const action = classifyAction(pathname, request.method);
  if (action && session.role !== "admin") {
    const permissions = await getPermissions();
    const allowed =
      (action === "add" && permissions.can_add) ||
      (action === "edit" && permissions.can_edit) ||
      (action === "delete" && permissions.can_delete);
    if (!allowed) {
      return refreshSession(forbidden(pathname, request, `You don't have permission to ${action} this.`), token);
    }
  }

  return refreshSession(NextResponse.next(), token);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
