import { NextResponse } from "next/server";
import { resolveSession, signSession } from "@/lib/session";
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
  if (pathname === "/api/master-table/bulk-delete") return method === "GET" ? null : "delete";

  // These two don't follow the "-admin" naming convention (they predate it),
  // but they mutate data the same way and are reachable by the "user" role,
  // so they need the same permission gate as everything else.
  if (pathname === "/api/clients") return method === "GET" ? null : "add";
  if (pathname.startsWith("/api/estimates/") && pathname.endsWith("/tags")) {
    return method === "GET" ? null : "edit";
  }

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

// Re-signs the session with a fresh issued-at time on every authenticated
// request (whether it ultimately succeeds or gets a 403), so active use
// keeps sliding the 10-minute inactivity window forward. The cookie itself
// has no maxAge — it's a true browser session cookie, gone the moment the
// browser closes, regardless of how recently it was refreshed.
function refreshSession(response, userId) {
  response.cookies.set("session", signSession(userId), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
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
    return refreshSession(forbidden(pathname, request, "Admin access required"), session.userId);
  }

  const action = classifyAction(pathname, request.method);
  if (action && session.role !== "admin") {
    const permissions = await getPermissions();
    const allowed =
      (action === "add" && permissions.can_add) ||
      (action === "edit" && permissions.can_edit) ||
      (action === "delete" && permissions.can_delete);
    if (!allowed) {
      return refreshSession(
        forbidden(pathname, request, `You don't have permission to ${action} this.`),
        session.userId
      );
    }
  }

  return refreshSession(NextResponse.next(), session.userId);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
