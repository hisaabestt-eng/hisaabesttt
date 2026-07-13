import { Pool } from "pg";

// Reuse the same connection pool across requests instead of opening a
// new one every time (Next.js reloads this file often in dev).
const globalForDb = globalThis;

export const pool =
  globalForDb.pgPool ??
  new Pool({
    connectionString: process.env.DATABASE_URL,
  });

if (process.env.NODE_ENV !== "production") {
  globalForDb.pgPool = pool;
}
