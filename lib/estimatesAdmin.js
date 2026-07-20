import { pool } from "./db";
import { nextId } from "./ids";
import { toDateString } from "./dates";

// Reused by the Estimates page and (since it only lists records that already
// have an estimate) the Main page too.
export async function getEstimateYears(compId) {
  const { rows } = await pool.query(
    `SELECT DISTINCT EXTRACT(YEAR FROM e.estimate_date)::int AS year
     FROM estimates e
     JOIN records r ON r.record_id = e.record_id
     WHERE r.comp_id = $1
     ORDER BY year DESC`,
    [compId]
  );
  return rows.map((r) => r.year);
}

export async function listEstimates({ compId, clientId, search, progress, year, yearType }) {
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
      `(description ILIKE ${p} OR client_name ILIKE ${p} OR est_no ILIKE ${p} OR tags ILIKE ${p} OR status ILIKE ${p} OR lifecycle ILIKE ${p} OR amount::text ILIKE ${p})`
    );
  }

  if (year) {
    if (yearType === "fy") {
      params.push(`${year}-04-01`);
      conditions.push(`estimate_date >= $${params.length}::date`);
      params.push(`${Number(year) + 1}-03-31`);
      conditions.push(`estimate_date <= $${params.length}::date`);
    } else {
      params.push(`${year}-01-01`);
      conditions.push(`estimate_date >= $${params.length}::date`);
      params.push(`${year}-12-31`);
      conditions.push(`estimate_date <= $${params.length}::date`);
    }
  }

  if (progress && progress.length > 0) {
    params.push(progress);
    conditions.push(
      `(CASE WHEN custom_status IS NOT NULL THEN custom_status WHEN lifecycle = 'Archived' THEN 'Estimate Archived' WHEN lifecycle = 'Cancelled' THEN 'Estimate Cancelled' ELSE status END) = ANY($${params.length})`
    );
  }

  const { rows } = await pool.query(
    `
    WITH base AS (
      SELECT
        e.est_id, e.est_no, e.estimate_date, e.description, e.amount, e.tags, e.is_archived, e.custom_status,
        r.record_id, r.comp_id,
        cl.client_id, cl.client_name,
        po.po_id,
        d.doc_id, d.file_name, d.document_type, d.external_url,
        -- A PO-based estimate and a direct-invoice (no PO) estimate are
        -- mutually exclusive, so branch on which path this estimate took —
        -- an empty inv_stats/direct_inv still returns invoice_count = 0 (not
        -- NULL, since COUNT(*) over zero rows is 0), so COALESCE-picking
        -- between the two would always land on whichever is checked first.
        CASE
          WHEN po.po_id IS NULL AND COALESCE(direct_inv.invoice_count, 0) = 0 THEN 'PO Pending'
          WHEN po.po_id IS NOT NULL THEN
            CASE
              WHEN COALESCE(inv_stats.invoice_count, 0) = 0 THEN 'Invoice Pending'
              WHEN COALESCE(inv_stats.total_allocated, 0) > 0
                   AND inv_stats.total_allocated >= inv_stats.total_invoice_amount THEN 'Paid'
              WHEN COALESCE(inv_stats.total_allocated, 0) > 0 THEN 'Partial Paid'
              WHEN inv_stats.any_rejected THEN 'Rejected'
              WHEN inv_stats.any_submitted THEN
                CASE WHEN inv_stats.any_scheduled THEN 'Scheduled' ELSE 'In Progress' END
              ELSE 'Raised Not Submitted Yet'
            END
          ELSE
            CASE
              WHEN COALESCE(direct_inv.invoice_count, 0) = 0 THEN 'Invoice Pending'
              WHEN COALESCE(direct_inv.total_allocated, 0) > 0
                   AND direct_inv.total_allocated >= direct_inv.total_invoice_amount THEN 'Paid'
              WHEN COALESCE(direct_inv.total_allocated, 0) > 0 THEN 'Partial Paid'
              WHEN direct_inv.any_rejected THEN 'Rejected'
              WHEN direct_inv.any_submitted THEN
                CASE WHEN direct_inv.any_scheduled THEN 'Scheduled' ELSE 'In Progress' END
              ELSE 'Raised Not Submitted Yet'
            END
        END AS status,
        CASE WHEN po.po_id IS NOT NULL THEN inv_stats.scheduled_payment_date ELSE direct_inv.scheduled_payment_date END AS scheduled_payment_date,
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
          sum(COALESCE(pa_sum.allocated, 0)) AS total_allocated,
          bool_or(i.submission_status IS NOT NULL AND i.submission_status <> 'Not Submitted')
            FILTER (WHERE i.invoice_total > COALESCE(pa_sum.allocated, 0) AND trim(lower(i.status)) NOT LIKE '%reject%') AS any_submitted,
          bool_or(i.scheduled_payment_date IS NOT NULL)
            FILTER (WHERE i.invoice_total > COALESCE(pa_sum.allocated, 0) AND trim(lower(i.status)) NOT LIKE '%reject%') AS any_scheduled,
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
      LEFT JOIN LATERAL (
        -- Invoices raised straight off this Estimate, skipping the PO step.
        SELECT
          count(*) AS invoice_count,
          sum(i.invoice_total) AS total_invoice_amount,
          sum(COALESCE(pa_sum.allocated, 0)) AS total_allocated,
          bool_or(i.submission_status IS NOT NULL AND i.submission_status <> 'Not Submitted')
            FILTER (WHERE i.invoice_total > COALESCE(pa_sum.allocated, 0) AND trim(lower(i.status)) NOT LIKE '%reject%') AS any_submitted,
          bool_or(i.scheduled_payment_date IS NOT NULL)
            FILTER (WHERE i.invoice_total > COALESCE(pa_sum.allocated, 0) AND trim(lower(i.status)) NOT LIKE '%reject%') AS any_scheduled,
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
        WHERE i.est_id = e.est_id
      ) direct_inv ON true
    )
    SELECT * FROM base
    WHERE ${conditions.join(" AND ")}
    ORDER BY estimate_date ASC, est_id ASC
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

// Estimate numbers aren't enforced unique at the DB level, so the Add form
// warns (rather than blocks) when one's already in use on a different record.
// Scoped to the company — each company has its own numbering, so the same
// Estimate No showing up under a different company isn't a real duplicate.
export async function estNoExists(estNo, compId) {
  const { rows } = await pool.query(
    `SELECT 1 FROM estimates e
     JOIN records r ON r.record_id = e.record_id
     WHERE e.est_no = $1 AND r.comp_id = $2 LIMIT 1`,
    [estNo, compId]
  );
  return rows.length > 0;
}

// Only the trailing digits go up by one (e.g. "ES-25/26-054" -> "ES-25/26-055")
// — everything before them (including a financial-year segment) is left
// untouched, since that's not something a plain +1 can safely guess at.
function incrementTrailingNumber(str) {
  const m = str.match(/^(.*?)(\d+)$/);
  if (!m) return null;
  const [, prefix, digits] = m;
  const next = String(Number(digits) + 1).padStart(digits.length, "0");
  return prefix + next;
}

// Just a starting suggestion for the Add Estimate form — the field stays
// fully editable, so this only saves typing on the common case (same
// numbering scheme as the last estimate raised for this company).
export async function getSuggestedEstNo(compId) {
  const { rows } = await pool.query(
    `SELECT e.est_no FROM estimates e
     JOIN records r ON r.record_id = e.record_id
     WHERE r.comp_id = $1
     ORDER BY e.created_at DESC LIMIT 1`,
    [compId]
  );
  if (!rows[0]) return "";
  return incrementTrailingNumber(rows[0].est_no) || "";
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
export async function updateEstimate(estId, { estNo, estDate, description, amount, customStatus }) {
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

  await pool.query("UPDATE estimates SET custom_status = $1, updated_at = now() WHERE est_id = $2", [
    customStatus || null,
    estId,
  ]);
}

export async function deleteEstimate(estId) {
  const { rows } = await pool.query("SELECT 1 FROM purchase_orders WHERE estimate_id = $1", [estId]);
  if (rows.length > 0) {
    throw new Error("This estimate already has a Purchase Order — remove that first.");
  }
  const { rows: directInvoice } = await pool.query("SELECT 1 FROM invoices WHERE est_id = $1", [estId]);
  if (directInvoice.length > 0) {
    throw new Error("This estimate already has an invoice raised against it — remove that first.");
  }
  await pool.query("DELETE FROM documents WHERE module_id = $1", [estId]);
  await pool.query("DELETE FROM estimates WHERE est_id = $1", [estId]);
}

// Only the most-downstream stage can be archived — if a PO (or, for clients
// that skip PO, an invoice raised straight off the estimate) already exists,
// archive that instead of the estimate underneath it.
export async function setEstimateArchived(estId, archived) {
  if (archived) {
    const { rows } = await pool.query("SELECT 1 FROM purchase_orders WHERE estimate_id = $1", [
      estId,
    ]);
    if (rows.length > 0) {
      throw new Error("This estimate has a Purchase Order — archive the PO instead.");
    }
    const { rows: directInvoice } = await pool.query("SELECT 1 FROM invoices WHERE est_id = $1", [
      estId,
    ]);
    if (directInvoice.length > 0) {
      throw new Error("This estimate has an invoice raised against it — archive the invoice instead.");
    }
  }
  await pool.query("UPDATE estimates SET is_archived = $1, updated_at = now() WHERE est_id = $2", [
    archived,
    estId,
  ]);
}
