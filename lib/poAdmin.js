import { pool } from "./db";
import { nextId } from "./ids";
import { toDateString } from "./dates";

export async function getPOYears(compId) {
  const { rows } = await pool.query(
    `SELECT DISTINCT EXTRACT(YEAR FROM po.po_date)::int AS year
     FROM purchase_orders po
     JOIN records r ON r.record_id = po.record_id
     WHERE r.comp_id = $1
     ORDER BY year DESC`,
    [compId]
  );
  return rows.map((r) => r.year);
}

export async function listPOs({ compId, clientId, search, progress, year, yearType }) {
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
      `(record_id ILIKE ${p} OR description ILIKE ${p} OR client_name ILIKE ${p} OR po_no ILIKE ${p} OR est_no ILIKE ${p} OR invoice_nos_text ILIKE ${p} OR status ILIKE ${p} OR lifecycle ILIKE ${p} OR amount::text ILIKE ${p})`
    );
  }

  if (year) {
    if (yearType === "fy") {
      params.push(`${year}-04-01`);
      conditions.push(`po_date >= $${params.length}::date`);
      params.push(`${Number(year) + 1}-03-31`);
      conditions.push(`po_date <= $${params.length}::date`);
    } else {
      params.push(`${year}-01-01`);
      conditions.push(`po_date >= $${params.length}::date`);
      params.push(`${year}-12-31`);
      conditions.push(`po_date <= $${params.length}::date`);
    }
  }

  if (progress && progress.length > 0) {
    params.push(progress);
    conditions.push(
      `(CASE WHEN custom_status IS NOT NULL THEN custom_status WHEN lifecycle = 'Archived' THEN 'PO Archived' WHEN lifecycle = 'Cancelled' THEN 'PO Cancelled' ELSE status END) = ANY($${params.length})`
    );
  }

  const { rows } = await pool.query(
    `
    WITH base AS (
      SELECT
        po.po_id, po.po_no, po.po_date, po.description, po.amount, po.is_archived, po.custom_status,
        r.record_id, r.comp_id,
        cl.client_id, cl.client_name,
        e.est_id, e.est_no, e.tags AS estimate_tags,
        inv.inv_id,
        d.doc_id, d.file_name, d.document_type, d.external_url,
        COALESCE(billed.invoiced_amount, 0) AS invoiced_amount,
        po.amount - COALESCE(billed.invoiced_amount, 0) AS invoice_balance,
        COALESCE(inv_list.invoices, '[]'::json) AS invoices,
        -- Lets search find a PO by any one of its invoice numbers too — a
        -- PO with several invoices (partial billing) should surface for a
        -- search on any single one of them, not just its own PO No.
        inv_list.invoice_nos_text,
        CASE
          WHEN COALESCE(inv_stats.invoice_count, 0) = 0 THEN 'Invoice Pending'
          WHEN COALESCE(inv_stats.total_allocated, 0) > 0
               AND inv_stats.total_allocated >= inv_stats.total_invoice_amount THEN 'Paid'
          WHEN COALESCE(inv_stats.total_allocated, 0) > 0 THEN 'Partial Paid'
          WHEN inv_stats.any_rejected THEN 'Rejected'
          WHEN inv_stats.any_submitted THEN
            CASE
              WHEN inv_stats.any_scheduled THEN 'Scheduled'
              WHEN inv_stats.any_payment_pending THEN 'Payment Pending'
              ELSE 'In Progress'
            END
          ELSE 'Raised Not Submitted Yet'
        END AS status,
        inv_stats.scheduled_payment_date,
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
        -- How much of this PO's base amount has been billed so far (cancelled
        -- invoices don't count) — lets the list show a partial-billing reminder
        -- without opening the invoice form.
        SELECT sum(invoice_amount) AS invoiced_amount
        FROM invoices i
        WHERE i.po_no = po.po_no AND trim(lower(i.status)) NOT LIKE '%canc%'
      ) billed ON true
      LEFT JOIN LATERAL (
        -- Every invoice raised against this PO (including cancelled, shown
        -- with its own status) for the row's drill-down list — status/
        -- lifecycle mirror the same per-invoice CASE listInvoices() uses, so
        -- each invoice's own Progress can't drift from what its own page shows.
        SELECT json_agg(json_build_object(
          'inv_id', i3.inv_id,
          'invoice_no', i3.invoice_no,
          'invoice_date', i3.invoice_date,
          'invoice_amount', i3.invoice_amount,
          'invoice_total', i3.invoice_total,
          'is_archived', i3.is_archived,
          'custom_status', i3.custom_status,
          'scheduled_payment_date', i3.scheduled_payment_date,
          'status', CASE
            WHEN COALESCE(pa3.allocated, 0) > 0 AND pa3.allocated >= i3.invoice_total THEN 'Paid'
            WHEN COALESCE(pa3.allocated, 0) > 0 THEN 'Partial Paid'
            WHEN i3.submission_status IS NOT NULL AND i3.submission_status != 'Not Submitted' THEN
              CASE
                WHEN i3.scheduled_payment_date IS NOT NULL THEN 'Scheduled'
                WHEN i3.payment_pending THEN 'Payment Pending'
                ELSE 'In Progress'
              END
            ELSE 'Raised Not Submitted Yet'
          END,
          'lifecycle', CASE
            WHEN trim(lower(i3.status)) LIKE '%reject%' THEN 'Rejected'
            WHEN trim(lower(i3.status)) LIKE '%canc%' THEN 'Cancelled'
            WHEN i3.is_archived OR trim(lower(i3.status)) LIKE '%archiv%' THEN 'Archived'
            ELSE 'Raised'
          END
        ) ORDER BY i3.invoice_date) AS invoices,
        string_agg(i3.invoice_no, ' ') AS invoice_nos_text
        FROM invoices i3
        LEFT JOIN LATERAL (
          SELECT sum(allocated_amount) AS allocated
          FROM payment_allocations pa3
          WHERE pa3.invoice_no = i3.invoice_no
        ) pa3 ON true
        WHERE i3.po_no = po.po_no
      ) inv_list ON true
      LEFT JOIN LATERAL (
        SELECT
          count(*) AS invoice_count,
          sum(i.invoice_total) AS total_invoice_amount,
          sum(COALESCE(pa_sum.allocated, 0)) AS total_allocated,
          bool_or(i.submission_status IS NOT NULL AND i.submission_status <> 'Not Submitted')
            FILTER (WHERE i.invoice_total > COALESCE(pa_sum.allocated, 0) AND trim(lower(i.status)) NOT LIKE '%reject%') AS any_submitted,
          bool_or(i.scheduled_payment_date IS NOT NULL)
            FILTER (WHERE i.invoice_total > COALESCE(pa_sum.allocated, 0) AND trim(lower(i.status)) NOT LIKE '%reject%') AS any_scheduled,
          bool_or(i.payment_pending)
            FILTER (WHERE i.invoice_total > COALESCE(pa_sum.allocated, 0) AND trim(lower(i.status)) NOT LIKE '%reject%') AS any_payment_pending,
          min(i.scheduled_payment_date)
            FILTER (WHERE i.invoice_total > COALESCE(pa_sum.allocated, 0) AND trim(lower(i.status)) NOT LIKE '%reject%') AS scheduled_payment_date,
          bool_or(trim(lower(i.status)) LIKE '%reject%')
            FILTER (WHERE i.invoice_total > COALESCE(pa_sum.allocated, 0)) AS any_rejected
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
    ORDER BY po_date ASC, po_id ASC
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

// PO numbers aren't enforced unique at the DB level, so the Add form warns
// (rather than blocks) when one's already in use on a different record.
// Scoped to the company — each company has its own numbering, so the same
// PO No showing up under a different company isn't a real duplicate.
export async function poNoExists(poNo, compId) {
  const { rows } = await pool.query(
    `SELECT 1 FROM purchase_orders po
     JOIN records r ON r.record_id = po.record_id
     WHERE po.po_no = $1 AND r.comp_id = $2 LIMIT 1`,
    [poNo, compId]
  );
  return rows.length > 0;
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
export async function updatePO(poId, { poNo, poDate, description, amount, customStatus }) {
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

  await pool.query("UPDATE purchase_orders SET custom_status = $1, updated_at = now() WHERE po_id = $2", [
    customStatus || null,
    poId,
  ]);
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
