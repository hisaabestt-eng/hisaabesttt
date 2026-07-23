"use client";

import { useState } from "react";
import { lifecycleDisplay } from "@/lib/status";
import { parseTags } from "@/lib/tags";
import { EditPOButton, DeletePOButton } from "./POModal";
import { DocumentPreviewLink } from "./DocumentPreview";
import { InvoiceBreakdownTable } from "./InvoiceBreakdownTable";
import { EstimateTagsEditor } from "./EstimateTagsEditor";

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
        <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
          <div className="flex gap-2">
            {canEdit && <EditPOButton po={po} statusLabels={statusLabels} />}
            {canDelete && !po.inv_id && <DeletePOButton poId={po.po_id} />}
          </div>
        </td>
      </tr>
      {open && (
        <tr>
          <td colSpan={10} className="bg-gray-50 p-3 dark:bg-gray-900/40">
            <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
              <div className="border-b border-gray-100 px-3 py-2.5 dark:border-gray-700">
                <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-400">Tags</div>
                <EstimateTagsEditor estId={po.est_id} initialTags={parseTags(po.estimate_tags)} />
              </div>
              <div className="border-b border-gray-100 bg-gray-50/60 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-gray-400 dark:border-gray-700 dark:bg-gray-900/40">
                Invoices raised against {po.po_no}
              </div>
              <InvoiceBreakdownTable
                invoices={invoices}
                emptyMessage={`No invoice yet — balance to invoice is the full PO amount (${formatMoney(po.amount)}).`}
              />
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
