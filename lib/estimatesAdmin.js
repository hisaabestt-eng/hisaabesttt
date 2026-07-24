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
      `(record_id ILIKE ${p} OR description ILIKE ${p} OR client_name ILIKE ${p} OR est_no ILIKE ${p} OR po_no ILIKE ${p} OR invoice_nos_text ILIKE ${p} OR tags ILIKE ${p} OR status ILIKE ${p} OR lifecycle ILIKE ${p} OR amount::text ILIKE ${p})`
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
        po.po_id, po.po_no,
        d.doc_id, d.file_name, d.document_type, d.external_url,
        -- Lets search find an estimate by any one of its invoice numbers
        -- too — an estimate with several invoices (partial billing) should
        -- surface for a search on any single one of them.
        CASE WHEN po.po_id IS NOT NULL THEN inv_stats.invoice_nos_text ELSE direct_inv.invoice_nos_text END
          AS invoice_nos_text,
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
                CASE
                  WHEN inv_stats.any_scheduled THEN 'Scheduled'
                  WHEN inv_stats.any_payment_pending THEN 'Payment Pending'
                  ELSE 'In Progress'
                END
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
                CASE
                  WHEN direct_inv.any_scheduled THEN 'Scheduled'
                  WHEN direct_inv.any_payment_pending THEN 'Payment Pending'
                  ELSE 'In Progress'
                END
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
          string_agg(i.invoice_no, ' ') AS invoice_nos_text,
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
      LEFT JOIN LATERAL (
        -- Invoices raised straight off this Estimate, skipping the PO step.
        SELECT
          count(*) AS invoice_count,
          string_agg(i.invoice_no, ' ') AS invoice_nos_text,
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
// Scoped to the company as a whole (same as Invoice No/PO No) — one shared
// numbering sequence across every client, not a separate one per client.
export async function estNoExists(estNo, compId) {
  const { rows } = await pool.query(
    `SELECT 1 FROM estimates e
     JOIN records r ON r.record_id = e.record_id
     WHERE e.est_no = $1 AND r.comp_id = $2 LIMIT 1`,
    [estNo, compId]
  );
  return rows.length > 0;
}

// Recognizes the "ES-25/26-054" style: a prefix, a two-digit/two-digit
// financial-year tag, then the running number for that year.
const FY_NO_RE = /^(.*?)(\d{2})\/(\d{2})-(\d+)$/;

// Just a starting suggestion for the Add Estimate form — the field stays
// fully editable, so this only saves typing on the common case. Scoped per
// client (unlike estNoExists above, which is company-wide) — while old data
// is being backfilled, different clients are often at very different points
// (one already caught up to the current FY, another still mid-backfill on
// an older one), and a single company-wide "next number" can only make
// sense for whichever client happens to be furthest along. Tracking each
// client's own progress independently keeps the suggestion useful for all
// of them at once regardless of what stage each one is at.
//
// For the FY-tagged format, this always continues the highest FY that
// client already has, rather than checking today's actual date — using
// today's date would wrongly jump a client still mid-backfill on an older
// year straight to the current FY, when what they almost always need next
// is simply the next number in whatever year they're still entering. The
// "resets to 001 each FY" behavior the client asked for still happens: the
// very first estimate in a new FY is necessarily typed in manually (nothing
// in the data suggests that year yet), and once it exists, it's now the
// highest FY for that client, so every suggestion after that naturally
// continues counting up within it.
export async function getSuggestedEstNosByClient(compId) {
  const { rows } = await pool.query(
    `SELECT r.client_id, e.est_no
     FROM estimates e
     JOIN records r ON r.record_id = e.record_id
     WHERE r.comp_id = $1`,
    [compId]
  );

  const byClient = new Map();
  for (const row of rows) {
    if (!byClient.has(row.client_id)) byClient.set(row.client_id, []);
    byClient.get(row.client_id).push(row.est_no);
  }

  const result = {};
  for (const [clientId, estNos] of byClient) {
    const fyMatches = estNos.map((n) => n.match(FY_NO_RE)).filter(Boolean);

    if (fyMatches.length > 0) {
      // Continue the highest FY this client already has, whatever it is.
      const best = fyMatches.reduce((a, b) => (`${a[2]}${a[3]}` >= `${b[2]}${b[3]}` ? a : b));
      const sameFYBest = fyMatches
        .filter((m) => `${m[2]}${m[3]}` === `${best[2]}${best[3]}`)
        .reduce((a, b) => (Number(a[4]) >= Number(b[4]) ? a : b));
      const [, prefix, fy1, fy2, digits] = sameFYBest;
      const next = String(Number(digits) + 1).padStart(digits.length, "0");
      result[clientId] = `${prefix}${fy1}/${fy2}-${next}`;
    } else {
      // Client has never used the FY-tagged format — fall back to plain
      // "increment the highest trailing number in use" behavior.
      let best = null;
      for (const n of estNos) {
        const m = n.match(/^(.*?)(\d+)$/);
        if (m && (!best || Number(m[2]) > Number(best[2]))) best = m;
      }
      if (best) {
        const [, prefix, digits] = best;
        result[clientId] = `${prefix}${String(Number(digits) + 1).padStart(digits.length, "0")}`;
      }
    }
  }
  return result;
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
