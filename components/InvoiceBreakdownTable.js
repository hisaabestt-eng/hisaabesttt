"use client";

import { LIFECYCLE_STYLES, progressLabel, progressStyle } from "@/lib/status";

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

// Shared by the Records/Estimates/Purchase Orders pages' expandable rows —
// same invoice-level detail wherever a row's chain reaches Invoice.
export function InvoiceBreakdownTable({ invoices, emptyMessage }) {
  if (invoices.length === 0) {
    return <p className="px-3 py-2.5 text-xs text-gray-400">{emptyMessage}</p>;
  }
  return (
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
  );
}
