import { pool } from "./db";

// IDs are plain text like "RC-0001". Pull the numeric tail (regardless of
// current padding) and increment it, rather than relying on lexical MAX().
// Pass a transaction client (from pool.connect()) as `runner` when this needs
// to see rows inserted earlier in the same not-yet-committed transaction —
// otherwise a second call in the same batch would compute the same "next" ID
// twice and collide.
export async function nextId(table, column, prefix, padLength = 4, runner = pool) {
  const { rows } = await runner.query(
    `SELECT COALESCE(MAX((regexp_match(${column}, '(\\d+)$'))[1]::int), 0) + 1 AS next FROM ${table}`
  );
  const n = rows[0].next;
  return `${prefix}${String(n).padStart(padLength, "0")}`;
}
