import { pool } from "./db";
import { nextId } from "./ids";

export async function writeActivity({ entityType, entityId, action, description, performedBy, performedByRole }) {
  const logId = await nextId("activity_log", "log_id", "ACT-");
  await pool.query(
    `INSERT INTO activity_log (log_id, entity_type, entity_id, action, description, performed_by, performed_by_role, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, now())`,
    [logId, entityType, entityId, action, description, performedBy, performedByRole]
  );
}

export async function listActivity({ limit = 300 } = {}) {
  const { rows } = await pool.query(
    `SELECT log_id, entity_type, entity_id, action, description, performed_by, performed_by_role, created_at
     FROM activity_log ORDER BY created_at DESC LIMIT $1`,
    [limit]
  );
  return rows;
}
