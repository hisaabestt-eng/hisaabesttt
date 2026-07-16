import { pool } from "./db";
import { nextId } from "./ids";

export async function getAllCompanies() {
  const { rows } = await pool.query(
    `SELECT comp_id, company_name, status, email, gst_no, address, is_default, default_client_id
     FROM companies
     ORDER BY (status = 'Active') DESC, company_name`
  );
  return rows;
}

export async function createCompany({ companyName }) {
  const compId = await nextId("companies", "comp_id", "COMP-");
  await pool.query(
    `INSERT INTO companies (comp_id, company_name, status, created_at, updated_at)
     VALUES ($1, $2, 'Active', now(), now())`,
    [compId, companyName]
  );
  return compId;
}

export async function setCompanyStatus(compId, status) {
  await pool.query("UPDATE companies SET status = $1, updated_at = now() WHERE comp_id = $2", [
    status,
    compId,
  ]);
}

export async function updateCompany(compId, companyName) {
  await pool.query("UPDATE companies SET company_name = $1, updated_at = now() WHERE comp_id = $2", [
    companyName,
    compId,
  ]);
}

// Only one company can be "the" default at a time, so clearing every other
// row first (rather than a DB constraint) keeps this a plain two-statement
// update, matching how the rest of this app enforces single-row invariants.
export async function setDefaultCompany(compId) {
  await pool.query("UPDATE companies SET is_default = false WHERE comp_id != $1", [compId]);
  await pool.query("UPDATE companies SET is_default = true WHERE comp_id = $1", [compId]);
}

// clientId is nullable — clearing it just means "fall back to the first
// client for this company" again, same as before this feature existed.
export async function setDefaultClientForCompany(compId, clientId) {
  await pool.query("UPDATE companies SET default_client_id = $1 WHERE comp_id = $2", [
    clientId || null,
    compId,
  ]);
}

export async function updateClient(clientId, clientName) {
  await pool.query("UPDATE clients SET client_name = $1, updated_at = now() WHERE client_id = $2", [
    clientName,
    clientId,
  ]);
}

export async function getAllClientsForSettings({ compId, search }) {
  const conditions = [];
  const params = [];

  if (compId) {
    params.push(compId);
    conditions.push(`cl.comp_id = $${params.length}`);
  }

  if (search && search.trim()) {
    params.push(`%${search.trim()}%`);
    conditions.push(`cl.client_name ILIKE $${params.length}`);
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  const { rows } = await pool.query(
    `SELECT cl.client_id, cl.client_name, cl.status
     FROM clients cl
     ${whereClause}
     ORDER BY (cl.status = 'Active') DESC, cl.client_name`,
    params
  );
  return rows;
}

export async function setClientStatus(clientId, status) {
  await pool.query("UPDATE clients SET status = $1, updated_at = now() WHERE client_id = $2", [
    status,
    clientId,
  ]);
}

// Custom status labels are pure cosmetic tags, managed per entity type
// ('record' | 'estimate' | 'po' | 'invoice') — they live in their own table
// and a separate `custom_status` column on each entity (see lib/status.js's
// lifecycleDisplay), so none of the existing Raised/Archived/Cancelled
// lifecycle logic anywhere else in the app needs to change.
const ENTITY_TABLES = {
  record: "records",
  estimate: "estimates",
  po: "purchase_orders",
  invoice: "invoices",
};

export async function getStatusLabels(entityType) {
  const { rows } = await pool.query(
    "SELECT label_id, entity_type, label_name FROM status_labels WHERE entity_type = $1 ORDER BY label_name",
    [entityType]
  );
  return rows;
}

export async function createStatusLabel(entityType, labelName) {
  if (!ENTITY_TABLES[entityType]) throw new Error("Unknown entity type");
  const labelId = await nextId("status_labels", "label_id", "LBL-");
  await pool.query(
    "INSERT INTO status_labels (label_id, entity_type, label_name, created_at) VALUES ($1, $2, $3, now())",
    [labelId, entityType, labelName]
  );
  return labelId;
}

export async function deleteStatusLabel(labelId) {
  const { rows } = await pool.query(
    "SELECT entity_type, label_name FROM status_labels WHERE label_id = $1",
    [labelId]
  );
  if (!rows[0]) throw new Error("Status label not found");
  const table = ENTITY_TABLES[rows[0].entity_type];

  const { rows: inUse } = await pool.query(
    `SELECT 1 FROM ${table} WHERE custom_status = $1 LIMIT 1`,
    [rows[0].label_name]
  );
  if (inUse.length > 0) {
    throw new Error(`This label is currently in use — change those rows off it first.`);
  }

  await pool.query("DELETE FROM status_labels WHERE label_id = $1", [labelId]);
}
