"use client";

import { useRefineFilter, RefineToggleButton } from "./useRefineFilter";
import { narrowInvoicesToSearch, narrowInvoicesToProgress } from "@/lib/searchNarrow";
import { POSummaryRow } from "./POSummaryRow";

function formatMoney(value) {
  if (value === null || value === undefined) return "—";
  return Number(value).toLocaleString("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  });
}

// docFileExists is resolved server-side per PO (needs Node's fs, not
// available here) and passed in already computed, as po.docFileExists.
export function POsTable({ purchaseOrders, statusLabels, canEdit, canDelete, search, progress }) {
  const { refining, toggleRefining, visibleRows, isChecked, toggleRow } = useRefineFilter(
    purchaseOrders,
    (po) => po.po_id
  );

  const totals = visibleRows.reduce(
    (acc, po) => {
      if (po.lifecycle !== "Raised") return acc;
      acc.amount += Number(po.amount) || 0;
      acc.invoiced += Number(po.invoiced_amount) || 0;
      acc.balance += Number(po.invoice_balance) || 0;
      return acc;
    },
    { amount: 0, invoiced: 0, balance: 0 }
  );

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm text-gray-600 dark:text-gray-400">
          {purchaseOrders.length} purchase orders — click a row to see its invoices
        </div>
        <RefineToggleButton
          refining={refining}
          toggleRefining={toggleRefining}
          totalCount={purchaseOrders.length}
          visibleCount={visibleRows.length}
        />
      </div>

      <div className="max-h-[70vh] overflow-y-auto overflow-x-auto rounded-lg border border-gray-100 dark:border-gray-700">
        <table className="min-w-full divide-y divide-gray-100 text-sm dark:divide-gray-700">
          <thead className="sticky top-0 bg-gray-50 dark:bg-gray-900/40">
            <tr>
              <th className="px-3 py-3 text-left font-medium text-gray-600 dark:text-gray-400">Record ID</th>
              <th className="px-3 py-3 text-left font-medium text-gray-600 dark:text-gray-400">PO No</th>
              <th className="px-3 py-3 text-left font-medium text-gray-600 dark:text-gray-400">PO Date</th>
              <th className="min-w-[320px] px-3 py-3 text-left font-medium text-gray-600 dark:text-gray-400">
                Description
              </th>
              <th className="px-3 py-3 text-right font-medium text-gray-600 dark:text-gray-400">Amount</th>
              <th className="px-3 py-3 text-right font-medium text-gray-600 dark:text-gray-400">Invoiced</th>
              <th className="px-3 py-3 text-right font-medium text-gray-600 dark:text-gray-400">Balance to Invoice</th>
              <th className="px-3 py-3 text-left font-medium text-gray-600 dark:text-gray-400">Document</th>
              <th className="px-3 py-3 text-center font-medium text-gray-600 dark:text-gray-400">Status</th>
              <th className="px-3 py-3 text-left font-medium text-gray-600 dark:text-gray-400">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {visibleRows.map((po) => (
              <POSummaryRow
                key={po.po_id}
                po={{
                  ...po,
                  invoices: narrowInvoicesToProgress(narrowInvoicesToSearch(po.invoices, search), progress),
                }}
                statusLabels={statusLabels}
                docFileExists={po.docFileExists}
                canEdit={canEdit}
                canDelete={canDelete}
                refining={refining}
                checked={isChecked(po.po_id)}
                onToggle={toggleRow}
              />
            ))}
            {visibleRows.length === 0 && (
              <tr>
                <td colSpan={10} className="px-3 py-6 text-center text-gray-500 dark:text-gray-400">
                  {purchaseOrders.length === 0
                    ? "No purchase orders found."
                    : "All rows refined out — untick some to bring them back."}
                </td>
              </tr>
            )}
          </tbody>
          {visibleRows.length > 0 && (
            <tfoot className="sticky bottom-0 border-t-2 border-gray-200 bg-gray-50 font-medium dark:border-gray-700 dark:bg-gray-900/40">
              <tr>
                <td colSpan={4} className="px-3 py-3 text-right text-gray-700 dark:text-gray-300">
                  Total (Raised only)
                </td>
                <td className="px-3 py-3 text-right text-gray-900 dark:text-gray-100">{formatMoney(totals.amount)}</td>
                <td className="px-3 py-3 text-right text-gray-900 dark:text-gray-100">{formatMoney(totals.invoiced)}</td>
                <td className="px-3 py-3 text-right text-gray-900 dark:text-gray-100">{formatMoney(totals.balance)}</td>
                <td colSpan={3}></td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </>
  );
}
