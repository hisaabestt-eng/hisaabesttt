"use client";

import { useRefineFilter, RefineToggleButton } from "./useRefineFilter";
import { InvoiceSummaryRow } from "./InvoiceSummaryRow";

function formatMoney(value) {
  if (value === null || value === undefined) return "—";
  return Number(value).toLocaleString("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  });
}

export function PaymentAllocationsTable({ invoices, canEdit }) {
  const { refining, toggleRefining, visibleRows, isChecked, toggleRow } = useRefineFilter(
    invoices,
    (inv) => inv.inv_id
  );

  const totals = visibleRows.reduce(
    (acc, inv) => {
      if (inv.lifecycle !== "Raised") return acc;
      acc.amount += Number(inv.invoice_total) || 0;
      acc.received += Number(inv.total_received) || 0;
      acc.balance += Number(inv.balance_due) || 0;
      return acc;
    },
    { amount: 0, received: 0, balance: 0 }
  );

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm text-gray-600 dark:text-gray-400">
          {invoices.length} invoices — click a row to see its payment history
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
              <th className="px-3 py-3 text-left font-medium text-gray-600 dark:text-gray-400">Invoice No</th>
              <th className="px-3 py-3 text-right font-medium text-gray-600 dark:text-gray-400">Invoice Amount</th>
              <th className="px-3 py-3 text-right font-medium text-gray-600 dark:text-gray-400">Total Received</th>
              <th className="px-3 py-3 text-right font-medium text-gray-600 dark:text-gray-400">Balance Due</th>
              <th className="px-3 py-3 text-center font-medium text-gray-600 dark:text-gray-400">Payment Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {visibleRows.map((inv) => (
              <InvoiceSummaryRow
                key={inv.inv_id}
                invoice={inv}
                canEdit={canEdit}
                refining={refining}
                checked={isChecked(inv.inv_id)}
                onToggle={toggleRow}
              />
            ))}
            {visibleRows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-gray-500 dark:text-gray-400">
                  {invoices.length === 0 ? "No invoices found." : "All rows refined out — untick some to bring them back."}
                </td>
              </tr>
            )}
          </tbody>
          {visibleRows.length > 0 && (
            <tfoot className="sticky bottom-0 border-t-2 border-gray-200 bg-gray-50 font-medium dark:border-gray-700 dark:bg-gray-900/40">
              <tr>
                <td className="px-3 py-3 text-right text-gray-700 dark:text-gray-300">Total (Raised only)</td>
                <td className="px-3 py-3 text-right text-gray-900 dark:text-gray-100">{formatMoney(totals.amount)}</td>
                <td className="px-3 py-3 text-right text-gray-900 dark:text-gray-100">{formatMoney(totals.received)}</td>
                <td className="px-3 py-3 text-right text-gray-900 dark:text-gray-100">{formatMoney(totals.balance)}</td>
                <td></td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </>
  );
}
