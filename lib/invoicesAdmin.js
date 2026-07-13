import { pool } from "./db";
import { nextId } from "./ids";
import { toDateString } from "./dates";

export async function listInvoices({ compId, clientId, search }) {
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
      `(description ILIKE ${p} OR client_name ILIKE ${p} OR invoice_no ILIKE ${p} OR po_no ILIKE ${p} OR status ILIKE ${p} OR lifecycle ILIKE ${p})`
    );
  }

  const { rows } = await pool.query(
    `
    WITH base AS (
      SELECT
        i.inv_id, i.invoice_no, i.invoice_date, i.description,
        i.invoice_amount, i.gst_percentage, i.gst_amount,
        i.tds_percentage, i.tds_amount, i.invoice_total,
        i.payment_mode, i.is_archived, i.po_no,
        r.record_id, r.comp_id,
        cl.client_id, cl.client_name,
        d.doc_id, d.file_name, d.document_type, d.external_url,
        CASE
          WHEN COALESCE(pa_sum.allocated, 0) <= 0 THEN 'Payment Pending'
          WHEN pa_sum.allocated >= i.invoice_total THEN 'Paid'
          ELSE 'Partial Paid'
        END AS status,
        CASE
          WHEN trim(lower(i.status)) LIKE '%canc%' THEN 'Cancelled'
          WHEN i.is_archived OR trim(lower(i.status)) LIKE '%archiv%' THEN 'Archived'
          ELSE 'Raised'
        END AS lifecycle
      FROM invoices i
      JOIN records r ON r.record_id = i.record_id
      JOIN clients cl ON cl.client_id = r.client_id
      LEFT JOIN documents d ON d.module_id = i.inv_id
      LEFT JOIN LATERAL (
        SELECT sum(allocated_amount) AS allocated
        FROM payment_allocations pa
        WHERE pa.invoice_no = i.invoice_no
      ) pa_sum ON true
    )
    SELECT * FROM base
    WHERE ${conditions.join(" AND ")}
    ORDER BY invoice_date DESC, inv_id DESC
    `,
    params
  );
  return rows;
}

// Multiple invoices per PO are allowed (partial billing), so every PO for
// the company is a valid pick — not just ones without an invoice yet.
export async function getPOsForPicker(compId, clientId) {
  const params = [compId];
  let clientFilter = "";
  if (clientId) {
    params.push(clientId);
    clientFilter = `AND r.client_id = $${params.length}`;
  }
  const { rows } = await pool.query(
    `
    SELECT po.po_id, po.po_no, po.po_date, po.description, po.amount, cl.client_name
    FROM purchase_orders po
    JOIN records r ON r.record_id = po.record_id
    JOIN clients cl ON cl.client_id = r.client_id
    WHERE r.comp_id = $1
      ${clientFilter}
    ORDER BY po.po_date DESC
    `,
    params
  );
  return rows;
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

export async function createInvoice({
  poId,
  invoiceNo,
  invoiceDate,
  description,
  invoiceAmount,
  gstPercentage,
  tdsPercentage,
}) {
  const { rows } = await pool.query(
    "SELECT record_id, po_no, po_date FROM purchase_orders WHERE po_id = $1",
    [poId]
  );
  if (!rows[0]) throw new Error("Purchase Order not found");
  const poDate = toDateString(rows[0].po_date);
  if (invoiceDate < poDate) {
    throw new Error(`Invoice date can't be before the PO date (${poDate}).`);
  }

  const { gstAmount, tdsAmount, total } = computeAmounts({
    invoiceAmount,
    gstPercentage,
    tdsPercentage,
  });

  const invId = await nextId("invoices", "inv_id", "INV-");
  await pool.query(
    `INSERT INTO invoices (
       inv_id, record_id, po_no, invoice_no, invoice_date, description,
       invoice_amount, gst_percentage, gst_amount, tds_percentage, tds_amount,
       invoice_total, status, payment_mode, created_at, updated_at
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'Raised', 'Detailed', now(), now())`,
    [
      invId,
      rows[0].record_id,
      rows[0].po_no,
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
// description/invoice_no/date stay editable.
export async function updateInvoice(
  invId,
  { invoiceNo, invoiceDate, description, invoiceAmount, gstPercentage, tdsPercentage }
) {
  const { rows } = await pool.query(
    `SELECT i.invoice_no, po.po_date
     FROM invoices i
     JOIN purchase_orders po ON po.po_no = i.po_no
     WHERE i.inv_id = $1`,
    [invId]
  );
  if (!rows[0]) throw new Error("Invoice not found");
  const poDate = toDateString(rows[0].po_date);
  if (invoiceDate < poDate) {
    throw new Error(`Invoice date can't be before the PO date (${poDate}).`);
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

export async function setInvoiceArchived(invId, archived) {
  if (archived) {
    const { rows } = await pool.query("SELECT invoice_no FROM invoices WHERE inv_id = $1", [invId]);
    const { rows: linked } = rows[0]
      ? await pool.query("SELECT 1 FROM payment_allocations WHERE invoice_no = $1", [
          rows[0].invoice_no,
        ])
      : { rows: [] };
    if (linked.length > 0) {
      throw new Error("This invoice has a payment allocated — archive the payment instead.");
    }
  }
  await pool.query("UPDATE invoices SET is_archived = $1, updated_at = now() WHERE inv_id = $2", [
    archived,
    invId,
  ]);
}
