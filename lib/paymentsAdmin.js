import { pool } from "./db";
import { nextId } from "./ids";

// payments.client_id in the seed data uses a different (broken) ID scheme
// than clients.client_id, so client identity is derived through the
// allocation -> record -> client chain when possible. A brand-new payment
// with no allocations yet has no such chain, so it falls back to the
// payments row's own comp_id/client_id — which IS reliable for rows this
// app creates itself (only the old seed data's client_id is broken).
// Mirrors listPayments' own comp_id derivation (allocation -> record chain,
// falling back to the payment row's own comp_id) so the year picker only
// ever offers years that a company filter would actually surface.
export async function getPaymentYears(compId) {
  const { rows } = await pool.query(
    `
    WITH per_invoice AS (
      SELECT payment_id, invoice_no
      FROM payment_allocations
      GROUP BY payment_id, invoice_no
    ),
    alloc AS (
      SELECT pi.payment_id, r.comp_id
      FROM per_invoice pi
      JOIN invoices i ON i.invoice_no = pi.invoice_no
      JOIN records r ON r.record_id = i.record_id
      GROUP BY pi.payment_id, r.comp_id
    )
    SELECT DISTINCT EXTRACT(YEAR FROM p.payment_date)::int AS year
    FROM payments p
    LEFT JOIN alloc a ON a.payment_id = p.py_id
    WHERE COALESCE(a.comp_id, p.comp_id) = $1
    ORDER BY year DESC
    `,
    [compId]
  );
  return rows.map((r) => r.year);
}

export async function listPayments({ compId, clientId, search, year, yearType }) {
  const conditions = ["COALESCE(a.comp_id, p.comp_id) = $1"];
  const params = [compId];

  if (clientId) {
    params.push(clientId);
    conditions.push(`COALESCE(a.client_id, p.client_id) = $${params.length}`);
  }

  const words = search ? search.trim().split(/\s+/).filter(Boolean) : [];
  for (const word of words) {
    params.push(`%${word}%`);
    const p = `$${params.length}`;
    conditions.push(
      `(p.remarks ILIKE ${p} OR COALESCE(a.client_name, cl2.client_name) ILIKE ${p} OR a.invoice_nos_text ILIKE ${p} OR p.amount_received::text ILIKE ${p})`
    );
  }

  if (year) {
    if (yearType === "fy") {
      params.push(`${year}-04-01`);
      conditions.push(`p.payment_date >= $${params.length}::date`);
      params.push(`${Number(year) + 1}-03-31`);
      conditions.push(`p.payment_date <= $${params.length}::date`);
    } else {
      params.push(`${year}-01-01`);
      conditions.push(`p.payment_date >= $${params.length}::date`);
      params.push(`${year}-12-31`);
      conditions.push(`p.payment_date <= $${params.length}::date`);
    }
  }

  const { rows } = await pool.query(
    `
    WITH per_invoice AS (
      -- Some seed payments have two allocation rows against the same
      -- invoice; merge those into one amount per (payment, invoice) so the
      -- UI never has to render duplicate invoice chips.
      SELECT payment_id, invoice_no, sum(allocated_amount) AS amount, min(allocated_at) AS allocated_at
      FROM payment_allocations
      GROUP BY payment_id, invoice_no
    ),
    invoice_totals AS (
      -- An invoice's overall paid status depends on ALL payments against it,
      -- not just the one being rendered in this row.
      SELECT invoice_no, sum(allocated_amount) AS total_allocated
      FROM payment_allocations
      GROUP BY invoice_no
    ),
    enriched AS (
      SELECT
        pi.payment_id, pi.invoice_no, pi.amount, pi.allocated_at, i.invoice_total,
        r.comp_id, r.client_id, cl.client_name,
        CASE
          WHEN COALESCE(it.total_allocated, 0) <= 0 THEN 'Payment Pending'
          WHEN it.total_allocated >= i.invoice_total THEN 'Paid'
          ELSE 'Partial Paid'
        END AS status,
        CASE
          WHEN trim(lower(i.status)) LIKE '%reject%' THEN 'Rejected'
          WHEN trim(lower(i.status)) LIKE '%canc%' THEN 'Cancelled'
          WHEN i.is_archived OR trim(lower(i.status)) LIKE '%archiv%' THEN 'Archived'
          ELSE 'Raised'
        END AS lifecycle
      FROM per_invoice pi
      JOIN invoices i ON i.invoice_no = pi.invoice_no
      JOIN records r ON r.record_id = i.record_id
      JOIN clients cl ON cl.client_id = r.client_id
      LEFT JOIN invoice_totals it ON it.invoice_no = pi.invoice_no
    ),
    alloc AS (
      SELECT
        payment_id,
        comp_id,
        client_id,
        client_name,
        json_agg(json_build_object(
          'invoice_no', invoice_no, 'amount', amount, 'invoice_total', invoice_total,
          'status', status, 'lifecycle', lifecycle, 'allocated_at', allocated_at
        ) ORDER BY invoice_no) AS allocations,
        string_agg(invoice_no, ' ') AS invoice_nos_text,
        sum(amount) AS total_allocated
      FROM enriched
      GROUP BY payment_id, comp_id, client_id, client_name
    )
    SELECT
      p.py_id, p.payment_date, p.amount_received, p.remarks,
      COALESCE(a.client_id, p.client_id) AS client_id,
      COALESCE(a.client_name, cl2.client_name) AS client_name,
      COALESCE(a.allocations, '[]'::json) AS allocations,
      p.amount_received - COALESCE(a.total_allocated, 0) AS balance
    FROM payments p
    LEFT JOIN alloc a ON a.payment_id = p.py_id
    LEFT JOIN clients cl2 ON cl2.client_id = COALESCE(a.client_id, p.client_id)
    WHERE ${conditions.join(" AND ")}
    ORDER BY p.payment_date ASC, p.py_id ASC
    `,
    params
  );
  return rows;
}

// "Payment Allocations" page: one row per INVOICE (standard AR ageing/
// outstanding-report style — Invoice Amount, Total Received, Balance Due),
// with the individual payments that cleared it nested underneath for
// drill-down instead of flattened into the main list. Mixing both into one
// flat per-payment row was what made the same invoice number appear on
// multiple rows with a balance that looked like a subtraction error.
// Every invoice shows up here, not just ones that already have a payment —
// otherwise there'd be no way to see what's still pending.
export async function listInvoiceSummaries({ compId, clientId, search, progress, year, yearType }) {
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
    conditions.push(`(invoice_no ILIKE ${p} OR client_name ILIKE ${p} OR invoice_total::text ILIKE ${p})`);
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
    WITH per_invoice AS (
      -- payment_allocations has its own payment_status per row (separate from
      -- the invoice's overall lifecycle/submission status above) — carried
      -- through for the payment-history drill-down.
      SELECT payment_id, invoice_no, sum(allocated_amount) AS amount, min(allocated_at) AS allocated_at,
             max(payment_status) AS payment_status
      FROM payment_allocations
      GROUP BY payment_id, invoice_no
    ),
    payments_json AS (
      SELECT
        invoice_no,
        json_agg(json_build_object(
          'py_id', payment_id, 'amount', amount, 'allocated_at', allocated_at, 'payment_status', payment_status
        ) ORDER BY allocated_at) AS payments,
        sum(amount) AS total_received
      FROM per_invoice
      GROUP BY invoice_no
    ),
    base AS (
      SELECT
        i.inv_id, i.invoice_no, i.invoice_total, i.invoice_date, i.custom_status,
        COALESCE(pj.total_received, 0) AS total_received,
        i.invoice_total - COALESCE(pj.total_received, 0) AS balance_due,
        COALESCE(pj.payments, '[]'::json) AS payments,
        r.comp_id, r.client_id, cl.client_name,
        i.submission_status, i.submission_date, i.scheduled_payment_date, i.payment_pending, i.is_archived,
        CASE
          WHEN COALESCE(pj.total_received, 0) > 0 AND pj.total_received >= i.invoice_total THEN 'Paid'
          WHEN COALESCE(pj.total_received, 0) > 0 THEN 'Partial Paid'
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
      LEFT JOIN payments_json pj ON pj.invoice_no = i.invoice_no
    )
    SELECT * FROM base
    WHERE ${conditions.join(" AND ")}
    ORDER BY invoice_date ASC, inv_id ASC
    `,
    params
  );
  return rows;
}

// Invoices for this client that still have an unpaid balance — the picker
// for allocating a payment only offers these.
export async function getOutstandingInvoices(compId, clientId) {
  const { rows } = await pool.query(
    `
    SELECT
      i.inv_id, i.invoice_no, i.invoice_date, i.description, i.invoice_total,
      COALESCE(alloc.total_allocated, 0) AS allocated,
      i.invoice_total - COALESCE(alloc.total_allocated, 0) AS balance
    FROM invoices i
    JOIN records r ON r.record_id = i.record_id
    LEFT JOIN LATERAL (
      SELECT sum(allocated_amount) AS total_allocated
      FROM payment_allocations pa WHERE pa.invoice_no = i.invoice_no
    ) alloc ON true
    WHERE r.comp_id = $1 AND r.client_id = $2 AND i.is_archived = false
      AND trim(lower(i.status)) NOT LIKE '%canc%'
      AND i.invoice_total - COALESCE(alloc.total_allocated, 0) > 0
    ORDER BY i.invoice_date ASC
    `,
    [compId, clientId]
  );
  return rows;
}

// Recording a payment and allocating it to invoices are two separate steps
// now — this only creates the payments row ("client X gave us this much").
// Allocation happens afterwards via allocatePayment.
export async function createPayment({ compId, clientId, paymentDate, amountReceived, remarks }) {
  const pyId = await nextId("payments", "py_id", "PYMNT-");
  await pool.query(
    `INSERT INTO payments (py_id, comp_id, client_id, payment_date, amount_received, remarks, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, now(), now())`,
    [pyId, compId, clientId, paymentDate, Number(amountReceived), remarks || null]
  );
  return pyId;
}

export async function allocatePayment(pyId, { allocationDate, allocations }) {
  const cleanAllocations = (allocations || []).filter((a) => Number(a.amount) > 0);
  if (cleanAllocations.length === 0) {
    throw new Error("Allocate at least one invoice.");
  }

  const { rows: payRows } = await pool.query(
    `SELECT comp_id, client_id, amount_received,
            COALESCE((SELECT sum(allocated_amount) FROM payment_allocations WHERE payment_id = $1), 0) AS already_allocated
     FROM payments WHERE py_id = $1`,
    [pyId]
  );
  const payment = payRows[0];
  if (!payment) throw new Error("Payment not found.");

  const newTotal = cleanAllocations.reduce((sum, a) => sum + Number(a.amount), 0);
  const remainingBalance = Number(payment.amount_received) - Number(payment.already_allocated);
  if (newTotal > remainingBalance + 0.01) {
    throw new Error(
      `Allocated amount exceeds this payment's remaining balance (₹${remainingBalance.toFixed(2)}).`
    );
  }

  for (const a of cleanAllocations) {
    const { rows } = await pool.query(
      `SELECT i.invoice_total, i.record_id, r.comp_id, r.client_id,
              COALESCE((SELECT sum(allocated_amount) FROM payment_allocations pa WHERE pa.invoice_no = i.invoice_no), 0) AS already_allocated
       FROM invoices i JOIN records r ON r.record_id = i.record_id
       WHERE i.invoice_no = $1`,
      [a.invoiceNo]
    );
    const inv = rows[0];
    if (!inv) throw new Error(`Invoice ${a.invoiceNo} not found.`);
    if (inv.comp_id !== payment.comp_id || inv.client_id !== payment.client_id) {
      throw new Error(`Invoice ${a.invoiceNo} doesn't belong to this payment's client.`);
    }
    const remaining = Number(inv.invoice_total) - Number(inv.already_allocated);
    if (Number(a.amount) > remaining + 0.01) {
      throw new Error(
        `Allocation for ${a.invoiceNo} exceeds its remaining balance (₹${remaining.toFixed(2)}).`
      );
    }
  }

  for (const a of cleanAllocations) {
    const paId = await nextId("payment_allocations", "pa_id", "PYAL-");
    const { rows } = await pool.query("SELECT record_id FROM invoices WHERE invoice_no = $1", [a.invoiceNo]);
    await pool.query(
      `INSERT INTO payment_allocations (pa_id, comp_id, record_id, payment_id, invoice_no, allocated_amount, allocated_at, payment_status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'Paid')`,
      [paId, payment.comp_id, rows[0].record_id, pyId, a.invoiceNo, a.amount, allocationDate]
    );
  }
}

// Marking a payment allocation Rejected (e.g. a cheque bounced) means that
// money never actually landed — the invoice it was allocated to moves to its
// own "Rejected" lifecycle state (same one the Payment Progress field's
// "Rejected" option sets), regardless of its own payment status.
export async function rejectPaymentAllocation(pyId, invoiceNo) {
  const { rows } = await pool.query(
    "UPDATE payment_allocations SET payment_status = 'Rejected' WHERE payment_id = $1 AND invoice_no = $2 RETURNING pa_id",
    [pyId, invoiceNo]
  );
  if (rows.length === 0) throw new Error("Payment allocation not found.");
  await pool.query("UPDATE invoices SET status = 'Rejected', updated_at = now() WHERE invoice_no = $1", [
    invoiceNo,
  ]);
}

// Which invoices got paid isn't editable here — that means deleting and
// re-adding the payment — but each existing allocation's own amount is,
// e.g. correcting a typo without having to redo the whole payment.
// allocationEdits must name exactly the invoices this payment already has a
// row for (same set, no additions/removals); everything is validated and
// written in one transaction so a failure partway through leaves nothing
// changed.
export async function updatePayment(pyId, { paymentDate, remarks, amountReceived, allocationEdits }) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const { rows: existingRows } = await client.query(
      "SELECT invoice_no FROM payment_allocations WHERE payment_id = $1",
      [pyId]
    );
    const edits = allocationEdits || [];
    const existingInvoiceNos = new Set(existingRows.map((r) => r.invoice_no));
    const editedInvoiceNos = new Set(edits.map((a) => a.invoiceNo));
    if (
      existingInvoiceNos.size !== editedInvoiceNos.size ||
      [...existingInvoiceNos].some((no) => !editedInvoiceNos.has(no))
    ) {
      throw new Error("Can't add or remove invoices here — delete this payment and record it again for that.");
    }

    for (const a of edits) {
      if (Number(a.amount) <= 0) {
        throw new Error(`Amount for ${a.invoiceNo} must be greater than 0.`);
      }
    }

    const newTotalAllocated = edits.reduce((sum, a) => sum + Number(a.amount), 0);
    if (newTotalAllocated > Number(amountReceived) + 0.01) {
      throw new Error(`Allocated total (₹${newTotalAllocated.toFixed(2)}) can't exceed the amount received.`);
    }

    for (const a of edits) {
      const { rows: invRows } = await client.query(
        `SELECT i.invoice_total,
                COALESCE((SELECT sum(allocated_amount) FROM payment_allocations pa
                          WHERE pa.invoice_no = i.invoice_no AND pa.payment_id != $2), 0) AS allocated_elsewhere
         FROM invoices i WHERE i.invoice_no = $1`,
        [a.invoiceNo, pyId]
      );
      const inv = invRows[0];
      if (!inv) throw new Error(`Invoice ${a.invoiceNo} not found.`);
      const remaining = Number(inv.invoice_total) - Number(inv.allocated_elsewhere);
      if (Number(a.amount) > remaining + 0.01) {
        throw new Error(`Allocation for ${a.invoiceNo} can't exceed its balance (₹${remaining.toFixed(2)}).`);
      }
    }

    for (const a of edits) {
      await client.query(
        "UPDATE payment_allocations SET allocated_amount = $1 WHERE payment_id = $2 AND invoice_no = $3",
        [a.amount, pyId, a.invoiceNo]
      );
    }

    await client.query(
      "UPDATE payments SET payment_date = $1, remarks = $2, amount_received = $3, updated_at = now() WHERE py_id = $4",
      [paymentDate, remarks || null, Number(amountReceived), pyId]
    );

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export async function deletePayment(pyId) {
  await pool.query("DELETE FROM payment_allocations WHERE payment_id = $1", [pyId]);
  await pool.query("DELETE FROM payments WHERE py_id = $1", [pyId]);
}
