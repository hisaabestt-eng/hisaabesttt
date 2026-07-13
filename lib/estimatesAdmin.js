import { pool } from "./db";
import { nextId } from "./ids";
import { toDateString } from "./dates";

export async function listEstimates({ compId, clientId, search }) {
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
      `(description ILIKE ${p} OR client_name ILIKE ${p} OR est_no ILIKE ${p} OR tags ILIKE ${p} OR status ILIKE ${p} OR lifecycle ILIKE ${p})`
    );
  }

  const { rows } = await pool.query(
    `
    WITH base AS (
      SELECT
        e.est_id, e.est_no, e.estimate_date, e.description, e.amount, e.tags, e.is_archived,
        r.record_id, r.comp_id,
        cl.client_id, cl.client_name,
        po.po_id,
        d.doc_id, d.file_name, d.document_type, d.external_url,
        CASE
          WHEN po.po_id IS NULL THEN 'PO Pending'
          WHEN COALESCE(inv_stats.invoice_count, 0) = 0 THEN 'Invoice Pending'
          WHEN COALESCE(inv_stats.total_allocated, 0) <= 0 THEN 'Payment Pending'
          WHEN inv_stats.total_allocated >= inv_stats.total_invoice_amount THEN 'Paid'
          ELSE 'Partial Paid'
        END AS status,
        CASE
          WHEN trim(lower(e.status)) LIKE '%canc%' THEN 'Cancelled'
          WHEN e.is_archived OR trim(lower(e.status)) LIKE '%archiv%' THEN 'Archived'
          ELSE 'Raised'
        END AS lifecycle
      FROM estimates e
      JOIN records r ON r.record_id = e.record_id
      JOIN clients cl ON cl.client_id = r.client_id
      LEFT JOIN purchase_orders po ON po.estimate_id = e.est_id
      LEFT JOIN documents d ON d.module_id = e.est_id
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
    ORDER BY estimate_date DESC, est_id DESC
    `,
    params
  );
  return rows;
}

function monthYearTag(dateStr) {
  const d = new Date(dateStr);
  const month = d.toLocaleDateString("en-US", { month: "long", timeZone: "UTC" });
  const year = d.getUTCFullYear();
  return `[${month},${year}]`;
}

// The Estimate's amount is the source of truth once it exists — keep the
// parent Record's amount mirrored to it.
async function syncRecordAmount(recordId, amount) {
  await pool.query("UPDATE records SET amount = $1, updated_at = now() WHERE record_id = $2", [
    amount,
    recordId,
  ]);
}

export async function createEstimate({ recordId, estNo, estDate, description, amount }) {
  const { rows } = await pool.query("SELECT record_date FROM records WHERE record_id = $1", [
    recordId,
  ]);
  if (!rows[0]) throw new Error("Record not found");
  const recordDate = toDateString(rows[0].record_date);
  if (estDate < recordDate) {
    throw new Error(`Estimate date can't be before the record date (${recordDate}).`);
  }

  const estId = await nextId("estimates", "est_id", "EST-");
  await pool.query(
    `INSERT INTO estimates (est_id, record_id, est_no, estimate_date, description, amount, status, tags, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, 'Draft', $7, now(), now())`,
    [estId, recordId, estNo, estDate, description, amount, monthYearTag(estDate)]
  );
  await syncRecordAmount(recordId, amount);
  return estId;
}

// Once a PO exists downstream, the amount is locked here too — it flows
// from PO -> Estimate -> Record instead of being edited on the Estimate.
export async function updateEstimate(estId, { estNo, estDate, description, amount }) {
  const { rows } = await pool.query(
    `SELECT e.record_id, r.record_date, po.po_id
     FROM estimates e
     JOIN records r ON r.record_id = e.record_id
     LEFT JOIN purchase_orders po ON po.estimate_id = e.est_id
     WHERE e.est_id = $1`,
    [estId]
  );
  if (!rows[0]) throw new Error("Estimate not found");
  const recordDate = toDateString(rows[0].record_date);
  if (estDate < recordDate) {
    throw new Error(`Estimate date can't be before the record date (${recordDate}).`);
  }
  const hasPO = Boolean(rows[0].po_id);

  if (hasPO) {
    await pool.query(
      `UPDATE estimates SET est_no = $1, estimate_date = $2, description = $3, updated_at = now()
       WHERE est_id = $4`,
      [estNo, estDate, description, estId]
    );
  } else {
    await pool.query(
      `UPDATE estimates SET est_no = $1, estimate_date = $2, description = $3, amount = $4, updated_at = now()
       WHERE est_id = $5`,
      [estNo, estDate, description, amount, estId]
    );
    await syncRecordAmount(rows[0].record_id, amount);
  }
}

export async function deleteEstimate(estId) {
  const { rows } = await pool.query("SELECT 1 FROM purchase_orders WHERE estimate_id = $1", [estId]);
  if (rows.length > 0) {
    throw new Error("This estimate already has a Purchase Order — remove that first.");
  }
  await pool.query("DELETE FROM documents WHERE module_id = $1", [estId]);
  await pool.query("DELETE FROM estimates WHERE est_id = $1", [estId]);
}

// Only the most-downstream stage can be archived — if a PO already exists,
// archive that instead of the estimate underneath it.
export async function setEstimateArchived(estId, archived) {
  if (archived) {
    const { rows } = await pool.query("SELECT 1 FROM purchase_orders WHERE estimate_id = $1", [
      estId,
    ]);
    if (rows.length > 0) {
      throw new Error("This estimate has a Purchase Order — archive the PO instead.");
    }
  }
  await pool.query("UPDATE estimates SET is_archived = $1, updated_at = now() WHERE est_id = $2", [
    archived,
    estId,
  ]);
}
