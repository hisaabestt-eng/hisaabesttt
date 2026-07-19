"use client";

import { useState } from "react";
import Link from "next/link";
import { lifecycleDisplay } from "@/lib/status";
import { EditRecordButton, DeleteRecordButton } from "./RecordModal";
import { EditEstimateButton, DeleteEstimateButton } from "./EstimateModal";
import { EditPOButton, DeletePOButton } from "./POModal";
import { InvoiceBreakdownTable } from "./InvoiceBreakdownTable";

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

// Click the record row to expand and see its Estimate, PO, and Invoice(s) —
// same drill-down idea as the Purchase Orders / Estimates pages, one level
// further up the chain.
export function RecordRow({
  record,
  estimate,
  po,
  invoices,
  statusLabels = [],
  estimateStatusLabels = [],
  poStatusLabels = [],
  canEdit = true,
  canDelete = false,
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <tr className="cursor-pointer hover:bg-gray-50" onClick={() => setOpen((v) => !v)}>
        <td className="px-3 py-3 font-mono text-xs text-gray-500 dark:text-gray-400">
          <span className="mr-1.5 inline-block w-3 text-gray-400">{open ? "▾" : "▸"}</span>
          {record.record_id}
        </td>
        <td className="px-3 py-3 text-gray-700 dark:text-gray-300">{formatDate(record.record_date)}</td>
        <td className="px-3 py-3 text-gray-700 dark:text-gray-300" onClick={(e) => e.stopPropagation()}>
          <Link
            href={`/records/${record.record_id}`}
            className="underline decoration-dotted hover:text-gray-900 dark:hover:text-gray-100"
          >
            {record.description}
          </Link>
        </td>
        <td className="px-3 py-3 text-right text-gray-700 dark:text-gray-300">{formatMoney(record.amount)}</td>
        <td className="px-3 py-3 text-center">
          <span
            className={`inline-flex min-w-[120px] items-center justify-center whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${lifecycleDisplay(record).style}`}
          >
            {lifecycleDisplay(record).label}
          </span>
        </td>
        <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
          <div className="flex gap-2">
            {canEdit && <EditRecordButton record={record} statusLabels={statusLabels} />}
            {canDelete && !record.est_id && <DeleteRecordButton recordId={record.record_id} />}
          </div>
        </td>
      </tr>
      {open && (
        <tr>
          <td colSpan={6} className="bg-gray-50 p-3 dark:bg-gray-900/40">
            <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
              {estimate ? (
                <>
                  <div className="flex items-center justify-between gap-3 border-b border-gray-100 bg-gray-50/60 px-3 py-2 dark:border-gray-700 dark:bg-gray-900/40">
                    <div className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                      Estimate raised against this record
                    </div>
                    <div className="flex gap-2">
                      {canEdit && <EditEstimateButton estimate={estimate} statusLabels={estimateStatusLabels} />}
                      {canDelete && !estimate.po_id && <DeleteEstimateButton estId={estimate.est_id} />}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3 px-3 py-2.5 sm:grid-cols-4">
                    <Field label="Estimate No" value={estimate.est_no} />
                    <Field label="Estimate Date" value={formatDate(estimate.estimate_date)} />
                    <Field label="Amount" value={formatMoney(estimate.amount)} />
                  </div>

                  {po ? (
                    <>
                      <div className="flex items-center justify-between gap-3 border-t border-gray-100 bg-gray-50/60 px-3 py-2 dark:border-gray-700 dark:bg-gray-900/40">
                        <div className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                          Purchase Order raised against {estimate.est_no}
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
                    <div className="border-t border-gray-100 dark:border-gray-700">
                      <div className="border-b border-gray-100 bg-gray-50/60 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-gray-400 dark:border-gray-700 dark:bg-gray-900/40">
                        Invoices raised directly against {estimate.est_no} (no PO)
                      </div>
                      <InvoiceBreakdownTable invoices={invoices} emptyMessage="" />
                    </div>
                  ) : (
                    <p className="border-t border-gray-100 px-3 py-2.5 text-xs text-gray-400 dark:border-gray-700">
                      No Purchase Order or Invoice yet.
                    </p>
                  )}
                </>
              ) : (
                <p className="px-3 py-2.5 text-xs text-gray-400">No Estimate yet.</p>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
