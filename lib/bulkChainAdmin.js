import { pool } from "./db";
import { nextId } from "./ids";
import { toDateString, parseFlexibleDate } from "./dates";
import { getClientsForCompanyPicker } from "./recordsAdmin";

function isBlank(v) {
  return v === undefined || v === null || v === "";
}

async function insertDocumentLink(client, { module, compId, recordId, moduleId, url }) {
  const docId = await nextId("documents", "doc_id", "DOC-", 4, client);
  await client.query(
    `INSERT INTO documents (doc_id, module, comp_id, record_id, module_id, file_name, document_type, uploaded_by, external_url, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, 'External Link', 'Link', 'System', $6, now(), now())`,
    [docId, module, compId, recordId, moduleId, url]
  );
}

// Bulk-import a full Record -> Estimate -> PO -> Invoice chain from one
// spreadsheet, one row per deal. A row can stop at any stage (Record only,
// Record+Estimate, ...up to the full chain) — it just can't skip a stage
// (e.g. a PO with no Estimate columns filled in is an error, not "no PO").
// Every row across the whole file is validated before anything is written;
// one bad row rejects the entire upload, matching the Records bulk upload.
export async function bulkCreateChain({ compId, rows }) {
  if (!Array.isArray(rows) || rows.length === 0) {
    return { ok: false, errors: [{ row: "-", field: "File", message: "No rows found in this file." }] };
  }

  const validClients = await getClientsForCompanyPicker(compId);
  const clientIdByName = new Map(
    validClients.map((c) => [c.client_name.trim().toLowerCase(), c.client_id])
  );

  const { rows: existingNos } = await pool.query(
    `SELECT
       (SELECT array_agg(est_no) FROM estimates) AS est_nos,
       (SELECT array_agg(po_no) FROM purchase_orders) AS po_nos,
       (SELECT array_agg(invoice_no) FROM invoices) AS invoice_nos`
  );
  const existingEstNos = new Set((existingNos[0].est_nos || []).map((v) => v.toLowerCase()));
  const existingPoNos = new Set((existingNos[0].po_nos || []).map((v) => v.toLowerCase()));
  const existingInvoiceNos = new Set((existingNos[0].invoice_nos || []).map((v) => v.toLowerCase()));
  const seenEstNos = new Set();
  const seenPoNos = new Set();
  const seenInvoiceNos = new Set();

  const errors = [];
  const parsed = [];

  rows.forEach((row, i) => {
    const rowNum = i + 2;
    const err = (field, message) => errors.push({ row: rowNum, field, message });

    const clientName = (row.clientName ?? "").toString().trim();
    const description = (row.description ?? "").toString().trim();
    const amountRaw = row.amount;
    const recordDateRaw = row.recordDate;

    if (!clientName) err("Client Name", "Client Name is required.");
    if (!description) err("Description", "Description is required.");

    let recordDate = null;
    if (isBlank(recordDateRaw)) {
      err("Record Date", "Record Date is required.");
    } else {
      recordDate = parseFlexibleDate(recordDateRaw);
      if (!recordDate) err("Record Date", `"${recordDateRaw}" is not a valid date — use YYYY-MM-DD or DD/MM/YYYY.`);
    }

    let amount = null;
    if (isBlank(amountRaw)) {
      err("Amount", "Amount is required.");
    } else {
      amount = Number(amountRaw);
      if (!Number.isFinite(amount) || amount < 0) {
        err("Amount", `"${amountRaw}" is not a valid positive number.`);
      }
    }

    // --- Estimate (optional stage) ---
    const estNo = (row.estNo ?? "").toString().trim();
    const estDateRaw = row.estDate;
    const hasEstNo = !isBlank(row.estNo);
    const hasEstDate = !isBlank(estDateRaw);
    let estDate = null;
    let hasEstimate = false;

    if (hasEstNo !== hasEstDate) {
      err("Estimate No / Estimate Date", "Both Estimate No and Estimate Date must be given together.");
    } else if (hasEstNo && hasEstDate) {
      hasEstimate = true;
      estDate = parseFlexibleDate(estDateRaw);
      if (!estDate) {
        err("Estimate Date", `"${estDateRaw}" is not a valid date — use YYYY-MM-DD or DD/MM/YYYY.`);
      } else if (recordDate && estDate < recordDate) {
        err("Estimate Date", "Estimate Date can't be before the Record Date.");
      }
      const key = estNo.toLowerCase();
      if (!estNo) {
        err("Estimate No", "Estimate No is required when Estimate Date is given.");
      } else if (existingEstNos.has(key) || seenEstNos.has(key)) {
        err("Estimate No", `"${estNo}" is already used by another estimate.`);
      } else {
        seenEstNos.add(key);
      }
    }

    // --- PO (optional stage, needs Estimate) ---
    const poNo = (row.poNo ?? "").toString().trim();
    const poDateRaw = row.poDate;
    const hasPoNo = !isBlank(row.poNo);
    const hasPoDate = !isBlank(poDateRaw);
    let poDate = null;
    let hasPO = false;

    if (hasPoNo !== hasPoDate) {
      err("PO No / PO Date", "Both PO No and PO Date must be given together.");
    } else if (hasPoNo && hasPoDate) {
      if (!hasEstimate) {
        err("PO No", "A PO needs an Estimate No/Date on the same row first.");
      } else {
        hasPO = true;
        poDate = parseFlexibleDate(poDateRaw);
        if (!poDate) {
          err("PO Date", `"${poDateRaw}" is not a valid date — use YYYY-MM-DD or DD/MM/YYYY.`);
        } else if (estDate && poDate < estDate) {
          err("PO Date", "PO Date can't be before the Estimate Date.");
        }
        const key = poNo.toLowerCase();
        if (!poNo) {
          err("PO No", "PO No is required when PO Date is given.");
        } else if (existingPoNos.has(key) || seenPoNos.has(key)) {
          err("PO No", `"${poNo}" is already used by another purchase order.`);
        } else {
          seenPoNos.add(key);
        }
      }
    }

    // --- Invoice (optional stage, needs PO) ---
    const invoiceNo = (row.invoiceNo ?? "").toString().trim();
    const invoiceDateRaw = row.invoiceDate;
    const invoiceAmountRaw = row.invoiceAmount;
    const hasAnyInvoiceField = !isBlank(row.invoiceNo) || !isBlank(invoiceDateRaw) || !isBlank(invoiceAmountRaw);
    let invoiceDate = null;
    let invoiceAmount = null;
    let hasInvoice = false;

    if (hasAnyInvoiceField) {
      const missing = [];
      if (isBlank(row.invoiceNo)) missing.push("Invoice No");
      if (isBlank(invoiceDateRaw)) missing.push("Invoice Date");
      if (isBlank(invoiceAmountRaw)) missing.push("Invoice Amount");
      if (missing.length > 0) {
        err("Invoice", `${missing.join(", ")} also required when raising an invoice.`);
      } else if (!hasPO) {
        err("Invoice No", "An Invoice needs a PO No/Date on the same row first.");
      } else {
        hasInvoice = true;
        invoiceDate = parseFlexibleDate(invoiceDateRaw);
        if (!invoiceDate) {
          err("Invoice Date", `"${invoiceDateRaw}" is not a valid date — use YYYY-MM-DD or DD/MM/YYYY.`);
        } else if (poDate && invoiceDate < poDate) {
          err("Invoice Date", "Invoice Date can't be before the PO Date.");
        }
        const key = invoiceNo.toLowerCase();
        if (!invoiceNo) {
          err("Invoice No", "Invoice No is required.");
        } else if (existingInvoiceNos.has(key) || seenInvoiceNos.has(key)) {
          err("Invoice No", `"${invoiceNo}" is already used by another invoice.`);
        } else {
          seenInvoiceNos.add(key);
        }

        invoiceAmount = Number(invoiceAmountRaw);
        if (!Number.isFinite(invoiceAmount) || invoiceAmount < 0) {
          err("Invoice Amount", `"${invoiceAmountRaw}" is not a valid positive number.`);
        } else if (amount !== null && invoiceAmount > amount + 0.01) {
          err(
            "Invoice Amount",
            `Invoice Amount (${invoiceAmount}) can't exceed the PO Amount (${amount}).`
          );
        }
      }
    }

    let gstPct = 18;
    let tdsPct = 2;
    if (hasInvoice) {
      if (!isBlank(row.gstPct)) {
        gstPct = Number(row.gstPct);
        if (!Number.isFinite(gstPct) || gstPct < 0) err("GST %", `"${row.gstPct}" is not a valid percentage.`);
      }
      if (!isBlank(row.tdsPct)) {
        tdsPct = Number(row.tdsPct);
        if (!Number.isFinite(tdsPct) || tdsPct < 0) err("TDS %", `"${row.tdsPct}" is not a valid percentage.`);
      }
    }

    if (!isBlank(row.estDocLink) && !hasEstimate) {
      err("Estimate Document Link", "Given but no Estimate No/Date on this row.");
    }
    if (!isBlank(row.poDocLink) && !hasPO) {
      err("PO Document Link", "Given but no PO No/Date on this row.");
    }
    if (!isBlank(row.invoiceDocLink) && !hasInvoice) {
      err("Invoice Document Link", "Given but no Invoice No/Date/Amount on this row.");
    }

    parsed.push({
      rowNum,
      clientName,
      description,
      recordDate,
      amount,
      hasEstimate,
      estNo,
      estDate,
      estDocLink: (row.estDocLink ?? "").toString().trim() || null,
      hasPO,
      poNo,
      poDate,
      poDocLink: (row.poDocLink ?? "").toString().trim() || null,
      hasInvoice,
      invoiceNo,
      invoiceDate,
      invoiceAmount,
      gstPct,
      tdsPct,
      invoiceDocLink: (row.invoiceDocLink ?? "").toString().trim() || null,
    });
  });

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    let recordCount = 0;
    let estimateCount = 0;
    let poCount = 0;
    let invoiceCount = 0;

    for (const row of parsed) {
      const key = row.clientName.toLowerCase();
      let clientId = clientIdByName.get(key);
      if (!clientId) {
        clientId = await nextId("clients", "client_id", "CL-", 4, client);
        await client.query(
          `INSERT INTO clients (client_id, comp_id, client_name, status, created_at, updated_at)
           VALUES ($1, $2, $3, 'Active', now(), now())`,
          [clientId, compId, row.clientName]
        );
        clientIdByName.set(key, clientId);
      }

      const recordId = await nextId("records", "record_id", "RC-", 4, client);
      await client.query(
        `INSERT INTO records (record_id, record_date, comp_id, client_id, description, amount, overall_status, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, 'Raised', now(), now())`,
        [recordId, row.recordDate, compId, clientId, row.description, row.amount]
      );
      recordCount++;

      if (!row.hasEstimate) continue;
      const estId = await nextId("estimates", "est_id", "EST-", 4, client);
      const monthYearTag = (() => {
        const d = new Date(row.estDate);
        const month = d.toLocaleDateString("en-US", { month: "long", timeZone: "UTC" });
        return `[${month},${d.getUTCFullYear()}]`;
      })();
      await client.query(
        `INSERT INTO estimates (est_id, record_id, est_no, estimate_date, description, amount, status, tags, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, 'Draft', $7, now(), now())`,
        [estId, recordId, row.estNo, row.estDate, row.description, row.amount, monthYearTag]
      );
      estimateCount++;
      if (row.estDocLink) {
        await insertDocumentLink(client, {
          module: "Estimate",
          compId,
          recordId,
          moduleId: estId,
          url: row.estDocLink,
        });
      }

      if (!row.hasPO) continue;
      const poId = await nextId("purchase_orders", "po_id", "PO-", 4, client);
      await client.query(
        `INSERT INTO purchase_orders (po_id, record_id, estimate_id, po_no, po_date, description, amount, status, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'Raised', now(), now())`,
        [poId, recordId, estId, row.poNo, row.poDate, row.description, row.amount]
      );
      poCount++;
      if (row.poDocLink) {
        await insertDocumentLink(client, {
          module: "Purchase Order",
          compId,
          recordId,
          moduleId: poId,
          url: row.poDocLink,
        });
      }

      if (!row.hasInvoice) continue;
      const gstAmount = Math.round(row.invoiceAmount * (row.gstPct / 100) * 100) / 100;
      const tdsAmount = Math.round(row.invoiceAmount * (row.tdsPct / 100) * 100) / 100;
      const invoiceTotal = Math.round((row.invoiceAmount + gstAmount - tdsAmount) * 100) / 100;
      const invId = await nextId("invoices", "inv_id", "INV-", 4, client);
      await client.query(
        `INSERT INTO invoices (
           inv_id, record_id, po_no, invoice_no, invoice_date, description,
           invoice_amount, gst_percentage, gst_amount, tds_percentage, tds_amount,
           invoice_total, status, payment_mode, created_at, updated_at
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'Raised', 'Detailed', now(), now())`,
        [
          invId,
          recordId,
          row.poNo,
          row.invoiceNo,
          row.invoiceDate,
          row.description,
          row.invoiceAmount,
          row.gstPct / 100,
          gstAmount,
          row.tdsPct / 100,
          tdsAmount,
          invoiceTotal,
        ]
      );
      invoiceCount++;
      if (row.invoiceDocLink) {
        await insertDocumentLink(client, {
          module: "Invoice",
          compId,
          recordId,
          moduleId: invId,
          url: row.invoiceDocLink,
        });
      }
    }

    await client.query("COMMIT");
    return { ok: true, recordCount, estimateCount, poCount, invoiceCount };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

// Standalone bulk upload: adds Estimates to Records that already exist and
// don't have one yet (referenced by Record ID) — for the ongoing case of
// adding one stage at a time, as opposed to bulkCreateChain's "whole deal in
// one row" historical-import case. Same all-or-nothing validation rule.
export async function bulkCreateEstimates({ compId, rows }) {
  if (!Array.isArray(rows) || rows.length === 0) {
    return { ok: false, errors: [{ row: "-", field: "File", message: "No rows found in this file." }] };
  }

  const { rows: existingEstNoRows } = await pool.query("SELECT est_no FROM estimates");
  const existingEstNos = new Set(existingEstNoRows.map((r) => r.est_no.toLowerCase()));
  const seenEstNos = new Set();
  const seenRecordIds = new Set();

  const errors = [];
  const parsed = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 2;
    const err = (field, message) => errors.push({ row: rowNum, field, message });

    const recordId = (row.recordId ?? "").toString().trim();
    const estNo = (row.estNo ?? "").toString().trim();
    const description = (row.description ?? "").toString().trim();

    let record = null;
    if (!recordId) {
      err("Record ID", "Record ID is required.");
    } else {
      const { rows: recRows } = await pool.query(
        `SELECT r.record_id, r.record_date, r.comp_id,
                EXISTS(SELECT 1 FROM estimates e WHERE e.record_id = r.record_id) AS has_estimate
         FROM records r WHERE r.record_id = $1`,
        [recordId]
      );
      record = recRows[0];
      if (!record) {
        err("Record ID", `"${recordId}" does not exist.`);
      } else if (record.comp_id !== compId) {
        err("Record ID", `"${recordId}" belongs to a different company.`);
      } else if (record.has_estimate) {
        err("Record ID", `"${recordId}" already has an estimate.`);
      } else if (seenRecordIds.has(recordId)) {
        err("Record ID", `"${recordId}" is used more than once in this file.`);
      } else {
        seenRecordIds.add(recordId);
      }
    }

    if (!estNo) {
      err("Estimate No", "Estimate No is required.");
    } else {
      const key = estNo.toLowerCase();
      if (existingEstNos.has(key) || seenEstNos.has(key)) {
        err("Estimate No", `"${estNo}" is already used by another estimate.`);
      } else {
        seenEstNos.add(key);
      }
    }

    let estDate = null;
    if (isBlank(row.estDate)) {
      err("Estimate Date", "Estimate Date is required.");
    } else {
      estDate = parseFlexibleDate(row.estDate);
      if (!estDate) {
        err("Estimate Date", `"${row.estDate}" is not a valid date — use YYYY-MM-DD or DD/MM/YYYY.`);
      } else if (record && estDate < toDateString(record.record_date)) {
        err("Estimate Date", "Estimate Date can't be before the Record Date.");
      }
    }

    if (!description) err("Description", "Description is required.");

    let amount = null;
    if (isBlank(row.amount)) {
      err("Amount", "Amount is required.");
    } else {
      amount = Number(row.amount);
      if (!Number.isFinite(amount) || amount < 0) {
        err("Amount", `"${row.amount}" is not a valid positive number.`);
      }
    }

    parsed.push({
      rowNum,
      recordId,
      estNo,
      estDate,
      description,
      amount,
      docLink: (row.docLink ?? "").toString().trim() || null,
    });
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (const row of parsed) {
      const estId = await nextId("estimates", "est_id", "EST-", 4, client);
      const d = new Date(row.estDate);
      const monthYearTag = `[${d.toLocaleDateString("en-US", { month: "long", timeZone: "UTC" })},${d.getUTCFullYear()}]`;
      await client.query(
        `INSERT INTO estimates (est_id, record_id, est_no, estimate_date, description, amount, status, tags, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, 'Draft', $7, now(), now())`,
        [estId, row.recordId, row.estNo, row.estDate, row.description, row.amount, monthYearTag]
      );
      await client.query("UPDATE records SET amount = $1, updated_at = now() WHERE record_id = $2", [
        row.amount,
        row.recordId,
      ]);
      if (row.docLink) {
        await insertDocumentLink(client, {
          module: "Estimate",
          compId,
          recordId: row.recordId,
          moduleId: estId,
          url: row.docLink,
        });
      }
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

// Standalone bulk upload: adds POs to Estimates that already exist and don't
// have one yet (referenced by Estimate No).
export async function bulkCreatePOs({ compId, rows }) {
  if (!Array.isArray(rows) || rows.length === 0) {
    return { ok: false, errors: [{ row: "-", field: "File", message: "No rows found in this file." }] };
  }

  const { rows: existingPoNoRows } = await pool.query("SELECT po_no FROM purchase_orders");
  const existingPoNos = new Set(existingPoNoRows.map((r) => r.po_no.toLowerCase()));
  const seenPoNos = new Set();
  const seenEstNos = new Set();

  const errors = [];
  const parsed = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 2;
    const err = (field, message) => errors.push({ row: rowNum, field, message });

    const estNo = (row.estNo ?? "").toString().trim();
    const poNo = (row.poNo ?? "").toString().trim();
    const description = (row.description ?? "").toString().trim();

    let estimate = null;
    if (!estNo) {
      err("Estimate No", "Estimate No is required.");
    } else {
      const { rows: estRows } = await pool.query(
        `SELECT e.est_id, e.estimate_date, e.record_id, r.comp_id,
                EXISTS(SELECT 1 FROM purchase_orders po WHERE po.estimate_id = e.est_id) AS has_po
         FROM estimates e JOIN records r ON r.record_id = e.record_id
         WHERE e.est_no = $1`,
        [estNo]
      );
      estimate = estRows[0];
      if (!estimate) {
        err("Estimate No", `"${estNo}" does not exist.`);
      } else if (estimate.comp_id !== compId) {
        err("Estimate No", `"${estNo}" belongs to a different company.`);
      } else if (estimate.has_po) {
        err("Estimate No", `"${estNo}" already has a PO.`);
      } else if (seenEstNos.has(estNo.toLowerCase())) {
        err("Estimate No", `"${estNo}" is used more than once in this file.`);
      } else {
        seenEstNos.add(estNo.toLowerCase());
      }
    }

    if (!poNo) {
      err("PO No", "PO No is required.");
    } else {
      const key = poNo.toLowerCase();
      if (existingPoNos.has(key) || seenPoNos.has(key)) {
        err("PO No", `"${poNo}" is already used by another purchase order.`);
      } else {
        seenPoNos.add(key);
      }
    }

    let poDate = null;
    if (isBlank(row.poDate)) {
      err("PO Date", "PO Date is required.");
    } else {
      poDate = parseFlexibleDate(row.poDate);
      if (!poDate) {
        err("PO Date", `"${row.poDate}" is not a valid date — use YYYY-MM-DD or DD/MM/YYYY.`);
      } else if (estimate && poDate < toDateString(estimate.estimate_date)) {
        err("PO Date", "PO Date can't be before the Estimate Date.");
      }
    }

    if (!description) err("Description", "Description is required.");

    let amount = null;
    if (isBlank(row.amount)) {
      err("Amount", "Amount is required.");
    } else {
      amount = Number(row.amount);
      if (!Number.isFinite(amount) || amount < 0) {
        err("Amount", `"${row.amount}" is not a valid positive number.`);
      }
    }

    parsed.push({
      rowNum,
      estNo,
      estId: estimate?.est_id,
      recordId: estimate?.record_id,
      poNo,
      poDate,
      description,
      amount,
      docLink: (row.docLink ?? "").toString().trim() || null,
    });
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (const row of parsed) {
      const poId = await nextId("purchase_orders", "po_id", "PO-", 4, client);
      await client.query(
        `INSERT INTO purchase_orders (po_id, record_id, estimate_id, po_no, po_date, description, amount, status, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'Raised', now(), now())`,
        [poId, row.recordId, row.estId, row.poNo, row.poDate, row.description, row.amount]
      );
      await client.query("UPDATE estimates SET amount = $1, updated_at = now() WHERE est_id = $2", [
        row.amount,
        row.estId,
      ]);
      await client.query("UPDATE records SET amount = $1, updated_at = now() WHERE record_id = $2", [
        row.amount,
        row.recordId,
      ]);
      if (row.docLink) {
        await insertDocumentLink(client, {
          module: "Purchase Order",
          compId,
          recordId: row.recordId,
          moduleId: poId,
          url: row.docLink,
        });
      }
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

// Standalone bulk upload: adds Invoices against POs that already exist
// (referenced by PO No). Multiple rows can target the same PO (partial
// billing), so remaining balance is tracked across the whole file, not just
// per-row against the database.
export async function bulkCreateInvoices({ compId, rows }) {
  if (!Array.isArray(rows) || rows.length === 0) {
    return { ok: false, errors: [{ row: "-", field: "File", message: "No rows found in this file." }] };
  }

  const { rows: existingInvoiceNoRows } = await pool.query("SELECT invoice_no FROM invoices");
  const existingInvoiceNos = new Set(existingInvoiceNoRows.map((r) => r.invoice_no.toLowerCase()));
  const seenInvoiceNos = new Set();

  const errors = [];
  const parsed = [];
  const remainingByPoNo = new Map();

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 2;
    const err = (field, message) => errors.push({ row: rowNum, field, message });

    const poNo = (row.poNo ?? "").toString().trim();
    const invoiceNo = (row.invoiceNo ?? "").toString().trim();
    const description = (row.description ?? "").toString().trim();

    let po = null;
    if (!poNo) {
      err("PO No", "PO No is required.");
    } else {
      const { rows: poRows } = await pool.query(
        `SELECT po.po_id, po.po_date, po.amount, po.record_id, r.comp_id,
                COALESCE((SELECT sum(invoice_amount) FROM invoices i
                          WHERE i.po_no = po.po_no AND trim(lower(i.status)) NOT LIKE '%canc%'), 0) AS invoiced
         FROM purchase_orders po JOIN records r ON r.record_id = po.record_id
         WHERE po.po_no = $1`,
        [poNo]
      );
      po = poRows[0];
      if (!po) {
        err("PO No", `"${poNo}" does not exist.`);
      } else if (po.comp_id !== compId) {
        err("PO No", `"${poNo}" belongs to a different company.`);
      }
    }

    if (!invoiceNo) {
      err("Invoice No", "Invoice No is required.");
    } else {
      const key = invoiceNo.toLowerCase();
      if (existingInvoiceNos.has(key) || seenInvoiceNos.has(key)) {
        err("Invoice No", `"${invoiceNo}" is already used by another invoice.`);
      } else {
        seenInvoiceNos.add(key);
      }
    }

    let invoiceDate = null;
    if (isBlank(row.invoiceDate)) {
      err("Invoice Date", "Invoice Date is required.");
    } else {
      invoiceDate = parseFlexibleDate(row.invoiceDate);
      if (!invoiceDate) {
        err("Invoice Date", `"${row.invoiceDate}" is not a valid date — use YYYY-MM-DD or DD/MM/YYYY.`);
      } else if (po && invoiceDate < toDateString(po.po_date)) {
        err("Invoice Date", "Invoice Date can't be before the PO Date.");
      }
    }

    if (!description) err("Description", "Description is required.");

    let invoiceAmount = null;
    if (isBlank(row.invoiceAmount)) {
      err("Invoice Amount", "Invoice Amount is required.");
    } else {
      invoiceAmount = Number(row.invoiceAmount);
      if (!Number.isFinite(invoiceAmount) || invoiceAmount < 0) {
        err("Invoice Amount", `"${row.invoiceAmount}" is not a valid positive number.`);
      } else if (po) {
        if (!remainingByPoNo.has(poNo)) {
          remainingByPoNo.set(poNo, Number(po.amount) - Number(po.invoiced));
        }
        const remaining = remainingByPoNo.get(poNo);
        if (invoiceAmount > remaining + 0.01) {
          err(
            "Invoice Amount",
            `Invoice Amount (${invoiceAmount}) exceeds this PO's remaining balance (${remaining.toFixed(2)}).`
          );
        } else {
          remainingByPoNo.set(poNo, remaining - invoiceAmount);
        }
      }
    }

    let gstPct = 18;
    let tdsPct = 2;
    if (!isBlank(row.gstPct)) {
      gstPct = Number(row.gstPct);
      if (!Number.isFinite(gstPct) || gstPct < 0) err("GST %", `"${row.gstPct}" is not a valid percentage.`);
    }
    if (!isBlank(row.tdsPct)) {
      tdsPct = Number(row.tdsPct);
      if (!Number.isFinite(tdsPct) || tdsPct < 0) err("TDS %", `"${row.tdsPct}" is not a valid percentage.`);
    }

    parsed.push({
      rowNum,
      poNo,
      recordId: po?.record_id,
      invoiceNo,
      invoiceDate,
      description,
      invoiceAmount,
      gstPct,
      tdsPct,
      docLink: (row.docLink ?? "").toString().trim() || null,
    });
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (const row of parsed) {
      const gstAmount = Math.round(row.invoiceAmount * (row.gstPct / 100) * 100) / 100;
      const tdsAmount = Math.round(row.invoiceAmount * (row.tdsPct / 100) * 100) / 100;
      const invoiceTotal = Math.round((row.invoiceAmount + gstAmount - tdsAmount) * 100) / 100;
      const invId = await nextId("invoices", "inv_id", "INV-", 4, client);
      await client.query(
        `INSERT INTO invoices (
           inv_id, record_id, po_no, invoice_no, invoice_date, description,
           invoice_amount, gst_percentage, gst_amount, tds_percentage, tds_amount,
           invoice_total, status, payment_mode, created_at, updated_at
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'Raised', 'Detailed', now(), now())`,
        [
          invId,
          row.recordId,
          row.poNo,
          row.invoiceNo,
          row.invoiceDate,
          row.description,
          row.invoiceAmount,
          row.gstPct / 100,
          gstAmount,
          row.tdsPct / 100,
          tdsAmount,
          invoiceTotal,
        ]
      );
      if (row.docLink) {
        await insertDocumentLink(client, {
          module: "Invoice",
          compId,
          recordId: row.recordId,
          moduleId: invId,
          url: row.docLink,
        });
      }
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
