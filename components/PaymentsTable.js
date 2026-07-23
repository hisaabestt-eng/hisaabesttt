"use client";

import { useRefineFilter, RefineToggleButton } from "./useRefineFilter";
import { PaymentRow } from "./PaymentRow";

function formatMoney(value) {
  if (value === null || value === undefined) return "—";
  return Number(value).toLocaleString("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  });
}

export function PaymentsTable({ payments, outstandingInvoices, canEdit, canDelete }) {
  const { refining, toggleRefining, visibleRows, isChecked, toggleRow } = useRefineFilter(
    payments,
    (py) => py.py_id
  );

  const totals = visibleRows.reduce(
    (acc, py) => {
      acc.received += Number(py.amount_received) || 0;
      acc.balance += Number(py.balance) || 0;
      return acc;
    },
    { received: 0, balance: 0 }
  );

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm text-gray-600 dark:text-gray-400">{payments.length} payments</div>
        <RefineToggleButton
          refining={refining}
          toggleRefining={toggleRefining}
          totalCount={payments.length}
          visibleCount={visibleRows.length}
        />
      </div>

      <div className="max-h-[70vh] overflow-y-auto overflow-x-auto rounded-lg border border-gray-100 dark:border-gray-700">
        <table className="min-w-full divide-y divide-gray-100 text-sm dark:divide-gray-700">
          <thead className="sticky top-0 bg-gray-50 dark:bg-gray-900/40">
            <tr>
              <th className="px-3 py-3 text-left font-medium text-gray-600 dark:text-gray-400">Payment Date</th>
              <th className="px-3 py-3 text-right font-medium text-gray-600 dark:text-gray-400">Amount Received</th>
              <th className="px-3 py-3 text-right font-medium text-gray-600 dark:text-gray-400">Balance Amount</th>
              <th className="min-w-[220px] px-3 py-3 text-left font-medium text-gray-600 dark:text-gray-400">
                Remarks
              </th>
              <th className="px-3 py-3 text-left font-medium text-gray-600 dark:text-gray-400">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {visibleRows.map((py) => (
              <PaymentRow
                key={py.py_id}
                py={py}
                outstandingInvoices={outstandingInvoices}
                canEdit={canEdit}
                canDelete={canDelete}
                refining={refining}
                checked={isChecked(py.py_id)}
                onToggle={toggleRow}
              />
            ))}
            {visibleRows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-gray-500 dark:text-gray-400">
                  {payments.length === 0 ? "No payments found." : "All rows refined out — untick some to bring them back."}
                </td>
              </tr>
            )}
          </tbody>
          {visibleRows.length > 0 && (
            <tfoot className="sticky bottom-0 border-t-2 border-gray-200 bg-gray-50 font-medium dark:border-gray-700 dark:bg-gray-900/40">
              <tr>
                <td className="px-3 py-3 text-right text-gray-700 dark:text-gray-300">Total</td>
                <td className="px-3 py-3 text-right text-gray-900 dark:text-gray-100">{formatMoney(totals.received)}</td>
                <td className="px-3 py-3 text-right text-gray-900 dark:text-gray-100">{formatMoney(totals.balance)}</td>
                <td colSpan={2}></td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </>
  );
}
