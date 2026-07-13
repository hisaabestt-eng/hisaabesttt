import { pool } from "./db";
import { nextId } from "./ids";

// Same status chain as the Main page, plus "Estimate Pending" — Records
// shows every record, including ones that don't have an estimate yet.
const RECORDS_STATUS_CTE = `
  WITH base AS (
    SELECT
      r.record_id, r.record_date, r.description, r.amount, r.comp_id, r.is_archived,
      cl.client_id, cl.client_name,
      e.est_id,
      po.po_id,
      CASE
        WHEN e.est_id IS NULL THEN 'Estimate Pending'
        WHEN po.po_id IS NULL THEN 'PO Pending'
        WHEN COALESCE(inv_stats.invoice_count, 0) = 0 THEN 'Invoice Pending'
        WHEN COALESCE(inv_stats.total_allocated, 0) <= 0 THEN 'Payment Pending'
        WHEN inv_stats.total_allocated >= inv_stats.total_invoice_amount THEN 'Paid'
        ELSE 'Partial Paid'
      END AS status,
      CASE
        WHEN trim(lower(r.overall_status)) LIKE '%canc%' THEN 'Cancelled'
        WHEN r.is_archived OR trim(lower(r.overall_status)) LIKE '%archiv%' THEN 'Archived'
        ELSE 'Raised'
      END AS lifecycle
    FROM records r
    JOIN clients cl ON cl.client_id = r.client_id
    LEFT JOIN estimates e ON e.record_id = r.record_id
    LEFT JOIN purchase_orders po ON po.estimate_id = e.est_id
    LEFT JOIN LATERAL (
      SELECT
        count(*) AS invoice_count,
        sum(i.invoice_total) AS total_invoice_amount,
        sum(COALESCE(pa_sum.allocated, 0)) AS total_allocated
      FROM invoices i
      LEFT JOIN LATERAL (
        SELECT sum(allocated_amount) AS allocated
        FROM payment_allocations pa
        WHERE pa.invoice_no = i.invoice_no
      ) pa_sum ON true
      WHERE i.po_no = po.po_no
    ) inv_stats ON true
  )
`;

export async function listRecords({ compId, clientId, search }) {
  const conditions = ["comp_id = $1"];
  const params = [compId];

  if (clientId) {
    params.push(clientId);
    conditions.push(`client_id = $${params.length}`);
  }

  const words = search ? search.trim().split(/\s+/).filter(Boolean) : [];
  for (const word of words) {
    params.push(`%${word}%`);
    const p = `$${params.length}`;
    conditions.push(
      `(description ILIKE ${p} OR client_name ILIKE ${p} OR status ILIKE ${p} OR lifecycle ILIKE ${p})`
    );
  }

  const { rows } = await pool.query(
    `
    ${RECORDS_STATUS_CTE}
    SELECT * FROM base
    WHERE ${conditions.join(" AND ")}
    ORDER BY record_date DESC, record_id DESC
    `,
    params
  );
  return rows;
}

export async function getRecordsWithoutEstimate(compId, clientId) {
  const params = [compId];
  let clientFilter = "";
  if (clientId) {
    params.push(clientId);
    clientFilter = `AND r.client_id = $${params.length}`;
  }
  const { rows } = await pool.query(
    `
    SELECT r.record_id, r.record_date, r.description, r.amount, cl.client_name
    FROM records r
    JOIN clients cl ON cl.client_id = r.client_id
    WHERE r.comp_id = $1
      AND NOT EXISTS (SELECT 1 FROM estimates e WHERE e.record_id = r.record_id)
      ${clientFilter}
    ORDER BY r.record_date DESC
    `,
    params
  );
  return rows;
}

// Only show clients that already have a record under this company, plus
// brand-new clients with no records anywhere yet — a company's picker
// shouldn't be flooded with every other company's clients. To reuse the
// same client name under a different company, add it again via "+ New".
export async function getClientsForCompanyPicker(compId) {
  const { rows } = await pool.query(
    `
    SELECT cl.client_id, cl.client_name
    FROM clients cl
    WHERE cl.status = 'Active'
      AND (
        EXISTS (SELECT 1 FROM records r WHERE r.client_id = cl.client_id AND r.comp_id = $1)
        OR NOT EXISTS (SELECT 1 FROM records r WHERE r.client_id = cl.client_id)
      )
    ORDER BY cl.client_name
    `,
    [compId]
  );
  return rows;
}

export async function createClient(clientName, compId) {
  const clientId = await nextId("clients", "client_id", "CL-");
  await pool.query(
    `INSERT INTO clients (client_id, comp_id, client_name, status, created_at, updated_at)
     VALUES ($1, $2, $3, 'Active', now(), now())`,
    [clientId, compId, clientName]
  );
  return clientId;
}

export async function createRecord({ compId, clientId, recordDate, description, amount }) {
  const recordId = await nextId("records", "record_id", "RC-");
  await pool.query(
    `INSERT INTO records (record_id, record_date, comp_id, client_id, description, amount, overall_status, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, 'Raised', now(), now())`,
    [recordId, recordDate, compId, clientId, description, amount]
  );
  return recordId;
}

// Once a Purchase Order exists downstream, the amount is locked — it now
// flows from Estimate -> Record instead of being edited here directly.
// While only an Estimate exists (no PO yet), the amount stays two-way synced.
export async function updateRecord(recordId, { recordDate, description, amount }) {
  const { rows } = await pool.query(
    `SELECT e.est_id, po.po_id
     FROM records r
     LEFT JOIN estimates e ON e.record_id = r.record_id
     LEFT JOIN purchase_orders po ON po.estimate_id = e.est_id
     WHERE r.record_id = $1`,
    [recordId]
  );
  const estId = rows[0]?.est_id;
  const hasPO = Boolean(rows[0]?.po_id);

  if (hasPO) {
    await pool.query(
      `UPDATE records SET record_date = $1, description = $2, updated_at = now() WHERE record_id = $3`,
      [recordDate, description, recordId]
    );
  } else {
    await pool.query(
      `UPDATE records SET record_date = $1, description = $2, amount = $3, updated_at = now()
       WHERE record_id = $4`,
      [recordDate, description, amount, recordId]
    );
    if (estId) {
      await pool.query("UPDATE estimates SET amount = $1, updated_at = now() WHERE est_id = $2", [
        amount,
        estId,
      ]);
    }
  }
}

export async function deleteRecord(recordId) {
  const { rows } = await pool.query("SELECT 1 FROM estimates WHERE record_id = $1", [recordId]);
  if (rows.length > 0) {
    throw new Error("This record already has an estimate — remove that first.");
  }
  await pool.query("DELETE FROM records WHERE record_id = $1", [recordId]);
}

// Only the most-downstream stage can be archived — if an estimate already
// exists, archive that instead of the record underneath it.
export async function setRecordArchived(recordId, archived) {
  if (archived) {
    const { rows } = await pool.query("SELECT 1 FROM estimates WHERE record_id = $1", [recordId]);
    if (rows.length > 0) {
      throw new Error("This record has an estimate — archive the estimate instead.");
    }
  }
  await pool.query("UPDATE records SET is_archived = $1, updated_at = now() WHERE record_id = $2", [
    archived,
    recordId,
  ]);
}
