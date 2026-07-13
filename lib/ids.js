import { pool } from "./db";

// IDs are plain text like "RC-0001". Pull the numeric tail (regardless of
// current padding) and increment it, rather than relying on lexical MAX().
export async function nextId(table, column, prefix, padLength = 4) {
  const { rows } = await pool.query(
    `SELECT COALESCE(MAX((regexp_match(${column}, '(\\d+)$'))[1]::int), 0) + 1 AS next FROM ${table}`
  );
  const n = rows[0].next;
  return `${prefix}${String(n).padStart(padLength, "0")}`;
}
