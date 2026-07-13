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

export async function getRecordDetail(recordId) {
  const { rows } = await pool.query(
    `
    SELECT
      r.record_id,
      e.est_id, e.est_no, e.estimate_date, e.tags,
      po.po_id, po.po_no, po.po_date,
      inv.inv_id, inv.invoice_no, inv.invoice_date, inv.status AS invoice_status,
      inv.invoice_total, COALESCE(pa.total_allocated, 0) AS total_allocated
    FROM records r
    JOIN estimates e ON e.record_id = r.record_id
    LEFT JOIN purchase_orders po ON po.estimate_id = e.est_id
    LEFT JOIN LATERAL (
      SELECT * FROM invoices i
      WHERE i.po_no = po.po_no
      ORDER BY i.invoice_date DESC, i.inv_id DESC
      LIMIT 1
    ) inv ON true
    LEFT JOIN LATERAL (
      SELECT sum(allocated_amount) AS total_allocated
      FROM payment_allocations pa
      WHERE pa.invoice_no = inv.invoice_no
    ) pa ON true
    WHERE r.record_id = $1
    `,
    [recordId]
  );

  const row = rows[0];
  if (!row) return null;

  const moduleIds = [row.est_id, row.po_id, row.inv_id].filter(Boolean);
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

  let paymentStatus = null;
  if (row.inv_id && row.invoice_status !== "Cancled" && row.invoice_status !== "Cancelled") {
    const allocated = Number(row.total_allocated) || 0;
    const total = Number(row.invoice_total) || 0;
    if (allocated <= 0) paymentStatus = "Payment Pending";
    else if (allocated >= total) paymentStatus = "Paid";
    else paymentStatus = "Partial Paid";
  }

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
    invoice: row.inv_id
      ? {
          id: row.inv_id,
          no: row.invoice_no,
          date: row.invoice_date,
          status: row.invoice_status,
          document: docByModuleId[row.inv_id] || null,
        }
      : null,
    paymentStatus,
  };
}
