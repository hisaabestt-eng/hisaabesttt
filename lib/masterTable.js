import { listRecords } from "./recordsAdmin";
import { listEstimates } from "./estimatesAdmin";
import { listPOs } from "./poAdmin";
import { listInvoices } from "./invoicesAdmin";

const NO_FILTER = { search: "", progress: [], year: "", yearType: "calendar" };

// One row per Invoice — a record with several invoices (partial billing)
// produces several rows, and a record that hasn't reached Invoice yet still
// gets exactly one row with empty Estimate/PO/Invoice columns, so nothing
// from a bulk upload is ever hidden behind a collapsed/summary row.
export async function getMasterTable({ compId, clientId }) {
  const [records, estimates, pos, invoices] = await Promise.all([
    listRecords({ compId, clientId, ...NO_FILTER }),
    listEstimates({ compId, clientId, ...NO_FILTER }),
    listPOs({ compId, clientId, ...NO_FILTER }),
    listInvoices({ compId, clientId, ...NO_FILTER }),
  ]);

  const rows = [];
  for (const record of records) {
    const estimate = record.est_id ? estimates.find((e) => e.est_id === record.est_id) : null;
    const po = record.po_id ? pos.find((p) => p.po_id === record.po_id) : null;
    const recordInvoices = po
      ? invoices.filter((inv) => inv.po_no === po.po_no)
      : estimate
        ? invoices.filter((inv) => inv.est_id === estimate.est_id)
        : [];

    if (recordInvoices.length === 0) {
      rows.push({ record, estimate, po, invoice: null });
    } else {
      for (const invoice of recordInvoices) {
        rows.push({ record, estimate, po, invoice });
      }
    }
  }
  return rows;
}
