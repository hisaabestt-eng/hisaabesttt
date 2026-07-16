import { pool } from "./db";

// Single-row config table — what the "user" role (as opposed to "admin") is
// allowed to do. Admin always has full access regardless of these flags.
export async function getPermissions() {
  const { rows } = await pool.query(
    "SELECT can_add, can_edit, can_delete FROM app_permissions WHERE id = 1"
  );
  return rows[0] || { can_add: true, can_edit: true, can_delete: false };
}

export async function updatePermissions({ canAdd, canEdit, canDelete }) {
  await pool.query(
    "UPDATE app_permissions SET can_add = $1, can_edit = $2, can_delete = $3, updated_at = now() WHERE id = 1",
    [canAdd, canEdit, canDelete]
  );
}
