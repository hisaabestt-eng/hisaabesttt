"use client";

import { useState } from "react";
import { LIFECYCLE_STYLES, progressLabel, progressStyle, lifecycleDisplay } from "@/lib/status";
import { EditPOButton, DeletePOButton } from "./POModal";
import { DocumentPreviewLink } from "./DocumentPreview";

function formatMoney(value) {
  if (value === null || value === undefined) return "—";
  return Number(value).toLocaleString("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  });
}

function formatDate(value) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

// Mirrors InvoiceSummaryRow on the Payment Allocations page: click the PO
// row to expand and see exactly which invoice(s) were raised against it —
// so a partially-billed PO's remaining balance is easy to explain at a glance.
export function POSummaryRow({ po, statusLabels = [], docFileExists, canEdit = true, canDelete = false }) {
  const [open, setOpen] = useState(false);
  const invoices = po.invoices || [];

  return (
    <>
      <tr className="cursor-pointer hover:bg-gray-50" onClick={() => setOpen((v) => !v)}>
        <td className="px-3 py-3 font-mono text-xs text-gray-500 dark:text-gray-400">
          <span className="mr-1.5 inline-block w-3 text-gray-400">{open ? "▾" : "▸"}</span>
          {po.record_id}
        </td>
        <td className="px-3 py-3 text-gray-700 dark:text-gray-300">{po.po_no}</td>
        <td className="px-3 py-3 text-gray-700 dark:text-gray-300">{formatDate(po.po_date)}</td>
        <td className="px-3 py-3 text-gray-700 dark:text-gray-300">{po.description}</td>
        <td className="px-3 py-3 text-right text-gray-700 dark:text-gray-300">{formatMoney(po.amount)}</td>
        <td className="px-3 py-3 text-right text-gray-700 dark:text-gray-300">{formatMoney(po.invoiced_amount)}</td>
        <td
          className={`px-3 py-3 text-right font-medium ${
            Number(po.invoice_balance) > 0.01 ? "text-amber-600" : "text-gray-400"
          }`}
        >
          {formatMoney(po.invoice_balance)}
        </td>
        <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
          {po.external_url ? (
            <DocumentPreviewLink
              href={po.external_url}
              externalUrl={po.external_url}
              className="text-xs text-blue-600 underline"
            >
              🔗 External Link
            </DocumentPreviewLink>
          ) : po.doc_id && docFileExists ? (
            <DocumentPreviewLink
              href={`/uploads/purchase-order/${po.po_id}-${po.file_name}`}
              fileName={po.file_name}
              className="text-xs text-blue-600 underline"
            >
              📎 {po.file_name}
            </DocumentPreviewLink>
          ) : po.doc_id ? (
            <span className="text-xs text-gray-400" title="Uploaded before file storage was set up">
              📎 {po.file_name} (no file)
            </span>
          ) : (
            <span className="text-xs text-gray-400">No document</span>
          )}
        </td>
        <td className="px-3 py-3 text-center">
          <span className={`inline-flex min-w-[120px] items-center justify-center whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${lifecycleDisplay(po).style}`}>
            {lifecycleDisplay(po).label}
          </span>
        </td>
        <td className="px-3 py-3 text-center">
          <span className={`inline-flex min-w-[120px] items-center justify-center whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${progressStyle(po)}`}>
            {progressLabel(po, "PO")}
          </span>
          {po.status === "Scheduled" && po.scheduled_payment_date && (
            <div className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{formatDate(po.scheduled_payment_date)}</div>
          )}
        </td>
        <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
          <div className="flex gap-2">
            {canEdit && <EditPOButton po={po} statusLabels={statusLabels} />}
            {canDelete && !po.inv_id && <DeletePOButton poId={po.po_id} />}
          </div>
        </td>
      </tr>
      {open && (
        <tr>
          <td colSpan={11} className="bg-gray-50 p-3 dark:bg-gray-900/40">
            <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
              <div className="border-b border-gray-100 bg-gray-50/60 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-gray-400 dark:border-gray-700 dark:bg-gray-900/40">
                Invoices raised against {po.po_no}
              </div>
              {invoices.length === 0 ? (
                <p className="px-3 py-2.5 text-xs text-gray-400">
                  No invoice yet — balance to invoice is the full PO amount ({formatMoney(po.amount)}).
                </p>
              ) : (
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="text-xs text-gray-500 dark:text-gray-400">
                      <th className="px-3 pb-0 pt-2.5 text-left font-medium">Invoice No</th>
                      <th className="px-3 pb-0 pt-2.5 text-left font-medium">Invoice Date</th>
                      <th className="px-3 pb-0 pt-2.5 text-right font-medium">Invoice Amount</th>
                      <th className="px-3 pb-0 pt-2.5 text-right font-medium">Invoice Total</th>
                      <th className="px-3 pb-0 pt-2.5 text-center font-medium">Status</th>
                      <th className="px-3 pb-0 pt-2.5 text-center font-medium">Progress</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {invoices.map((inv) => (
                      <tr key={inv.inv_id}>
                        <td className="px-3 py-2 text-gray-700 dark:text-gray-300">{inv.invoice_no}</td>
                        <td className="px-3 py-2 text-gray-700 dark:text-gray-300">{formatDate(inv.invoice_date)}</td>
                        <td className="px-3 py-2 text-right text-gray-700 dark:text-gray-300">
                          {formatMoney(inv.invoice_amount)}
                        </td>
                        <td className="px-3 py-2 text-right text-gray-700 dark:text-gray-300">
                          {formatMoney(inv.invoice_total)}
                        </td>
                        <td className="px-3 py-2 text-center">
                          <span
                            className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${LIFECYCLE_STYLES[inv.lifecycle]}`}
                          >
                            {inv.lifecycle}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-center">
                          <span
                            className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${progressStyle(inv)}`}
                          >
                            {progressLabel(inv, "Invoice")}
                          </span>
                          {inv.status === "Scheduled" && inv.scheduled_payment_date && (
                            <div className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                              {formatDate(inv.scheduled_payment_date)}
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              {Number(po.invoice_balance) > 0.01 && (
                <p className="border-t border-gray-100 px-3 py-2 text-xs text-amber-600">
                  Still to invoice: {formatMoney(po.invoice_balance)} of {formatMoney(po.amount)}.
                </p>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
