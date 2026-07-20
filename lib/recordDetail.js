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
    return inv.scheduled_payment_date ? "Scheduled" : "In Progress";
  }
  return "Raised Not Submitted Yet";
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
           i.submission_status, i.scheduled_payment_date, i.invoice_total,
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
