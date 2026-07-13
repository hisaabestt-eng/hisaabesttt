import { pool } from "./db";
import { nextId } from "./ids";

// payments.client_id in the seed data uses a different (broken) ID scheme
// than clients.client_id, so client identity is derived through the
// allocation -> record -> client chain when possible. A brand-new payment
// with no allocations yet has no such chain, so it falls back to the
// payments row's own comp_id/client_id — which IS reliable for rows this
// app creates itself (only the old seed data's client_id is broken).
export async function listPayments({ compId, clientId, search }) {
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
      `(p.remarks ILIKE ${p} OR COALESCE(a.client_name, cl2.client_name) ILIKE ${p} OR a.invoice_nos_text ILIKE ${p})`
    );
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
    ORDER BY p.payment_date DESC, p.py_id DESC
    `,
    params
  );
  return rows;
}

// Standalone view of every invoice allocation (one row per payment+invoice
// pair) for the "Payment Allocations" page — separate from the payments
// ledger itself.
export async function listInvoiceAllocations({ compId, clientId, search }) {
  const conditions = ["r.comp_id = $1"];
  const params = [compId];

  if (clientId) {
    params.push(clientId);
    conditions.push(`r.client_id = $${params.length}`);
  }

  const words = search ? search.trim().split(/\s+/).filter(Boolean) : [];
  for (const word of words) {
    params.push(`%${word}%`);
    const p = `$${params.length}`;
    conditions.push(`(pi.invoice_no ILIKE ${p} OR cl.client_name ILIKE ${p})`);
  }

  const { rows } = await pool.query(
    `
    WITH per_invoice AS (
      SELECT payment_id, invoice_no, sum(allocated_amount) AS amount, min(allocated_at) AS allocated_at
      FROM payment_allocations
      GROUP BY payment_id, invoice_no
    ),
    invoice_totals AS (
      SELECT invoice_no, sum(allocated_amount) AS total_allocated
      FROM payment_allocations
      GROUP BY invoice_no
    ),
    running AS (
      -- Balance remaining ON THAT INVOICE right after this specific
      -- allocation was applied — a plain per-invoice total would repeat the
      -- same final number on every row and read like a subtraction error
      -- when an invoice was paid across more than one payment.
      SELECT
        payment_id, invoice_no, amount, allocated_at,
        sum(amount) OVER (
          PARTITION BY invoice_no
          ORDER BY allocated_at, payment_id
          ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
        ) AS cumulative_allocated
      FROM per_invoice
    )
    SELECT
      pi.payment_id AS py_id, pi.invoice_no, pi.amount, pi.allocated_at,
      i.invoice_total,
      i.invoice_total - pi.cumulative_allocated AS invoice_balance,
      r.comp_id, r.client_id, cl.client_name,
      CASE
        WHEN COALESCE(it.total_allocated, 0) <= 0 THEN 'Payment Pending'
        WHEN it.total_allocated >= i.invoice_total THEN 'Paid'
        ELSE 'Partial Paid'
      END AS status,
      CASE
        WHEN trim(lower(i.status)) LIKE '%canc%' THEN 'Cancelled'
        WHEN i.is_archived OR trim(lower(i.status)) LIKE '%archiv%' THEN 'Archived'
        ELSE 'Raised'
      END AS lifecycle
    FROM running pi
    JOIN invoices i ON i.invoice_no = pi.invoice_no
    JOIN records r ON r.record_id = i.record_id
    JOIN clients cl ON cl.client_id = r.client_id
    LEFT JOIN invoice_totals it ON it.invoice_no = pi.invoice_no
    WHERE ${conditions.join(" AND ")}
    ORDER BY pi.allocated_at DESC, pi.invoice_no
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

// Amount/allocations aren't editable here — correcting those means deleting
// and re-adding the payment, since reallocating safely needs more validation
// than a simple field edit.
export async function updatePayment(pyId, { paymentDate, remarks }) {
  await pool.query(
    `UPDATE payments SET payment_date = $1, remarks = $2, updated_at = now() WHERE py_id = $3`,
    [paymentDate, remarks || null, pyId]
  );
}

export async function deletePayment(pyId) {
  await pool.query("DELETE FROM payment_allocations WHERE payment_id = $1", [pyId]);
  await pool.query("DELETE FROM payments WHERE py_id = $1", [pyId]);
}
