import { pool } from "./db";
import { nextId } from "./ids";
import { toDateString } from "./dates";

export async function listPOs({ compId, clientId, search }) {
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
      `(description ILIKE ${p} OR client_name ILIKE ${p} OR po_no ILIKE ${p} OR status ILIKE ${p} OR lifecycle ILIKE ${p})`
    );
  }

  const { rows } = await pool.query(
    `
    WITH base AS (
      SELECT
        po.po_id, po.po_no, po.po_date, po.description, po.amount, po.is_archived,
        r.record_id, r.comp_id,
        cl.client_id, cl.client_name,
        inv.inv_id,
        d.doc_id, d.file_name, d.document_type, d.external_url,
        CASE
          WHEN COALESCE(inv_stats.invoice_count, 0) = 0 THEN 'Invoice Pending'
          WHEN COALESCE(inv_stats.total_allocated, 0) <= 0 THEN 'Payment Pending'
          WHEN inv_stats.total_allocated >= inv_stats.total_invoice_amount THEN 'Paid'
          ELSE 'Partial Paid'
        END AS status,
        CASE
          WHEN trim(lower(po.status)) LIKE '%canc%' THEN 'Cancelled'
          WHEN po.is_archived OR trim(lower(po.status)) LIKE '%archiv%' THEN 'Archived'
          ELSE 'Raised'
        END AS lifecycle
      FROM purchase_orders po
      JOIN estimates e ON e.est_id = po.estimate_id
      JOIN records r ON r.record_id = po.record_id
      JOIN clients cl ON cl.client_id = r.client_id
      LEFT JOIN LATERAL (
        SELECT inv_id FROM invoices i WHERE i.po_no = po.po_no ORDER BY i.inv_id LIMIT 1
      ) inv ON true
      LEFT JOIN documents d ON d.module_id = po.po_id
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
    SELECT * FROM base
    WHERE ${conditions.join(" AND ")}
    ORDER BY po_date DESC, po_id DESC
    `,
    params
  );
  return rows;
}

export async function getEstimatesWithoutPO(compId, clientId) {
  const params = [compId];
  let clientFilter = "";
  if (clientId) {
    params.push(clientId);
    clientFilter = `AND r.client_id = $${params.length}`;
  }
  const { rows } = await pool.query(
    `
    SELECT e.est_id, e.est_no, e.estimate_date, e.description, e.amount, cl.client_name
    FROM estimates e
    JOIN records r ON r.record_id = e.record_id
    JOIN clients cl ON cl.client_id = r.client_id
    WHERE r.comp_id = $1
      AND NOT EXISTS (SELECT 1 FROM purchase_orders po WHERE po.estimate_id = e.est_id)
      ${clientFilter}
    ORDER BY e.estimate_date DESC
    `,
    params
  );
  return rows;
}

// The PO's amount is the source of truth once it exists — cascade it back
// through the Estimate to the Record.
async function syncUpstreamAmount(estId, amount) {
  const { rows } = await pool.query("SELECT record_id FROM estimates WHERE est_id = $1", [estId]);
  if (!rows[0]) return;
  await pool.query("UPDATE estimates SET amount = $1, updated_at = now() WHERE est_id = $2", [
    amount,
    estId,
  ]);
  await pool.query("UPDATE records SET amount = $1, updated_at = now() WHERE record_id = $2", [
    amount,
    rows[0].record_id,
  ]);
}

export async function createPO({ estId, poNo, poDate, description, amount }) {
  const { rows } = await pool.query(
    "SELECT record_id, estimate_date FROM estimates WHERE est_id = $1",
    [estId]
  );
  if (!rows[0]) throw new Error("Estimate not found");
  const estimateDate = toDateString(rows[0].estimate_date);
  if (poDate < estimateDate) {
    throw new Error(`PO date can't be before the estimate date (${estimateDate}).`);
  }

  const { rows: existing } = await pool.query(
    "SELECT 1 FROM purchase_orders WHERE estimate_id = $1",
    [estId]
  );
  if (existing.length > 0) {
    throw new Error("This estimate already has a Purchase Order.");
  }

  const poId = await nextId("purchase_orders", "po_id", "PO-");
  await pool.query(
    `INSERT INTO purchase_orders (po_id, record_id, estimate_id, po_no, po_date, description, amount, status, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, 'Raised', now(), now())`,
    [poId, rows[0].record_id, estId, poNo, poDate, description, amount]
  );
  await syncUpstreamAmount(estId, amount);
  return poId;
}

// Once an Invoice exists downstream, the amount is locked here too — it
// flows from Invoice -> PO -> Estimate -> Record instead of being edited here.
export async function updatePO(poId, { poNo, poDate, description, amount }) {
  const { rows } = await pool.query(
    `SELECT po.estimate_id, e.estimate_date, inv.inv_id
     FROM purchase_orders po
     JOIN estimates e ON e.est_id = po.estimate_id
     LEFT JOIN invoices inv ON inv.po_no = po.po_no
     WHERE po.po_id = $1`,
    [poId]
  );
  if (!rows[0]) throw new Error("Purchase Order not found");
  const estimateDate = toDateString(rows[0].estimate_date);
  if (poDate < estimateDate) {
    throw new Error(`PO date can't be before the estimate date (${estimateDate}).`);
  }
  const hasInvoice = Boolean(rows[0].inv_id);

  if (hasInvoice) {
    await pool.query(
      `UPDATE purchase_orders SET po_no = $1, po_date = $2, description = $3, updated_at = now()
       WHERE po_id = $4`,
      [poNo, poDate, description, poId]
    );
  } else {
    await pool.query(
      `UPDATE purchase_orders SET po_no = $1, po_date = $2, description = $3, amount = $4, updated_at = now()
       WHERE po_id = $5`,
      [poNo, poDate, description, amount, poId]
    );
    await syncUpstreamAmount(rows[0].estimate_id, amount);
  }
}

export async function deletePO(poId) {
  const { rows } = await pool.query("SELECT po_no FROM purchase_orders WHERE po_id = $1", [poId]);
  if (!rows[0]) throw new Error("Purchase Order not found");
  const { rows: linked } = await pool.query("SELECT 1 FROM invoices WHERE po_no = $1", [
    rows[0].po_no,
  ]);
  if (linked.length > 0) {
    throw new Error("This Purchase Order already has an Invoice — remove that first.");
  }
  await pool.query("DELETE FROM documents WHERE module_id = $1", [poId]);
  await pool.query("DELETE FROM purchase_orders WHERE po_id = $1", [poId]);
}

// Only the most-downstream stage can be archived — if an invoice already
// exists, archive that instead of the PO underneath it.
export async function setPOArchived(poId, archived) {
  if (archived) {
    const { rows } = await pool.query("SELECT po_no FROM purchase_orders WHERE po_id = $1", [poId]);
    const { rows: linked } = rows[0]
      ? await pool.query("SELECT 1 FROM invoices WHERE po_no = $1", [rows[0].po_no])
      : { rows: [] };
    if (linked.length > 0) {
      throw new Error("This Purchase Order has an Invoice — archive the invoice instead.");
    }
  }
  await pool.query(
    "UPDATE purchase_orders SET is_archived = $1, updated_at = now() WHERE po_id = $2",
    [archived, poId]
  );
}
