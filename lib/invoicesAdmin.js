import { pool } from "./db";
import { nextId } from "./ids";
import { toDateString } from "./dates";

export async function listInvoices({ compId, clientId, search, progress, year, yearType }) {
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
      `(record_id ILIKE ${p} OR description ILIKE ${p} OR client_name ILIKE ${p} OR invoice_no ILIKE ${p} OR po_no ILIKE ${p} OR chain_est_no ILIKE ${p} OR status ILIKE ${p} OR lifecycle ILIKE ${p} OR invoice_amount::text ILIKE ${p} OR invoice_total::text ILIKE ${p})`
    );
  }

  if (year) {
    if (yearType === "fy") {
      params.push(`${year}-04-01`);
      conditions.push(`invoice_date >= $${params.length}::date`);
      params.push(`${Number(year) + 1}-03-31`);
      conditions.push(`invoice_date <= $${params.length}::date`);
    } else {
      params.push(`${year}-01-01`);
      conditions.push(`invoice_date >= $${params.length}::date`);
      params.push(`${year}-12-31`);
      conditions.push(`invoice_date <= $${params.length}::date`);
    }
  }

  if (progress && progress.length > 0) {
    params.push(progress);
    conditions.push(
      `(CASE WHEN custom_status IS NOT NULL THEN custom_status WHEN lifecycle = 'Rejected' THEN 'Invoice Rejected' WHEN lifecycle = 'Archived' THEN 'Invoice Archived' WHEN lifecycle = 'Cancelled' THEN 'Invoice Cancelled' ELSE status END) = ANY($${params.length})`
    );
  }

  const { rows } = await pool.query(
    `
    WITH base AS (
      SELECT
        i.inv_id, i.invoice_no, i.invoice_date, i.description,
        i.invoice_amount, i.gst_percentage, i.gst_amount,
        i.tds_percentage, i.tds_amount, i.invoice_total,
        i.payment_mode, i.is_archived, i.po_no, i.est_id,
        i.scheduled_payment_date, i.submission_status, i.submission_date, i.custom_status, i.payment_pending,
        r.record_id, r.comp_id,
        cl.client_id, cl.client_name,
        d.doc_id, d.file_name, d.document_type, d.external_url,
        po.amount AS po_amount,
        COALESCE(po_inv.invoiced_others, 0) AS po_invoiced_others,
        est.est_no, est.amount AS est_amount,
        COALESCE(est_inv.invoiced_others, 0) AS est_invoiced_others,
        -- Separate from est_no above (which only resolves for a direct,
        -- no-PO invoice, since est_amount/est_invoiced_others need to mean
        -- specifically that) — this instead finds the Estimate No either
        -- way, PO-routed or direct, purely so it can be searched on.
        est_for_search.est_no AS chain_est_no,
        CASE
          WHEN COALESCE(pa_sum.allocated, 0) > 0 AND pa_sum.allocated >= i.invoice_total THEN 'Paid'
          WHEN COALESCE(pa_sum.allocated, 0) > 0 THEN 'Partial Paid'
          WHEN i.submission_status IS NOT NULL AND i.submission_status != 'Not Submitted' THEN
            CASE
              WHEN i.scheduled_payment_date IS NOT NULL THEN 'Scheduled'
              WHEN i.payment_pending THEN 'Payment Pending'
              ELSE 'In Progress'
            END
          ELSE 'Raised Not Submitted Yet'
        END AS status,
        CASE
          WHEN trim(lower(i.status)) LIKE '%reject%' THEN 'Rejected'
          WHEN trim(lower(i.status)) LIKE '%canc%' THEN 'Cancelled'
          WHEN i.is_archived OR trim(lower(i.status)) LIKE '%archiv%' THEN 'Archived'
          ELSE 'Raised'
        END AS lifecycle
      FROM invoices i
      JOIN records r ON r.record_id = i.record_id
      JOIN clients cl ON cl.client_id = r.client_id
      LEFT JOIN purchase_orders po ON po.po_no = i.po_no
      LEFT JOIN estimates est ON est.est_id = i.est_id
      LEFT JOIN estimates est_for_search ON est_for_search.est_id = COALESCE(i.est_id, po.estimate_id)
      LEFT JOIN documents d ON d.module_id = i.inv_id
      LEFT JOIN LATERAL (
        SELECT sum(allocated_amount) AS allocated
        FROM payment_allocations pa
        WHERE pa.invoice_no = i.invoice_no
      ) pa_sum ON true
      LEFT JOIN LATERAL (
        -- Other (non-cancelled) invoices already billed against the same PO —
        -- used to warn if editing this invoice's amount would over-invoice the PO.
        SELECT sum(invoice_amount) AS invoiced_others
        FROM invoices other
        WHERE other.po_no = i.po_no AND other.inv_id != i.inv_id
          AND trim(lower(other.status)) NOT LIKE '%canc%'
      ) po_inv ON true
      LEFT JOIN LATERAL (
        -- Same as po_inv above, but for invoices raised directly against an
        -- Estimate with no PO in between.
        SELECT sum(invoice_amount) AS invoiced_others
        FROM invoices other
        WHERE other.est_id = i.est_id AND other.inv_id != i.inv_id
          AND trim(lower(other.status)) NOT LIKE '%canc%'
      ) est_inv ON true
    )
    SELECT * FROM base
    WHERE ${conditions.join(" AND ")}
    ORDER BY invoice_date ASC, inv_id ASC
    `,
    params
  );
  return rows;
}

// Distinct calendar years that have at least one invoice for this company —
// used to populate the year picker on the Detailed Invoices report.
export async function getInvoiceYears(compId) {
  const { rows } = await pool.query(
    `
    SELECT DISTINCT EXTRACT(YEAR FROM i.invoice_date)::int AS year
    FROM invoices i
    JOIN records r ON r.record_id = i.record_id
    WHERE r.comp_id = $1
    ORDER BY year DESC
    `,
    [compId]
  );
  return rows.map((r) => r.year);
}

// "Detailed Invoices" report: every invoice for every client of a company in
// one list (unlike the per-client Invoices page), with GST/TDS broken out and
// an optional calendar-year or financial-year (Apr–Mar) filter for tax
// reporting. Archived/Cancelled invoices still show up here (so it's clear
// which invoice was cancelled/archived and why, via remarks) but their
// GST/TDS/Total are blanked in the UI and excluded from the totals line,
// since a cancelled/archived invoice isn't a real GST/TDS liability. Passing
// `lifecycle` narrows straight down to just Raised/Archived/Cancelled rows,
// since "Cancelled" as free-text search wouldn't match the legacy "Cancled" typo.
export async function getDetailedInvoices({ compId, clientId, search, year, yearType, lifecycle }) {
  const conditions = ["r.comp_id = $1"];
  const params = [compId];

  if (clientId) {
    params.push(clientId);
    conditions.push(`r.client_id = $${params.length}`);
  }

  if (year) {
    if (yearType === "fy") {
      params.push(`${year}-04-01`);
      conditions.push(`i.invoice_date >= $${params.length}::date`);
      params.push(`${Number(year) + 1}-03-31`);
      conditions.push(`i.invoice_date <= $${params.length}::date`);
    } else {
      params.push(`${year}-01-01`);
      conditions.push(`i.invoice_date >= $${params.length}::date`);
      params.push(`${year}-12-31`);
      conditions.push(`i.invoice_date <= $${params.length}::date`);
    }
  }

  const words = search ? search.trim().split(/\s+/).filter(Boolean) : [];
  for (const word of words) {
    params.push(`%${word}%`);
    const p = `$${params.length}`;
    conditions.push(
      `(r.record_id ILIKE ${p} OR i.description ILIKE ${p} OR cl.client_name ILIKE ${p} OR i.invoice_no ILIKE ${p} OR i.po_no ILIKE ${p} OR est.est_no ILIKE ${p} OR i.status ILIKE ${p} OR i.remarks ILIKE ${p} OR i.invoice_amount::text ILIKE ${p} OR i.invoice_total::text ILIKE ${p})`
    );
  }

  const lifecycleFilter =
    lifecycle && ["Raised", "Archived", "Cancelled"].includes(lifecycle)
      ? `WHERE lifecycle = '${lifecycle}'`
      : "";

  const { rows } = await pool.query(
    `
    WITH detailed AS (
      SELECT
        i.inv_id, r.record_id, i.invoice_no, i.invoice_date,
        cl.client_name, i.description,
        i.invoice_amount, i.gst_percentage, i.gst_amount,
        i.tds_percentage, i.tds_amount, i.invoice_total,
        i.remarks, i.is_archived,
        i.scheduled_payment_date, i.submission_status, i.submission_date, i.custom_status, i.payment_pending,
        COALESCE(pa_sum.allocated, 0) AS total_received,
        i.invoice_total - COALESCE(pa_sum.allocated, 0) AS balance_due,
        CASE
          WHEN COALESCE(pa_sum.allocated, 0) > 0 AND pa_sum.allocated >= i.invoice_total THEN 'Paid'
          WHEN COALESCE(pa_sum.allocated, 0) > 0 THEN 'Partial Paid'
          WHEN i.submission_status IS NOT NULL AND i.submission_status != 'Not Submitted' THEN
            CASE
              WHEN i.scheduled_payment_date IS NOT NULL THEN 'Scheduled'
              WHEN i.payment_pending THEN 'Payment Pending'
              ELSE 'In Progress'
            END
          ELSE 'Raised Not Submitted Yet'
        END AS status,
        CASE
          WHEN trim(lower(i.status)) LIKE '%reject%' THEN 'Rejected'
          WHEN trim(lower(i.status)) LIKE '%canc%' THEN 'Cancelled'
          WHEN i.is_archived OR trim(lower(i.status)) LIKE '%archiv%' THEN 'Archived'
          ELSE 'Raised'
        END AS lifecycle
      FROM invoices i
      JOIN records r ON r.record_id = i.record_id
      JOIN clients cl ON cl.client_id = r.client_id
      LEFT JOIN purchase_orders po ON po.po_no = i.po_no
      LEFT JOIN estimates est ON est.est_id = COALESCE(i.est_id, po.estimate_id)
      LEFT JOIN LATERAL (
        SELECT sum(allocated_amount) AS allocated
        FROM payment_allocations pa
        WHERE pa.invoice_no = i.invoice_no
      ) pa_sum ON true
      WHERE ${conditions.join(" AND ")}
    )
    SELECT * FROM detailed
    ${lifecycleFilter}
    ORDER BY invoice_date ASC, inv_id ASC
    `,
    params
  );
  return rows;
}

// Multiple invoices per PO are allowed (partial billing), so a PO stays a
// valid pick until it's fully billed — not just ones with zero invoices yet.
// Once a PO's balance hits zero there's nothing left to invoice against it,
// so it's left out of this picker entirely (still visible/editable on the
// Purchase Orders page itself).
export async function getPOsForPicker(compId, clientId) {
  const params = [compId];
  let clientFilter = "";
  if (clientId) {
    params.push(clientId);
    clientFilter = `AND r.client_id = $${params.length}`;
  }
  const { rows } = await pool.query(
    `
    WITH picker AS (
      SELECT
        po.po_id, po.po_no, po.po_date, po.description, po.amount, cl.client_name,
        COALESCE(inv_sum.invoiced, 0) AS invoiced_amount,
        po.amount - COALESCE(inv_sum.invoiced, 0) AS balance
      FROM purchase_orders po
      JOIN records r ON r.record_id = po.record_id
      JOIN clients cl ON cl.client_id = r.client_id
      LEFT JOIN LATERAL (
        -- Cancelled invoices don't consume the PO's balance.
        SELECT sum(invoice_amount) AS invoiced
        FROM invoices i
        WHERE i.po_no = po.po_no AND trim(lower(i.status)) NOT LIKE '%canc%'
      ) inv_sum ON true
      WHERE r.comp_id = $1
        ${clientFilter}
    )
    SELECT * FROM picker
    WHERE balance > 0.01
    ORDER BY po_date DESC
    `,
    params
  );
  return rows;
}

// Some clients skip the PO step and want an invoice straight off the
// Estimate. Only Estimates with no PO at all are offered here — once a PO
// exists, invoicing goes through the normal PO picker instead, same "reject
// once fully billed" balance rule as getPOsForPicker.
export async function getEstimatesForDirectInvoicePicker(compId, clientId) {
  const params = [compId];
  let clientFilter = "";
  if (clientId) {
    params.push(clientId);
    clientFilter = `AND r.client_id = $${params.length}`;
  }
  const { rows } = await pool.query(
    `
    WITH picker AS (
      SELECT
        e.est_id, e.est_no, e.estimate_date, e.description, e.amount, cl.client_name,
        COALESCE(inv_sum.invoiced, 0) AS invoiced_amount,
        e.amount - COALESCE(inv_sum.invoiced, 0) AS balance
      FROM estimates e
      JOIN records r ON r.record_id = e.record_id
      JOIN clients cl ON cl.client_id = r.client_id
      LEFT JOIN LATERAL (
        SELECT sum(invoice_amount) AS invoiced
        FROM invoices i
        WHERE i.est_id = e.est_id AND trim(lower(i.status)) NOT LIKE '%canc%'
      ) inv_sum ON true
      WHERE r.comp_id = $1
        AND NOT EXISTS (SELECT 1 FROM purchase_orders po WHERE po.estimate_id = e.est_id)
        ${clientFilter}
    )
    SELECT * FROM picker
    WHERE balance > 0.01
    ORDER BY estimate_date DESC
    `,
    params
  );
  return rows;
}

// Sum of (non-cancelled) invoice amounts already raised against a PO, so
// callers can check a new/edited invoice against the PO's remaining balance.
// `excludeInvId` leaves out the invoice being edited so it isn't double-counted.
async function getPOInvoicedTotal(poNo, excludeInvId) {
  const params = [poNo];
  let excludeClause = "";
  if (excludeInvId) {
    params.push(excludeInvId);
    excludeClause = `AND inv_id != $${params.length}`;
  }
  const { rows } = await pool.query(
    `SELECT COALESCE(sum(invoice_amount), 0) AS total
     FROM invoices
     WHERE po_no = $1 AND trim(lower(status)) NOT LIKE '%canc%' ${excludeClause}`,
    params
  );
  return Number(rows[0].total);
}

// Same as getPOInvoicedTotal, for invoices raised directly against an
// Estimate (no PO in between).
async function getEstimateInvoicedTotal(estId, excludeInvId) {
  const params = [estId];
  let excludeClause = "";
  if (excludeInvId) {
    params.push(excludeInvId);
    excludeClause = `AND inv_id != $${params.length}`;
  }
  const { rows } = await pool.query(
    `SELECT COALESCE(sum(invoice_amount), 0) AS total
     FROM invoices
     WHERE est_id = $1 AND trim(lower(status)) NOT LIKE '%canc%' ${excludeClause}`,
    params
  );
  return Number(rows[0].total);
}

function computeAmounts({ invoiceAmount, gstPercentage, tdsPercentage }) {
  const amount = Number(invoiceAmount);
  const gst = Number(gstPercentage) || 0;
  const tds = Number(tdsPercentage) || 0;
  const gstAmount = Math.round(amount * gst * 100) / 100;
  const tdsAmount = Math.round(amount * tds * 100) / 100;
  const total = Math.round((amount + gstAmount - tdsAmount) * 100) / 100;
  return { gstAmount, tdsAmount, total };
}

// Invoice numbers aren't enforced unique at the DB level, so the Add form
// warns (rather than blocks) when one's already in use on a different record.
// Scoped to the company — each company has its own numbering, so the same
// Invoice No showing up under a different company isn't a real duplicate.
export async function invoiceNoExists(invoiceNo, compId) {
  const { rows } = await pool.query(
    `SELECT 1 FROM invoices i
     JOIN records r ON r.record_id = i.record_id
     WHERE i.invoice_no = $1 AND r.comp_id = $2 LIMIT 1`,
    [invoiceNo, compId]
  );
  return rows.length > 0;
}

// Most invoices go through a PO, but some clients skip that step and want an
// invoice straight off the Estimate — pass estId instead of poId for those.
// Exactly one of the two must be given.
export async function createInvoice({
  poId,
  estId,
  invoiceNo,
  invoiceDate,
  description,
  invoiceAmount,
  gstPercentage,
  tdsPercentage,
}) {
  if (!poId && !estId) {
    throw new Error("Either a Purchase Order or an Estimate is required.");
  }

  let recordId;
  let poNo = null;
  let estIdForInsert = null;

  if (poId) {
    const { rows } = await pool.query(
      "SELECT record_id, po_no, po_date, amount FROM purchase_orders WHERE po_id = $1",
      [poId]
    );
    if (!rows[0]) throw new Error("Purchase Order not found");
    const poDate = toDateString(rows[0].po_date);
    if (invoiceDate < poDate) {
      throw new Error(`Invoice date can't be before the PO date (${poDate}).`);
    }

    const alreadyInvoiced = await getPOInvoicedTotal(rows[0].po_no);
    const poAmount = Number(rows[0].amount);
    const remaining = poAmount - alreadyInvoiced;
    if (Number(invoiceAmount) > remaining + 0.01) {
      throw new Error(
        `Invoice amount exceeds this PO's remaining balance. PO amount: ₹${poAmount.toFixed(2)}, already invoiced: ₹${alreadyInvoiced.toFixed(2)}, balance: ₹${remaining.toFixed(2)}.`
      );
    }
    recordId = rows[0].record_id;
    poNo = rows[0].po_no;
  } else {
    const { rows } = await pool.query(
      "SELECT record_id, estimate_date, amount FROM estimates WHERE est_id = $1",
      [estId]
    );
    if (!rows[0]) throw new Error("Estimate not found");
    const estDate = toDateString(rows[0].estimate_date);
    if (invoiceDate < estDate) {
      throw new Error(`Invoice date can't be before the Estimate date (${estDate}).`);
    }

    const { rows: poCheck } = await pool.query(
      "SELECT 1 FROM purchase_orders WHERE estimate_id = $1",
      [estId]
    );
    if (poCheck.length > 0) {
      throw new Error("This Estimate already has a Purchase Order — raise the invoice against the PO instead.");
    }

    const alreadyInvoiced = await getEstimateInvoicedTotal(estId);
    const estAmount = Number(rows[0].amount);
    const remaining = estAmount - alreadyInvoiced;
    if (Number(invoiceAmount) > remaining + 0.01) {
      throw new Error(
        `Invoice amount exceeds this Estimate's remaining balance. Estimate amount: ₹${estAmount.toFixed(2)}, already invoiced: ₹${alreadyInvoiced.toFixed(2)}, balance: ₹${remaining.toFixed(2)}.`
      );
    }
    recordId = rows[0].record_id;
    estIdForInsert = estId;
  }

  const { gstAmount, tdsAmount, total } = computeAmounts({
    invoiceAmount,
    gstPercentage,
    tdsPercentage,
  });

  const invId = await nextId("invoices", "inv_id", "INV-");
  await pool.query(
    `INSERT INTO invoices (
       inv_id, record_id, po_no, est_id, invoice_no, invoice_date, description,
       invoice_amount, gst_percentage, gst_amount, tds_percentage, tds_amount,
       invoice_total, status, payment_mode, created_at, updated_at
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 'Raised', 'Detailed', now(), now())`,
    [
      invId,
      recordId,
      poNo,
      estIdForInsert,
      invoiceNo,
      invoiceDate,
      description,
      invoiceAmount,
      gstPercentage || 0,
      gstAmount,
      tdsPercentage || 0,
      tdsAmount,
      total,
    ]
  );
  return invId;
}

// Once a Payment is allocated against this invoice, its amounts lock — only
// description/invoice_no/date stay editable. Scheduled Payment Date and
// Submission Status/Date aren't part of that lock — they're independent
// tracking fields, editable regardless of payment state.
export async function updateInvoice(
  invId,
  {
    invoiceNo,
    invoiceDate,
    description,
    invoiceAmount,
    gstPercentage,
    tdsPercentage,
    scheduledPaymentDate,
    submissionStatus,
    submissionDate,
    paymentRejected,
    paymentPending,
    customStatus,
  }
) {
  const { rows } = await pool.query(
    `SELECT i.invoice_no, i.po_no, i.est_id,
            po.po_date, po.amount AS po_amount,
            est.estimate_date, est.amount AS est_amount
     FROM invoices i
     LEFT JOIN purchase_orders po ON po.po_no = i.po_no
     LEFT JOIN estimates est ON est.est_id = i.est_id
     WHERE i.inv_id = $1`,
    [invId]
  );
  if (!rows[0]) throw new Error("Invoice not found");
  const parentDate = toDateString(rows[0].po_no ? rows[0].po_date : rows[0].estimate_date);
  const parentLabel = rows[0].po_no ? "PO" : "Estimate";
  if (invoiceDate < parentDate) {
    throw new Error(`Invoice date can't be before the ${parentLabel} date (${parentDate}).`);
  }

  const { rows: paid } = await pool.query(
    "SELECT 1 FROM payment_allocations WHERE invoice_no = $1",
    [rows[0].invoice_no]
  );
  const hasPayment = paid.length > 0;

  if (hasPayment) {
    await pool.query(
      `UPDATE invoices SET invoice_no = $1, invoice_date = $2, description = $3, updated_at = now()
       WHERE inv_id = $4`,
      [invoiceNo, invoiceDate, description, invId]
    );
  } else {
    const alreadyInvoiced = rows[0].po_no
      ? await getPOInvoicedTotal(rows[0].po_no, invId)
      : await getEstimateInvoicedTotal(rows[0].est_id, invId);
    const parentAmount = Number(rows[0].po_no ? rows[0].po_amount : rows[0].est_amount);
    const remaining = parentAmount - alreadyInvoiced;
    if (Number(invoiceAmount) > remaining + 0.01) {
      throw new Error(
        `Invoice amount exceeds this ${parentLabel}'s remaining balance. ${parentLabel} amount: ₹${parentAmount.toFixed(2)}, already invoiced (other invoices): ₹${alreadyInvoiced.toFixed(2)}, balance: ₹${remaining.toFixed(2)}.`
      );
    }

    const { gstAmount, tdsAmount, total } = computeAmounts({
      invoiceAmount,
      gstPercentage,
      tdsPercentage,
    });
    await pool.query(
      `UPDATE invoices SET
         invoice_no = $1, invoice_date = $2, description = $3,
         invoice_amount = $4, gst_percentage = $5, gst_amount = $6,
         tds_percentage = $7, tds_amount = $8, invoice_total = $9,
         updated_at = now()
       WHERE inv_id = $10`,
      [
        invoiceNo,
        invoiceDate,
        description,
        invoiceAmount,
        gstPercentage || 0,
        gstAmount,
        tdsPercentage || 0,
        tdsAmount,
        total,
        invId,
      ]
    );
  }

  await pool.query(
    `UPDATE invoices SET
       scheduled_payment_date = $1, submission_status = $2, submission_date = $3,
       payment_pending = $4, updated_at = now()
     WHERE inv_id = $5`,
    [
      scheduledPaymentDate || null,
      submissionStatus || "Not Submitted",
      submissionDate || null,
      Boolean(paymentPending),
      invId,
    ]
  );

  // "Rejected" (client refused to pay) is its own lifecycle state — bypasses
  // setInvoiceRejected's own guard since this is the intentional one-way
  // cascade from the Payment Progress field, not a manual Status change.
  if (paymentRejected) {
    await pool.query("UPDATE invoices SET status = 'Rejected', updated_at = now() WHERE inv_id = $1", [invId]);
  }

  // A custom status label (Settings-managed) is a standalone peer state —
  // choosing one clears every other state field so exactly one is active;
  // choosing a fixed option again just clears custom_status back to null.
  if (customStatus) {
    await pool.query(
      `UPDATE invoices SET
         custom_status = $1, is_archived = false, status = 'Raised',
         submission_status = 'Not Submitted', submission_date = NULL, scheduled_payment_date = NULL,
         updated_at = now()
       WHERE inv_id = $2`,
      [customStatus, invId]
    );
  } else {
    await pool.query("UPDATE invoices SET custom_status = NULL, updated_at = now() WHERE inv_id = $1", [invId]);
  }
}

// Lightweight update used from the Payment Allocations page, where the user
// only picks In Progress vs Scheduled (+ date) without touching the rest of
// the invoice — kept separate from updateInvoice so it doesn't require the
// full invoice payload (amount, GST/TDS, etc).
export async function updatePaymentProgress(invId, { scheduledPaymentDate, rejected, paymentPending }) {
  const { rows } = await pool.query(
    "SELECT invoice_no, submission_status FROM invoices WHERE inv_id = $1",
    [invId]
  );
  if (!rows[0]) throw new Error("Invoice not found");
  if (!rows[0].submission_status || rows[0].submission_status === "Not Submitted") {
    throw new Error("Invoice must be submitted before setting payment progress.");
  }
  const { rows: paid } = await pool.query(
    "SELECT 1 FROM payment_allocations WHERE invoice_no = $1",
    [rows[0].invoice_no]
  );
  if (paid.length > 0) {
    throw new Error("A payment is already allocated — progress is automatic now.");
  }
  // "Rejected" (client refused to pay) is its own lifecycle state, same as a
  // payment allocation that later bounces (see rejectPaymentAllocation in
  // paymentsAdmin.js) — not the same thing as Archived.
  if (rejected) {
    await pool.query(
      "UPDATE invoices SET scheduled_payment_date = NULL, payment_pending = false, status = 'Rejected', updated_at = now() WHERE inv_id = $1",
      [invId]
    );
    return;
  }
  await pool.query(
    "UPDATE invoices SET scheduled_payment_date = $1, payment_pending = $2, updated_at = now() WHERE inv_id = $3",
    [scheduledPaymentDate || null, Boolean(paymentPending), invId]
  );
}

export async function deleteInvoice(invId) {
  const { rows } = await pool.query("SELECT invoice_no FROM invoices WHERE inv_id = $1", [invId]);
  if (!rows[0]) throw new Error("Invoice not found");
  const { rows: linked } = await pool.query(
    "SELECT 1 FROM payment_allocations WHERE invoice_no = $1",
    [rows[0].invoice_no]
  );
  if (linked.length > 0) {
    throw new Error("This invoice already has a payment allocated — remove that first.");
  }
  await pool.query("DELETE FROM documents WHERE module_id = $1", [invId]);
  await pool.query("DELETE FROM invoices WHERE inv_id = $1", [invId]);
}

// Blocked once the invoice's payment progress has moved past "Payment
// Pending" — i.e. it's been Submitted (In Progress/Scheduled) or has any
// money allocated (Partial Paid/Paid). Only an untouched, un-submitted
// invoice can be archived or cancelled.
export async function setInvoiceArchived(invId, archived) {
  if (archived) {
    const { rows } = await pool.query(
      "SELECT invoice_no, submission_status FROM invoices WHERE inv_id = $1",
      [invId]
    );
    if (!rows[0]) throw new Error("Invoice not found");
    if (rows[0].submission_status && rows[0].submission_status !== "Not Submitted") {
      throw new Error("This invoice has already been submitted — it can't be archived while payment is in progress.");
    }
    const { rows: linked } = await pool.query("SELECT 1 FROM payment_allocations WHERE invoice_no = $1", [
      rows[0].invoice_no,
    ]);
    if (linked.length > 0) {
      throw new Error("This invoice has a payment allocated — archive the payment instead.");
    }
  }
  await pool.query("UPDATE invoices SET is_archived = $1, updated_at = now() WHERE inv_id = $2", [
    archived,
    invId,
  ]);
}

// Marking an invoice Cancelled (separate from Archive) is the only way its
// lifecycle should ever show "Cancelled" — blocked once a payment is already
// allocated, since a cancelled invoice can't legitimately have money against
// it (that combination was found in legacy data and caused real confusion).
export async function setInvoiceCancelled(invId, cancelled) {
  const { rows } = await pool.query(
    "SELECT invoice_no, submission_status FROM invoices WHERE inv_id = $1",
    [invId]
  );
  if (!rows[0]) throw new Error("Invoice not found");

  if (cancelled) {
    if (rows[0].submission_status && rows[0].submission_status !== "Not Submitted") {
      throw new Error("This invoice has already been submitted — it can't be cancelled while payment is in progress.");
    }
    const { rows: linked } = await pool.query(
      "SELECT 1 FROM payment_allocations WHERE invoice_no = $1",
      [rows[0].invoice_no]
    );
    if (linked.length > 0) {
      throw new Error("This invoice has a payment allocated — remove that first before cancelling.");
    }
  }

  await pool.query("UPDATE invoices SET status = $1, updated_at = now() WHERE inv_id = $2", [
    cancelled ? "Cancelled" : "Raised",
    invId,
  ]);
}

// Manually setting "Rejected" from the Status dropdown — same lifecycle
// state the Payment Progress field's "Rejected" option and
// rejectPaymentAllocation land on automatically. Only blocked if a payment
// is already marked Paid (rejecting money that's already confirmed received
// doesn't make sense — reject that payment allocation instead).
export async function setInvoiceRejected(invId, rejected) {
  const { rows } = await pool.query("SELECT invoice_no FROM invoices WHERE inv_id = $1", [invId]);
  if (!rows[0]) throw new Error("Invoice not found");

  if (rejected) {
    const { rows: paid } = await pool.query(
      "SELECT 1 FROM payment_allocations WHERE invoice_no = $1 AND payment_status = 'Paid'",
      [rows[0].invoice_no]
    );
    if (paid.length > 0) {
      throw new Error("This invoice has a payment already marked Paid — reject that payment instead.");
    }
  }

  await pool.query("UPDATE invoices SET status = $1, updated_at = now() WHERE inv_id = $2", [
    rejected ? "Rejected" : "Raised",
    invId,
  ]);
}
