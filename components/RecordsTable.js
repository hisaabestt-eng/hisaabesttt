"use client";

import { useRefineFilter, RefineToggleButton } from "./useRefineFilter";
import { narrowInvoicesToSearch, narrowInvoicesToProgress } from "@/lib/searchNarrow";
import { RecordRow } from "./RecordRow";

function formatMoney(value) {
  if (value === null || value === undefined) return "—";
  return Number(value).toLocaleString("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  });
}

export function RecordsTable({
  records,
  allEstimates,
  allPOs,
  allInvoices,
  statusLabels,
  estimateStatusLabels,
  poStatusLabels,
  canEdit,
  canDelete,
  search,
  progress,
}) {
  const { refining, toggleRefining, visibleRows, isChecked, toggleRow } = useRefineFilter(
    records,
    (r) => r.record_id
  );

  // Archived/Cancelled records don't represent real outstanding work, so
  // they're excluded from the subtotal — same convention as Detailed
  // Invoices. Recomputed from visibleRows so refining a row out of view
  // also drops it from this total.
  const totalAmount = visibleRows.reduce(
    (sum, record) => (record.lifecycle === "Raised" ? sum + (Number(record.amount) || 0) : sum),
    0
  );

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm text-gray-600 dark:text-gray-400">{records.length} records</div>
        <RefineToggleButton
          refining={refining}
          toggleRefining={toggleRefining}
          totalCount={records.length}
          visibleCount={visibleRows.length}
        />
      </div>

      <div className="max-h-[70vh] overflow-y-auto overflow-x-auto rounded-lg border border-gray-100 dark:border-gray-700">
        <table className="min-w-full divide-y divide-gray-100 text-sm dark:divide-gray-700">
          <thead className="sticky top-0 bg-gray-50 dark:bg-gray-900/40">
            <tr>
              <th className="px-3 py-3 text-left font-medium text-gray-600 dark:text-gray-400">Record ID</th>
              <th className="px-3 py-3 text-left font-medium text-gray-600 dark:text-gray-400">Date</th>
              <th className="min-w-[320px] px-3 py-3 text-left font-medium text-gray-600 dark:text-gray-400">
                Description
              </th>
              <th className="px-3 py-3 text-right font-medium text-gray-600 dark:text-gray-400">Amount</th>
              <th className="px-3 py-3 text-center font-medium text-gray-600 dark:text-gray-400">Status</th>
              <th className="px-3 py-3 text-left font-medium text-gray-600 dark:text-gray-400">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {visibleRows.map((record) => {
              const estimate = record.est_id ? allEstimates.find((e) => e.est_id === record.est_id) : null;
              const po = record.po_id ? allPOs.find((p) => p.po_id === record.po_id) : null;
              const invoices = narrowInvoicesToProgress(
                narrowInvoicesToSearch(
                  po
                    ? allInvoices.filter((inv) => inv.po_no === po.po_no)
                    : estimate
                      ? allInvoices.filter((inv) => inv.est_id === estimate.est_id)
                      : [],
                  search
                ),
                progress
              );
              return (
                <RecordRow
                  key={record.record_id}
                  record={record}
                  estimate={estimate}
                  po={po}
                  invoices={invoices}
                  statusLabels={statusLabels}
                  estimateStatusLabels={estimateStatusLabels}
                  poStatusLabels={poStatusLabels}
                  canEdit={canEdit}
                  canDelete={canDelete}
                  refining={refining}
                  checked={isChecked(record.record_id)}
                  onToggle={toggleRow}
                />
              );
            })}
            {visibleRows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-gray-500 dark:text-gray-400">
                  {records.length === 0 ? "No records found." : "All rows refined out — untick some to bring them back."}
                </td>
              </tr>
            )}
          </tbody>
          {visibleRows.length > 0 && (
            <tfoot className="sticky bottom-0 border-t-2 border-gray-200 bg-gray-50 font-medium dark:border-gray-700 dark:bg-gray-900/40">
              <tr>
                <td colSpan={3} className="px-3 py-3 text-right text-gray-700 dark:text-gray-300">
                  Total (Raised only)
                </td>
                <td className="px-3 py-3 text-right text-gray-900 dark:text-gray-100">
                  {formatMoney(totalAmount)}
                </td>
                <td colSpan={2}></td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </>
  );
}
