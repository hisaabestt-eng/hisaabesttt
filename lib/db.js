import { Pool } from "pg";

// Reuse the same connection pool across requests instead of opening a
// new one every time (Next.js reloads this file often in dev).
const globalForDb = globalThis;

export const pool =
  globalForDb.pgPool ??
  new Pool({
    connectionString: process.env.DATABASE_URL,
  });

// Neon's pooled endpoint rejects "search_path" as a startup parameter and
// doesn't reliably apply the role/database-level default either, so every
// new physical connection sets it explicitly once it's actually connected.
pool.on("connect", (client) => {
  client.query("SET search_path TO public");
});

if (process.env.NODE_ENV !== "production") {
  globalForDb.pgPool = pool;
}
