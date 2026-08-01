import { existsSync } from "fs";
import path from "path";
import { pool } from "./db";

// Mirrors the folder/name convention in lib/documents.js (saveDocument).
function resolveDocument(doc) {
  if (!doc) return null;
  const dir = doc.module.toLowerCase().replace(/\s+/g, "-");
  const storedName = `${doc.module_id}-${doc.file_name}`;
  const onDisk = existsSync(path.join(process.cwd(), "public", "uploads", dir, storedName));
  return { ...doc, publicPath: onDisk ? `/uploads/${dir}/${storedName}` : null };
}

// Mirrors the same Raised Not Submitted Yet -> In Progress/Scheduled ->
// Partial Paid/Paid state machine used everywhere else (see
// lib/invoicesAdmin.js), plus Rejected/Archived/Cancelled as their own
// terminal states.
function computePaymentStatus(inv) {
  const statusText = (inv.status || "").trim().toLowerCase();
  const allocated = Number(inv.total_allocated) || 0;
  const total = Number(inv.invoice_total) || 0;
  if (statusText.includes("reject")) return "Rejected";
  if (statusText.includes("canc")) return "Cancelled";
  if (inv.is_archived) return "Archived";
  if (allocated > 0 && allocated >= total) return "Paid";
  if (allocated > 0) return "Partial Paid";
  if (inv.submission_status && inv.submission_status !== "Not Submitted") {
    if (inv.scheduled_payment_date) return "Scheduled";
    if (inv.payment_pending) return "Payment Pending";
    return "In Progress";
  }
  return "Raised Not Submitted Yet";
}

// For the Payments page's "click an invoice number" popup — just the chain
// above one specific invoice (Estimate, PO if it went through one), not the
// full record detail with every sibling invoice, since a payment allocation
// only cares about the one invoice it was allocated to.
export async function getInvoiceChainDetail(invoiceNo) {
  const { rows } = await pool.query(
    `
    SELECT
      i.invoice_no, i.invoice_date,
      d.doc_id, d.module, d.module_id, d.file_name, d.external_url,
      e.est_no, e.estimate_date, e.description AS estimate_description,
      po.po_no, po.po_date
    FROM invoices i
    LEFT JOIN purchase_orders po ON po.po_no = i.po_no
    LEFT JOIN estimates e ON e.est_id = COALESCE(i.est_id, po.estimate_id)
    LEFT JOIN documents d ON d.module_id = i.inv_id
    WHERE i.invoice_no = $1
    `,
    [invoiceNo]
  );
  const row = rows[0];
  if (!row) return null;

  const document = row.external_url
    ? { external_url: row.external_url }
    : resolveDocument(
        row.doc_id ? { doc_id: row.doc_id, module: row.module, module_id: row.module_id, file_name: row.file_name } : null
      );

  return {
    invoiceNo: row.invoice_no,
    invoiceDate: row.invoice_date,
    estimateNo: row.est_no,
    estimateDate: row.estimate_date,
    estimateDescription: row.estimate_description,
    poNo: row.po_no,
    poDate: row.po_date,
    document,
  };
}

export async function getRecordDetail(recordId) {
  const { rows } = await pool.query(
    `
    SELECT
      r.record_id,
      e.est_id, e.est_no, e.estimate_date, e.tags,
      po.po_id, po.po_no, po.po_date
    FROM records r
    JOIN estimates e ON e.record_id = r.record_id
    LEFT JOIN purchase_orders po ON po.estimate_id = e.est_id
    WHERE r.record_id = $1
    `,
    [recordId]
  );

  const row = rows[0];
  if (!row) return null;

  // A record's invoices come from either its PO or (for clients who skip PO)
  // straight off the Estimate — mutually exclusive, same as everywhere else
  // in the app — and there can be more than one (partial billing).
  const { rows: invoiceRows } = await pool.query(
    `
    SELECT i.inv_id, i.invoice_no, i.invoice_date, i.status, i.is_archived,
           i.submission_status, i.scheduled_payment_date, i.payment_pending, i.invoice_total,
           COALESCE(pa.total_allocated, 0) AS total_allocated
    FROM invoices i
    LEFT JOIN LATERAL (
      SELECT sum(allocated_amount) AS total_allocated
      FROM payment_allocations pa
      WHERE pa.invoice_no = i.invoice_no
    ) pa ON true
    WHERE i.${row.po_no ? "po_no" : "est_id"} = $1
    ORDER BY i.invoice_date ASC, i.inv_id ASC
    `,
    [row.po_no || row.est_id]
  );

  const moduleIds = [row.est_id, row.po_id, ...invoiceRows.map((i) => i.inv_id)].filter(Boolean);
  const { rows: docs } = moduleIds.length
    ? await pool.query(
        `SELECT module, module_id, file_name, document_type, uploaded_by, external_url, created_at
         FROM documents WHERE module_id = ANY($1::text[])`,
        [moduleIds]
      )
    : { rows: [] };
  const docByModuleId = Object.fromEntries(
    docs.map((d) => [d.module_id, resolveDocument(d)])
  );

  const invoices = invoiceRows.map((inv) => ({
    id: inv.inv_id,
    no: inv.invoice_no,
    date: inv.invoice_date,
    status: inv.status,
    document: docByModuleId[inv.inv_id] || null,
    paymentStatus: computePaymentStatus(inv),
  }));

  return {
    recordId: row.record_id,
    estimate: {
      id: row.est_id,
      no: row.est_no,
      date: row.estimate_date,
      tags: row.tags,
      document: docByModuleId[row.est_id] || null,
    },
    po: row.po_id
      ? {
          id: row.po_id,
          no: row.po_no,
          date: row.po_date,
          document: docByModuleId[row.po_id] || null,
        }
      : null,
    invoices,
  };
}
