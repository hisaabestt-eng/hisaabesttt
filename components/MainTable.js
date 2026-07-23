"use client";

import { useRefineFilter, RefineToggleButton } from "./useRefineFilter";
import { RecordSummaryRow } from "./RecordSummaryRow";

function formatMoney(value) {
  if (value === null || value === undefined) return "—";
  return Number(value).toLocaleString("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  });
}

export function MainTable({ rows, totalCount }) {
  const { refining, toggleRefining, visibleRows, isChecked, toggleRow } = useRefineFilter(
    rows,
    (row) => row.record_id
  );

  const totalAmount = visibleRows.reduce((sum, row) => sum + (Number(row.estimate_amount) || 0), 0);

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm text-gray-600 dark:text-gray-400">{totalCount} records</div>
        <RefineToggleButton
          refining={refining}
          toggleRefining={toggleRefining}
          totalCount={rows.length}
          visibleCount={visibleRows.length}
        />
      </div>

      <div className="max-h-[70vh] overflow-y-auto overflow-x-auto rounded-lg border border-gray-100 dark:border-gray-700">
        <table className="min-w-full divide-y divide-gray-100 text-sm dark:divide-gray-700">
          <thead className="sticky top-0 bg-gray-50 dark:bg-gray-900/40">
            <tr>
              <th className="whitespace-nowrap px-3 py-3 text-left font-medium text-gray-600 dark:text-gray-400">
                Date
              </th>
              <th className="min-w-[320px] px-3 py-3 text-left font-medium text-gray-600 dark:text-gray-400">
                Description
              </th>
              <th className="px-3 py-3 text-right font-medium text-gray-600 dark:text-gray-400">Amount</th>
              <th className="w-40 px-3 py-3 text-center font-medium text-gray-600 dark:text-gray-400">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {visibleRows.map((row) => (
              <RecordSummaryRow
                key={row.record_id}
                row={row}
                refining={refining}
                checked={isChecked(row.record_id)}
                onToggle={toggleRow}
              />
            ))}
            {visibleRows.length === 0 && (
              <tr>
                <td colSpan={4} className="px-3 py-6 text-center text-gray-500 dark:text-gray-400">
                  {rows.length === 0 ? "No records found." : "All rows refined out — untick some to bring them back."}
                </td>
              </tr>
            )}
          </tbody>
          {visibleRows.length > 0 && (
            <tfoot className="sticky bottom-0 border-t-2 border-gray-200 bg-gray-50 font-medium dark:border-gray-700 dark:bg-gray-900/40">
              <tr>
                <td colSpan={2} className="px-3 py-3 text-right text-gray-700 dark:text-gray-300">
                  Total
                </td>
                <td className="px-3 py-3 text-right text-gray-900 dark:text-gray-100">{formatMoney(totalAmount)}</td>
                <td></td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </>
  );
}
