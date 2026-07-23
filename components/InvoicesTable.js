"use client";

import {
  LIFECYCLE_STYLES,
  CUSTOM_STATUS_STYLE,
  progressLabel,
  progressStyle,
  invoiceDisplayStatus,
} from "@/lib/status";
import { EditInvoiceButton, DeleteInvoiceButton } from "./InvoiceModal";
import { DocumentPreviewLink } from "./DocumentPreview";
import { useRefineFilter, RefineToggleButton } from "./useRefineFilter";

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

// docFileExists and storedFileName are resolved server-side per invoice
// (need Node's fs, not available here) and passed in already computed, as
// inv.docFileExists / inv.storedFileName.
export function InvoicesTable({ invoices, statusLabels, canEdit, canDelete }) {
  const { refining, toggleRefining, visibleRows, isChecked, toggleRow } = useRefineFilter(
    invoices,
    (inv) => inv.inv_id
  );

  const totalAmount = visibleRows.reduce(
    (sum, inv) => (inv.lifecycle === "Raised" ? sum + (Number(inv.invoice_total) || 0) : sum),
    0
  );

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm text-gray-600 dark:text-gray-400">{invoices.length} invoices</div>
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
              <th className="min-w-[320px] px-3 py-3 text-left font-medium text-gray-600 dark:text-gray-400">
                Description
              </th>
              <th className="px-3 py-3 text-right font-medium text-gray-600 dark:text-gray-400">Total</th>
              <th className="px-3 py-3 text-left font-medium text-gray-600 dark:text-gray-400">Document</th>
              <th className="px-3 py-3 text-center font-medium text-gray-600 dark:text-gray-400">Status</th>
              <th className="px-3 py-3 text-center font-medium text-gray-600 dark:text-gray-400">Progress</th>
              <th className="px-3 py-3 text-left font-medium text-gray-600 dark:text-gray-400">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {visibleRows.map((inv) => (
              <tr key={inv.inv_id} className="hover:bg-gray-50">
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
                <td className="px-3 py-3 text-gray-700 dark:text-gray-300">{inv.description}</td>
                <td className="px-3 py-3 text-right text-gray-700 dark:text-gray-300">
                  {formatMoney(inv.invoice_total)}
                </td>
                <td className="px-3 py-3">
                  {inv.external_url ? (
                    <DocumentPreviewLink
                      href={inv.external_url}
                      externalUrl={inv.external_url}
                      className="text-xs text-blue-600 underline"
                    >
                      🔗 External Link
                    </DocumentPreviewLink>
                  ) : inv.doc_id && inv.docFileExists ? (
                    <DocumentPreviewLink
                      href={`/uploads/invoice/${inv.storedFileName}`}
                      fileName={inv.file_name}
                      className="text-xs text-blue-600 underline"
                    >
                      📎 {inv.file_name}
                    </DocumentPreviewLink>
                  ) : inv.doc_id ? (
                    <span className="text-xs text-gray-400" title="Uploaded before file storage was set up">
                      📎 {inv.file_name} (no file)
                    </span>
                  ) : (
                    <span className="text-xs text-gray-400">No document</span>
                  )}
                </td>
                <td className="px-3 py-3 text-center">
                  <span
                    className={`inline-flex min-w-[120px] items-center justify-center whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${
                      inv.custom_status ? CUSTOM_STATUS_STYLE : LIFECYCLE_STYLES[invoiceDisplayStatus(inv)]
                    }`}
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
                <td className="px-3 py-3">
                  <div className="flex gap-2">
                    {canEdit && <EditInvoiceButton invoice={inv} statusLabels={statusLabels} />}
                    {canDelete && inv.status !== "Paid" && inv.status !== "Partial Paid" && (
                      <DeleteInvoiceButton invId={inv.inv_id} />
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {visibleRows.length === 0 && (
              <tr>
                <td colSpan={9} className="px-3 py-6 text-center text-gray-500 dark:text-gray-400">
                  {invoices.length === 0 ? "No invoices found." : "All rows refined out — untick some to bring them back."}
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
                <td className="px-3 py-3 text-right text-gray-900 dark:text-gray-100">{formatMoney(totalAmount)}</td>
                <td colSpan={4}></td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </>
  );
}
