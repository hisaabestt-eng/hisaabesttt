"use client";

import { useState } from "react";
import { STATUS_STYLES } from "@/lib/status";
import RecordDetailButton from "./RecordDetailModal";

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

// Main Page shows one row per record (not per invoice) even when partial
// billing has split one PO/Estimate into several invoices with different
// progress — the badge above picks a single aggregate status, and this
// expand-to-drill-down (same pattern as POSummaryRow/InvoiceSummaryRow) is
// how each invoice's own status stays visible instead of getting hidden.
export function RecordSummaryRow({ row }) {
  const [open, setOpen] = useState(false);
  const invoices = row.invoices || [];
  // Only worth expanding when there's more than one invoice to break down —
  // a single invoice's status is already the row's own badge above.
  const expandable = invoices.length > 1;

  return (
    <>
      <tr
        className={expandable ? "cursor-pointer hover:bg-gray-50" : "hover:bg-gray-50"}
        onClick={() => expandable && setOpen((v) => !v)}
      >
        <td className="px-3 py-3 text-gray-700 dark:text-gray-300">
          {expandable && (
            <span className="mr-1.5 inline-block w-3 text-gray-400">{open ? "▾" : "▸"}</span>
          )}
          {formatDate(row.estimate_date)}
        </td>
        <td className="px-3 py-3 text-gray-700 dark:text-gray-300" onClick={(e) => e.stopPropagation()}>
          <RecordDetailButton recordId={row.record_id} description={row.estimate_description} />
        </td>
        <td className="px-3 py-3 text-right text-gray-700 dark:text-gray-300">{formatMoney(row.estimate_amount)}</td>
        <td className="px-3 py-3 text-center">
          {invoices.length > 1 ? (
            <span className="inline-flex min-w-[120px] items-center justify-center whitespace-nowrap rounded-full bg-gray-400 px-2.5 py-1 text-xs font-semibold text-white">
              {invoices.length} invoices
            </span>
          ) : (
            <>
              <span
                className={`inline-flex min-w-[120px] items-center justify-center whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_STYLES[row.status]}`}
              >
                {row.status}
              </span>
              {row.status === "Scheduled" && row.scheduled_payment_date && (
                <div className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{formatDate(row.scheduled_payment_date)}</div>
              )}
            </>
          )}
        </td>
      </tr>
      {open && expandable && (
        <tr>
          <td colSpan={4} className="bg-gray-50 p-3 dark:bg-gray-900/40">
            <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
              <div className="border-b border-gray-100 bg-gray-50/60 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-gray-400 dark:border-gray-700 dark:bg-gray-900/40">
                Invoices for {row.estimate_description}
              </div>
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-xs text-gray-500 dark:text-gray-400">
                    <th className="px-3 pb-0 pt-2.5 text-left font-medium">Invoice No</th>
                    <th className="px-3 pb-0 pt-2.5 text-left font-medium">Invoice Date</th>
                    <th className="px-3 pb-0 pt-2.5 text-right font-medium">Invoice Total</th>
                    <th className="px-3 pb-0 pt-2.5 text-center font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {invoices.map((inv) => (
                    <tr key={inv.inv_id}>
                      <td className="px-3 py-2 text-gray-700 dark:text-gray-300">{inv.invoice_no}</td>
                      <td className="px-3 py-2 text-gray-700 dark:text-gray-300">{formatDate(inv.invoice_date)}</td>
                      <td className="px-3 py-2 text-right text-gray-700 dark:text-gray-300">
                        {formatMoney(inv.invoice_total)}
                      </td>
                      <td className="px-3 py-2 text-center">
                        <span
                          className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[inv.status]}`}
                        >
                          {inv.status}
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
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
