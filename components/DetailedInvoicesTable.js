"use client";

import { LIFECYCLE_STYLES, progressLabel, progressStyle, invoiceDisplayStatus } from "@/lib/status";
import { useRefineFilter, RefineToggleButton } from "./useRefineFilter";

function formatMoney(value) {
  if (value === null || value === undefined) return "—";
  return Number(value).toLocaleString("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  });
}

function formatPercent(value) {
  if (value === null || value === undefined) return "—";
  const pct = Number(value) * 100;
  return `${Number(pct.toFixed(2))}%`;
}

function formatDate(value) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function DetailedInvoicesTable({ invoices, clientId }) {
  const { refining, toggleRefining, visibleRows, isChecked, toggleRow } = useRefineFilter(
    invoices,
    (inv) => inv.inv_id
  );

  // Archived/Cancelled invoices don't represent a real GST/TDS liability, so
  // they're excluded from the totals line entirely even though they still
  // show up in the list (for the record).
  const totals = visibleRows.reduce(
    (acc, inv) => {
      if (inv.lifecycle !== "Raised") return acc;
      acc.amount += Number(inv.invoice_amount) || 0;
      acc.gst += Number(inv.gst_amount) || 0;
      acc.tds += Number(inv.tds_amount) || 0;
      acc.total += Number(inv.invoice_total) || 0;
      acc.received += Number(inv.total_received) || 0;
      acc.balanceDue += Number(inv.balance_due) || 0;
      return acc;
    },
    { amount: 0, gst: 0, tds: 0, total: 0, received: 0, balanceDue: 0 }
  );

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm text-gray-600 dark:text-gray-400">
          {invoices.length} invoices{clientId ? "" : " across all clients"} — GST/TDS totals below
          exclude Archived/Cancelled invoices
        </div>
        <RefineToggleButton
          refining={refining}
          toggleRefining={toggleRefining}
          totalCount={invoices.length}
          visibleCount={visibleRows.length}
        />
      </div>

      <div className="max-h-[70vh] overflow-y-auto overflow-x-auto rounded-lg border border-gray-100 dark:border-gray-700">
        <table className="min-w-full divide-y divide-gray-100 text-sm dark:divide-gray-700">
          <thead className="sticky top-0 bg-gray-50 dark:bg-gray-900/40">
            <tr>
              <th className="px-3 py-3 text-left font-medium text-gray-600 dark:text-gray-400">Record ID</th>
              <th className="px-3 py-3 text-left font-medium text-gray-600 dark:text-gray-400">Invoice No</th>
              <th className="px-3 py-3 text-left font-medium text-gray-600 dark:text-gray-400">Invoice Date</th>
              <th className="px-3 py-3 text-left font-medium text-gray-600 dark:text-gray-400">Client</th>
              <th className="min-w-[220px] px-3 py-3 text-left font-medium text-gray-600 dark:text-gray-400">
                Description
              </th>
              <th className="px-3 py-3 text-right font-medium text-gray-600 dark:text-gray-400">Amount</th>
              <th className="px-3 py-3 text-right font-medium text-gray-600 dark:text-gray-400">GST %</th>
              <th className="px-3 py-3 text-right font-medium text-gray-600 dark:text-gray-400">GST Amount</th>
              <th className="px-3 py-3 text-right font-medium text-gray-600 dark:text-gray-400">TDS %</th>
              <th className="px-3 py-3 text-right font-medium text-gray-600 dark:text-gray-400">TDS Amount</th>
              <th className="px-3 py-3 text-right font-medium text-gray-600 dark:text-gray-400">Invoice Total</th>
              <th className="px-3 py-3 text-right font-medium text-gray-600 dark:text-gray-400">Received</th>
              <th className="px-3 py-3 text-right font-medium text-gray-600 dark:text-gray-400">Balance Due</th>
              <th className="min-w-[160px] px-3 py-3 text-left font-medium text-gray-600 dark:text-gray-400">Remarks</th>
              <th className="px-3 py-3 text-center font-medium text-gray-600 dark:text-gray-400">Status</th>
              <th className="px-3 py-3 text-center font-medium text-gray-600 dark:text-gray-400">Progress</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {visibleRows.map((inv) => {
              const blanked = inv.lifecycle !== "Raised";
              return (
                <tr key={inv.inv_id} className={blanked ? "bg-gray-50" : "hover:bg-gray-50"}>
                  <td className="px-3 py-3 font-mono text-xs text-gray-500 dark:text-gray-400">
                    {refining && (
                      <input
                        type="checkbox"
                        checked={isChecked(inv.inv_id)}
                        onChange={() => toggleRow(inv.inv_id)}
                        className="mr-1.5 align-middle"
                      />
                    )}
                    {inv.record_id}
                  </td>
                  <td className="px-3 py-3 text-gray-700 dark:text-gray-300">{inv.invoice_no}</td>
                  <td className="px-3 py-3 text-gray-700 dark:text-gray-300">{formatDate(inv.invoice_date)}</td>
                  <td className="px-3 py-3 text-gray-700 dark:text-gray-300">{inv.client_name}</td>
                  <td className="px-3 py-3 text-gray-700 dark:text-gray-300">{inv.description}</td>
                  <td className="px-3 py-3 text-right text-gray-700 dark:text-gray-300">
                    {formatMoney(inv.invoice_amount)}
                  </td>
                  <td className="px-3 py-3 text-right text-gray-700 dark:text-gray-300">
                    {blanked ? "—" : formatPercent(inv.gst_percentage)}
                  </td>
                  <td className="px-3 py-3 text-right text-gray-700 dark:text-gray-300">
                    {blanked ? "—" : formatMoney(inv.gst_amount)}
                  </td>
                  <td className="px-3 py-3 text-right text-gray-700 dark:text-gray-300">
                    {blanked ? "—" : formatPercent(inv.tds_percentage)}
                  </td>
                  <td className="px-3 py-3 text-right text-gray-700 dark:text-gray-300">
                    {blanked ? "—" : formatMoney(inv.tds_amount)}
                  </td>
                  <td className="px-3 py-3 text-right font-medium text-gray-900 dark:text-gray-100">
                    {blanked ? "—" : formatMoney(inv.invoice_total)}
                  </td>
                  <td className="px-3 py-3 text-right text-gray-700 dark:text-gray-300">
                    {blanked ? "—" : formatMoney(inv.total_received)}
                  </td>
                  <td
                    className={`px-3 py-3 text-right font-medium ${
                      !blanked && Number(inv.balance_due) > 0.01 ? "text-amber-600" : "text-gray-700 dark:text-gray-300"
                    }`}
                  >
                    {blanked ? "—" : formatMoney(inv.balance_due)}
                  </td>
                  <td className="px-3 py-3 text-gray-700 dark:text-gray-300">{inv.remarks || "—"}</td>
                  <td className="px-3 py-3 text-center">
                    <span
                      className={`inline-flex min-w-[120px] items-center justify-center whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${LIFECYCLE_STYLES[invoiceDisplayStatus(inv)]}`}
                    >
                      {invoiceDisplayStatus(inv)}
                    </span>
                    {invoiceDisplayStatus(inv) === "Submitted" && inv.submission_date && (
                      <div className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                        {formatDate(inv.submission_date)}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-3 text-center">
                    <span
                      className={`inline-flex min-w-[120px] items-center justify-center whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${progressStyle(inv)}`}
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
              );
            })}
            {visibleRows.length === 0 && (
              <tr>
                <td colSpan={16} className="px-3 py-6 text-center text-gray-500 dark:text-gray-400">
                  {invoices.length === 0 ? "No invoices found." : "All rows refined out — untick some to bring them back."}
                </td>
              </tr>
            )}
          </tbody>
          {visibleRows.length > 0 && (
            <tfoot className="sticky bottom-0 border-t-2 border-gray-200 bg-gray-50 font-medium dark:border-gray-700 dark:bg-gray-900/40">
              <tr>
                <td colSpan={5} className="px-3 py-3 text-right text-gray-700 dark:text-gray-300">
                  Total (Raised invoices only)
                </td>
                <td className="px-3 py-3 text-right text-gray-900 dark:text-gray-100">{formatMoney(totals.amount)}</td>
                <td></td>
                <td className="px-3 py-3 text-right text-gray-900 dark:text-gray-100">{formatMoney(totals.gst)}</td>
                <td></td>
                <td className="px-3 py-3 text-right text-gray-900 dark:text-gray-100">{formatMoney(totals.tds)}</td>
                <td className="px-3 py-3 text-right text-gray-900 dark:text-gray-100">{formatMoney(totals.total)}</td>
                <td className="px-3 py-3 text-right text-gray-900 dark:text-gray-100">{formatMoney(totals.received)}</td>
                <td className="px-3 py-3 text-right text-gray-900 dark:text-gray-100">{formatMoney(totals.balanceDue)}</td>
                <td colSpan={3}></td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </>
  );
}
