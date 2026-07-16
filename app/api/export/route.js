import { NextResponse } from "next/server";
import { listRecords } from "@/lib/recordsAdmin";
import { listEstimates } from "@/lib/estimatesAdmin";
import { listPOs } from "@/lib/poAdmin";
import { listInvoices } from "@/lib/invoicesAdmin";
import { listPayments } from "@/lib/paymentsAdmin";
import { lifecycleDisplay, progressLabel, invoiceDisplayStatus } from "@/lib/status";

const NO_FILTER = { search: "", progress: [], year: "", yearType: "calendar" };

const ENTITY_HANDLERS = {
  records: async (compId, clientId) => {
    const rows = await listRecords({ compId, clientId, ...NO_FILTER });
    return rows.map((r) => ({
      "Record ID": r.record_id,
      Date: r.record_date,
      Client: r.client_name,
      Description: r.description,
      Amount: r.amount,
      Status: lifecycleDisplay(r).label,
      Progress: progressLabel(r, "Record"),
    }));
  },
  estimates: async (compId, clientId) => {
    const rows = await listEstimates({ compId, clientId, ...NO_FILTER });
    return rows.map((e) => ({
      "Record ID": e.record_id,
      "Estimate No": e.est_no,
      Date: e.estimate_date,
      Client: e.client_name,
      Description: e.description,
      Amount: e.amount,
      Status: lifecycleDisplay(e).label,
      Progress: progressLabel(e, "Estimate"),
    }));
  },
  po: async (compId, clientId) => {
    const rows = await listPOs({ compId, clientId, ...NO_FILTER });
    return rows.map((po) => ({
      "Record ID": po.record_id,
      "PO No": po.po_no,
      Date: po.po_date,
      Client: po.client_name,
      Description: po.description,
      Amount: po.amount,
      Invoiced: po.invoiced_amount,
      "Balance to Invoice": po.invoice_balance,
      Status: lifecycleDisplay(po).label,
      Progress: progressLabel(po, "PO"),
    }));
  },
  invoices: async (compId, clientId) => {
    const rows = await listInvoices({ compId, clientId, ...NO_FILTER });
    return rows.map((inv) => ({
      "Record ID": inv.record_id,
      "Invoice No": inv.invoice_no,
      Date: inv.invoice_date,
      Client: inv.client_name,
      Description: inv.description,
      "Invoice Amount": inv.invoice_amount,
      "GST %": inv.gst_percentage,
      "TDS %": inv.tds_percentage,
      "Invoice Total": inv.invoice_total,
      Status: invoiceDisplayStatus(inv),
      Progress: progressLabel(inv, "Invoice"),
    }));
  },
  payments: async (compId, clientId) => {
    const rows = await listPayments({ compId, clientId, search: "", year: "", yearType: "calendar" });
    return rows.map((py) => ({
      "Payment ID": py.py_id,
      Date: py.payment_date,
      Client: py.client_name,
      "Amount Received": py.amount_received,
      Balance: py.balance,
      Remarks: py.remarks,
    }));
  },
};

export async function GET(request) {
  const { searchParams } = request.nextUrl;
  const entity = searchParams.get("entity");
  const compId = searchParams.get("compId") || "";
  const clientId = searchParams.get("clientId") || "";

  const handler = ENTITY_HANDLERS[entity];
  if (!handler) {
    return NextResponse.json({ error: "Unknown entity" }, { status: 400 });
  }
  if (!compId) {
    return NextResponse.json({ error: "Select a company first" }, { status: 400 });
  }

  const rows = await handler(compId, clientId);
  return NextResponse.json({ rows });
}
