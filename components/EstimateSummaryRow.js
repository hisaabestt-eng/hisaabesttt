"use client";

import { useState } from "react";
import { lifecycleDisplay } from "@/lib/status";
import { parseTags } from "@/lib/tags";
import { EditEstimateButton, DeleteEstimateButton } from "./EstimateModal";
import { EditPOButton, DeletePOButton } from "./POModal";
import { EntityDocLink } from "./DocumentPreview";
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

function Field({ label, value }) {
  return (
    <div>
      <div className="text-xs font-medium uppercase tracking-wide text-gray-400">{label}</div>
      <div className="text-sm text-gray-800 dark:text-gray-100">{value}</div>
    </div>
  );
}

// Click the estimate row to expand and see the PO raised against it (if
// any) and the invoice(s) underneath — matches the same drill-down already
// on the Purchase Orders page, one level further up the chain.
export function EstimateSummaryRow({
  est,
  po,
  invoices,
  statusLabels = [],
  poStatusLabels = [],
  docFileExists,
  canEdit = true,
  canDelete = false,
  refining = false,
  checked = true,
  onToggle,
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <tr
        className={`cursor-pointer hover:bg-gray-50 ${refining && !checked ? "opacity-40" : ""}`}
        onClick={() => setOpen((v) => !v)}
      >
        <td className="px-3 py-3 font-mono text-xs text-gray-500 dark:text-gray-400">
          {refining && (
            <input
              type="checkbox"
              checked={checked}
              onChange={() => onToggle?.(est.est_id)}
              onClick={(e) => e.stopPropagation()}
              className="mr-1.5 align-middle"
            />
          )}
          <span className="mr-1.5 inline-block w-3 text-gray-400">{open ? "▾" : "▸"}</span>
          {est.record_id}
        </td>
        <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
          <EntityDocLink
            label={est.est_no}
            externalUrl={est.external_url}
            docId={est.doc_id}
            docFileExists={docFileExists}
            fileName={est.file_name}
            href={`/uploads/estimates/${est.est_id}-${est.file_name}`}
            className="text-gray-700 underline decoration-dotted hover:text-gray-900 dark:text-gray-300 dark:hover:text-gray-100"
          />
        </td>
        <td className="px-3 py-3 text-gray-700 dark:text-gray-300">{formatDate(est.estimate_date)}</td>
        <td className="px-3 py-3 text-gray-700 dark:text-gray-300">{est.description}</td>
        <td className="px-3 py-3 text-right text-gray-700 dark:text-gray-300">{formatMoney(est.amount)}</td>
        <td className="px-3 py-3 text-center">
          <span
            className={`inline-flex min-w-[120px] items-center justify-center whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${lifecycleDisplay(est).style}`}
          >
            {lifecycleDisplay(est).label}
          </span>
        </td>
        <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
          <div className="flex gap-2">
            {canEdit && <EditEstimateButton estimate={est} statusLabels={statusLabels} />}
            {canDelete && !est.po_id && <DeleteEstimateButton estId={est.est_id} />}
          </div>
        </td>
      </tr>
      {open && (
        <tr>
          <td colSpan={7} className="bg-gray-50 p-3 dark:bg-gray-900/40">
            <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
              <div className="border-b border-gray-100 px-3 py-2.5 dark:border-gray-700">
                <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-400">Tags</div>
                <EstimateTagsEditor estId={est.est_id} initialTags={parseTags(est.tags)} />
              </div>
              {po ? (
                <>
                  <div className="flex items-center justify-between gap-3 border-b border-gray-100 bg-gray-50/60 px-3 py-2 dark:border-gray-700 dark:bg-gray-900/40">
                    <div className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                      Purchase Order raised against {est.est_no}
                    </div>
                    <div className="flex gap-2">
                      {canEdit && <EditPOButton po={po} statusLabels={poStatusLabels} />}
                      {canDelete && !po.inv_id && <DeletePOButton poId={po.po_id} />}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3 px-3 py-2.5 sm:grid-cols-4">
                    <Field label="PO No" value={po.po_no} />
                    <Field label="PO Date" value={formatDate(po.po_date)} />
                    <Field label="Amount" value={formatMoney(po.amount)} />
                    <Field label="Balance to Invoice" value={formatMoney(po.invoice_balance)} />
                  </div>
                  <div className="border-t border-gray-100 dark:border-gray-700">
                    <div className="border-b border-gray-100 bg-gray-50/60 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-gray-400 dark:border-gray-700 dark:bg-gray-900/40">
                      Invoices raised against {po.po_no}
                    </div>
                    <InvoiceBreakdownTable
                      invoices={invoices}
                      emptyMessage={`No invoice yet — balance to invoice is the full PO amount (${formatMoney(po.amount)}).`}
                    />
                  </div>
                </>
              ) : invoices.length > 0 ? (
                <>
                  <div className="border-b border-gray-100 bg-gray-50/60 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-gray-400 dark:border-gray-700 dark:bg-gray-900/40">
                    Invoices raised directly against {est.est_no} (no PO)
                  </div>
                  <InvoiceBreakdownTable invoices={invoices} emptyMessage="" />
                </>
              ) : (
                <p className="px-3 py-2.5 text-xs text-gray-400">No Purchase Order or Invoice yet.</p>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
