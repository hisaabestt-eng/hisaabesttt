import { pool } from "./db";
import { nextId } from "./ids";
import { parseFlexibleDate } from "./dates";

// Same status chain as the Main page, plus "Estimate Pending" — Records
// shows every record, including ones that don't have an estimate yet.
const RECORDS_STATUS_CTE = `
  WITH base AS (
    SELECT
      r.record_id, r.record_date, r.description, r.amount, r.comp_id, r.is_archived, r.custom_status,
      cl.client_id, cl.client_name,
      e.est_id, e.est_no,
      po.po_id, po.po_no,
      -- Lets search find a record by any one of its invoice numbers too —
      -- a record with several invoices (partial billing) should surface for
      -- a search on any single one of them, not just its Estimate/PO No.
      CASE WHEN po.po_id IS NOT NULL THEN inv_stats.invoice_nos_text ELSE direct_inv.invoice_nos_text END
        AS invoice_nos_text,
      CASE
        WHEN e.est_id IS NULL THEN 'Estimate Pending'
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
        WHEN trim(lower(r.overall_status)) LIKE '%canc%' THEN 'Cancelled'
        WHEN r.is_archived OR trim(lower(r.overall_status)) LIKE '%archiv%' THEN 'Archived'
        ELSE 'Raised'
      END AS lifecycle
    FROM records r
    JOIN clients cl ON cl.client_id = r.client_id
    LEFT JOIN estimates e ON e.record_id = r.record_id
    LEFT JOIN purchase_orders po ON po.estimate_id = e.est_id
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
      -- Invoices raised straight off the Estimate, skipping the PO step.
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
`;

export async function getRecordYears(compId) {
  const { rows } = await pool.query(
    `SELECT DISTINCT EXTRACT(YEAR FROM record_date)::int AS year
     FROM records WHERE comp_id = $1 ORDER BY year DESC`,
    [compId]
  );
  return rows.map((r) => r.year);
}

// Powers the single-record chain-editing page — reuses the same status CTE
// as listRecords() so it's never possible for this page to disagree with the
// list pages about a record's status/lifecycle.
export async function getRecordById(recordId) {
  const { rows } = await pool.query(
    `${RECORDS_STATUS_CTE} SELECT * FROM base WHERE record_id = $1`,
    [recordId]
  );
  return rows[0] || null;
}

export async function listRecords({ compId, clientId, search, progress, year, yearType }) {
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
      `(record_id ILIKE ${p} OR description ILIKE ${p} OR client_name ILIKE ${p} OR est_no ILIKE ${p} OR po_no ILIKE ${p} OR invoice_nos_text ILIKE ${p} OR status ILIKE ${p} OR lifecycle ILIKE ${p} OR amount::text ILIKE ${p})`
    );
  }

  if (progress && progress.length > 0) {
    params.push(progress);
    conditions.push(
      `(CASE WHEN custom_status IS NOT NULL THEN custom_status WHEN lifecycle = 'Archived' THEN 'Record Archived' WHEN lifecycle = 'Cancelled' THEN 'Record Cancelled' ELSE status END) = ANY($${params.length})`
    );
  }

  if (year) {
    if (yearType === "fy") {
      params.push(`${year}-04-01`);
      conditions.push(`record_date >= $${params.length}::date`);
      params.push(`${Number(year) + 1}-03-31`);
      conditions.push(`record_date <= $${params.length}::date`);
    } else {
      params.push(`${year}-01-01`);
      conditions.push(`record_date >= $${params.length}::date`);
      params.push(`${year}-12-31`);
      conditions.push(`record_date <= $${params.length}::date`);
    }
  }

  const { rows } = await pool.query(
    `
    ${RECORDS_STATUS_CTE}
    SELECT * FROM base
    WHERE ${conditions.join(" AND ")}
    ORDER BY record_date ASC, record_id ASC
    `,
    params
  );
  return rows;
}

export async function getRecordsWithoutEstimate(compId, clientId) {
  const params = [compId];
  let clientFilter = "";
  if (clientId) {
    params.push(clientId);
    clientFilter = `AND r.client_id = $${params.length}`;
  }
  const { rows } = await pool.query(
    `
    SELECT r.record_id, r.record_date, r.description, r.amount, r.client_id, cl.client_name
    FROM records r
    JOIN clients cl ON cl.client_id = r.client_id
    WHERE r.comp_id = $1
      AND NOT EXISTS (SELECT 1 FROM estimates e WHERE e.record_id = r.record_id)
      ${clientFilter}
    ORDER BY r.record_date DESC
    `,
    params
  );
  return rows;
}

// Only show clients that already have a record under this company, plus
// brand-new clients with no records anywhere yet — a company's picker
// shouldn't be flooded with every other company's clients. To reuse the
// same client name under a different company, add it again via "+ New".
export async function getClientsForCompanyPicker(compId) {
  const { rows } = await pool.query(
    "SELECT client_id, client_name FROM clients WHERE status = 'Active' AND comp_id = $1 ORDER BY client_name",
    [compId]
  );
  return rows;
}

export async function createClient(clientName, compId) {
  const clientId = await nextId("clients", "client_id", "CL-");
  await pool.query(
    `INSERT INTO clients (client_id, comp_id, client_name, status, created_at, updated_at)
     VALUES ($1, $2, $3, 'Active', now(), now())`,
    [clientId, compId, clientName]
  );
  return clientId;
}

export async function createRecord({ compId, clientId, recordDate, description, amount }) {
  const recordId = await nextId("records", "record_id", "RC-");
  await pool.query(
    `INSERT INTO records (record_id, record_date, comp_id, client_id, description, amount, overall_status, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, 'Raised', now(), now())`,
    [recordId, recordDate, compId, clientId, description, amount]
  );
  return recordId;
}

// Once a Purchase Order exists downstream, the amount is locked — it now
// flows from Estimate -> Record instead of being edited here directly.
// While only an Estimate exists (no PO yet), the amount stays two-way synced.
export async function updateRecord(recordId, { recordDate, description, amount, customStatus }) {
  const { rows } = await pool.query(
    `SELECT e.est_id, po.po_id
     FROM records r
     LEFT JOIN estimates e ON e.record_id = r.record_id
     LEFT JOIN purchase_orders po ON po.estimate_id = e.est_id
     WHERE r.record_id = $1`,
    [recordId]
  );
  const estId = rows[0]?.est_id;
  const hasPO = Boolean(rows[0]?.po_id);

  if (hasPO) {
    await pool.query(
      `UPDATE records SET record_date = $1, description = $2, updated_at = now() WHERE record_id = $3`,
      [recordDate, description, recordId]
    );
  } else {
    await pool.query(
      `UPDATE records SET record_date = $1, description = $2, amount = $3, updated_at = now()
       WHERE record_id = $4`,
      [recordDate, description, amount, recordId]
    );
    if (estId) {
      await pool.query("UPDATE estimates SET amount = $1, updated_at = now() WHERE est_id = $2", [
        amount,
        estId,
      ]);
    }
  }

  await pool.query("UPDATE records SET custom_status = $1, updated_at = now() WHERE record_id = $2", [
    customStatus || null,
    recordId,
  ]);
}

export async function deleteRecord(recordId) {
  const { rows } = await pool.query("SELECT 1 FROM estimates WHERE record_id = $1", [recordId]);
  if (rows.length > 0) {
    throw new Error("This record already has an estimate — remove that first.");
  }
  await pool.query("DELETE FROM records WHERE record_id = $1", [recordId]);
}

// Only the most-downstream stage can be archived — if an estimate already
// exists, archive that instead of the record underneath it.
export async function setRecordArchived(recordId, archived) {
  if (archived) {
    const { rows } = await pool.query("SELECT 1 FROM estimates WHERE record_id = $1", [recordId]);
    if (rows.length > 0) {
      throw new Error("This record has an estimate — archive the estimate instead.");
    }
  }
  await pool.query("UPDATE records SET is_archived = $1, updated_at = now() WHERE record_id = $2", [
    archived,
    recordId,
  ]);
}

// Bulk-import records from an uploaded spreadsheet. Every row is validated
// first, with no writes at all — if even one row has a mistake, the whole
// file is rejected (nothing partially saved) and every problem found is
// reported at once (row number + field + reason) so it can be fixed in one pass.
export async function bulkCreateRecords({ compId, rows }) {
  // Same "reuse across this company, or a brand-new name" rule as the
  // regular Add Record client picker (getClientsForCompanyPicker).
  const validClients = await getClientsForCompanyPicker(compId);
  const clientIdByName = new Map(
    validClients.map((c) => [c.client_name.trim().toLowerCase(), c.client_id])
  );

  const errors = [];
  const parsed = [];

  rows.forEach((row, i) => {
    const rowNum = i + 2; // row 1 is the header
    const clientName = (row.clientName ?? "").toString().trim();
    const description = (row.description ?? "").toString().trim();
    const amountRaw = row.amount;
    const dateRaw = row.recordDate;

    if (!clientName) {
      errors.push({ row: rowNum, field: "Client Name", message: "Client Name is required." });
    }
    if (!description) {
      errors.push({ row: rowNum, field: "Description", message: "Description is required." });
    }

    if (dateRaw === undefined || dateRaw === null || dateRaw === "") {
      errors.push({ row: rowNum, field: "Record Date", message: "Record Date is required." });
    } else {
      const recordDate = parseFlexibleDate(dateRaw);
      if (!recordDate) {
        errors.push({
          row: rowNum,
          field: "Record Date",
          message: `"${dateRaw}" is not a valid date — use YYYY-MM-DD or DD/MM/YYYY.`,
        });
      }
    }

    if (amountRaw === undefined || amountRaw === null || amountRaw === "") {
      errors.push({ row: rowNum, field: "Amount", message: "Amount is required." });
    } else if (!Number.isFinite(Number(amountRaw)) || Number(amountRaw) < 0) {
      errors.push({
        row: rowNum,
        field: "Amount",
        message: `"${amountRaw}" is not a valid positive number.`,
      });
    }

    parsed.push({
      rowNum,
      clientName,
      description,
      recordDate: parseFlexibleDate(dateRaw),
      amount: Number(amountRaw),
    });
  });

  if (rows.length === 0) {
    return { ok: false, errors: [{ row: "-", field: "File", message: "No rows found in this file." }] };
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  // All rows are valid — now actually write them, inside one transaction so
  // an unexpected failure partway through still leaves nothing behind.
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (const row of parsed) {
      const key = row.clientName.toLowerCase();
      let clientId = clientIdByName.get(key);
      if (!clientId) {
        const { rows: idRows } = await client.query(
          `SELECT COALESCE(MAX((regexp_match(client_id, '(\\d+)$'))[1]::int), 0) + 1 AS next FROM clients`
        );
        clientId = `CL-${String(idRows[0].next).padStart(4, "0")}`;
        await client.query(
          `INSERT INTO clients (client_id, comp_id, client_name, status, created_at, updated_at)
           VALUES ($1, $2, $3, 'Active', now(), now())`,
          [clientId, compId, row.clientName]
        );
        clientIdByName.set(key, clientId);
      }

      const { rows: idRows2 } = await client.query(
        `SELECT COALESCE(MAX((regexp_match(record_id, '(\\d+)$'))[1]::int), 0) + 1 AS next FROM records`
      );
      const recordId = `RC-${String(idRows2[0].next).padStart(4, "0")}`;
      await client.query(
        `INSERT INTO records (record_id, record_date, comp_id, client_id, description, amount, overall_status, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, 'Raised', now(), now())`,
        [recordId, row.recordDate, compId, clientId, row.description, row.amount]
      );
    }
    await client.query("COMMIT");
    return { ok: true, created: parsed.length };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}
