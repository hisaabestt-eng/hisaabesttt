"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  lifecycleDisplay,
  progressLabel,
  progressStyle,
  invoiceDisplayStatus,
  LIFECYCLE_STYLES,
  CUSTOM_STATUS_STYLE,
} from "@/lib/status";
import { EditRecordButton } from "./RecordModal";
import { EditEstimateButton } from "./EstimateModal";
import { EditPOButton } from "./POModal";
import { EditInvoiceButton } from "./InvoiceModal";

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

function Badge({ label, style }) {
  return (
    <span
      className={`inline-flex min-w-[100px] items-center justify-center whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold ${style}`}
    >
      {label}
    </span>
  );
}

function rowKey(row) {
  return row.invoice ? `inv-${row.invoice.inv_id}` : `rec-${row.record.record_id}`;
}

const TH = "whitespace-nowrap px-3 py-3 text-left font-medium text-gray-600 dark:text-gray-400";
const TH_R = "whitespace-nowrap px-3 py-3 text-right font-medium text-gray-600 dark:text-gray-400";
const TH_C = "whitespace-nowrap px-3 py-3 text-center font-medium text-gray-600 dark:text-gray-400";
const TD = "whitespace-nowrap px-3 py-2 text-gray-700 dark:text-gray-300";
const TD_R = "whitespace-nowrap px-3 py-2 text-right text-gray-700 dark:text-gray-300";
const TD_C = "whitespace-nowrap px-3 py-2 text-center";

export function MasterTable({
  rows,
  recordStatusLabels,
  estimateStatusLabels,
  poStatusLabels,
  invoiceStatusLabels,
  canEdit,
  canDelete,
}) {
  const [selected, setSelected] = useState(new Set());
  const [deleting, setDeleting] = useState(false);
  const router = useRouter();

  function toggleRow(key) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function toggleAll() {
    setSelected((prev) => (prev.size === rows.length ? new Set() : new Set(rows.map(rowKey))));
  }

  async function handleBulkDelete() {
    if (selected.size === 0) return;
    if (
      !confirm(
        `Delete ${selected.size} selected row(s)? If a Record/Estimate/PO is shared with an invoice you didn't select, that shared part is kept — only what's exclusively this row's gets removed. This cannot be undone.`
      )
    ) {
      return;
    }
    setDeleting(true);
    const payload = rows
      .filter((r) => selected.has(rowKey(r)))
      .map((r) => ({
        recordId: r.record.record_id,
        estId: r.estimate?.est_id || null,
        poId: r.po?.po_id || null,
        invId: r.invoice?.inv_id || null,
      }));
    const res = await fetch("/api/master-table/bulk-delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rows: payload }),
    });
    const data = await res.json();
    setDeleting(false);
    if (!res.ok) {
      alert(data.error || "Could not delete");
      return;
    }
    alert(
      `${data.fullyDeleted} row(s) fully removed. ${data.partiallyDeleted} row(s) partially cleared (some part was shared with another row and kept).`
    );
    setSelected(new Set());
    router.refresh();
  }

  const allSelected = rows.length > 0 && selected.size === rows.length;

  return (
    <div className="flex flex-col gap-3">
      {canDelete && selected.size > 0 && (
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleBulkDelete}
            disabled={deleting}
            className="rounded-full bg-red-600 px-3 py-1.5 text-sm text-white hover:bg-red-700 disabled:opacity-50"
          >
            {deleting ? "Deleting..." : `Delete Selected (${selected.size})`}
          </button>
        </div>
      )}

      <div className="max-h-[70vh] overflow-auto rounded-lg border border-gray-100 dark:border-gray-700">
        <table className="min-w-full divide-y divide-gray-100 text-sm dark:divide-gray-700">
          <thead className="sticky top-0 z-10 bg-gray-50 dark:bg-gray-900/40">
            <tr>
              {canDelete && (
                <th className="px-3 py-3">
                  <input type="checkbox" checked={allSelected} onChange={toggleAll} />
                </th>
              )}
              <th className={TH}>Client</th>
              <th className={TH}>Record ID</th>
              <th className={TH}>Record Date</th>
              <th className={TH}>Record Description</th>
              <th className={TH_R}>Record Amount</th>
              <th className={TH_C}>Record Status</th>
              <th className={TH}>Estimate No</th>
              <th className={TH}>Estimate Date</th>
              <th className={TH_R}>Estimate Amount</th>
              <th className={TH_C}>Estimate Status</th>
              <th className={TH}>PO No</th>
              <th className={TH}>PO Date</th>
              <th className={TH_R}>PO Amount</th>
              <th className={TH_C}>PO Status</th>
              <th className={TH}>Invoice No</th>
              <th className={TH}>Invoice Date</th>
              <th className={TH_R}>Invoice Amount</th>
              <th className={TH_R}>Invoice Total</th>
              <th className={TH_C}>Invoice Status</th>
              <th className={TH_C}>Invoice Progress</th>
              <th className={TH}>Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {rows.map((row) => {
              const key = rowKey(row);
              const isSelected = selected.has(key);
              return (
                <tr
                  key={key}
                  className={isSelected ? "bg-blue-50 dark:bg-blue-950/30" : "hover:bg-gray-50 dark:hover:bg-gray-800/40"}
                >
                  {canDelete && (
                    <td className="px-3 py-2">
                      <input type="checkbox" checked={isSelected} onChange={() => toggleRow(key)} />
                    </td>
                  )}
                  <td className={TD}>{row.record.client_name}</td>
                  <td className={`${TD} font-mono text-xs`}>{row.record.record_id}</td>
                  <td className={TD}>{formatDate(row.record.record_date)}</td>
                  <td className={TD}>{row.record.description}</td>
                  <td className={TD_R}>{formatMoney(row.record.amount)}</td>
                  <td className={TD_C}>
                    <Badge {...lifecycleDisplay(row.record)} />
                  </td>

                  <td className={TD}>{row.estimate?.est_no || "—"}</td>
                  <td className={TD}>{row.estimate ? formatDate(row.estimate.estimate_date) : "—"}</td>
                  <td className={TD_R}>{row.estimate ? formatMoney(row.estimate.amount) : "—"}</td>
                  <td className={TD_C}>{row.estimate ? <Badge {...lifecycleDisplay(row.estimate)} /> : "—"}</td>

                  <td className={TD}>{row.po?.po_no || "—"}</td>
                  <td className={TD}>{row.po ? formatDate(row.po.po_date) : "—"}</td>
                  <td className={TD_R}>{row.po ? formatMoney(row.po.amount) : "—"}</td>
                  <td className={TD_C}>{row.po ? <Badge {...lifecycleDisplay(row.po)} /> : "—"}</td>

                  <td className={TD}>{row.invoice?.invoice_no || "—"}</td>
                  <td className={TD}>{row.invoice ? formatDate(row.invoice.invoice_date) : "—"}</td>
                  <td className={TD_R}>{row.invoice ? formatMoney(row.invoice.invoice_amount) : "—"}</td>
                  <td className={TD_R}>{row.invoice ? formatMoney(row.invoice.invoice_total) : "—"}</td>
                  <td className={TD_C}>
                    {row.invoice ? (
                      <Badge
                        label={invoiceDisplayStatus(row.invoice)}
                        style={
                          row.invoice.custom_status
                            ? CUSTOM_STATUS_STYLE
                            : LIFECYCLE_STYLES[invoiceDisplayStatus(row.invoice)]
                        }
                      />
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className={TD_C}>
                    {row.invoice ? (
                      <Badge label={progressLabel(row.invoice, "Invoice")} style={progressStyle(row.invoice)} />
                    ) : (
                      "—"
                    )}
                  </td>

                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-2">
                      {canEdit && <EditRecordButton record={row.record} statusLabels={recordStatusLabels} />}
                      {canEdit && row.estimate && (
                        <EditEstimateButton estimate={row.estimate} statusLabels={estimateStatusLabels} />
                      )}
                      {canEdit && row.po && <EditPOButton po={row.po} statusLabels={poStatusLabels} />}
                      {canEdit && row.invoice && (
                        <EditInvoiceButton invoice={row.invoice} statusLabels={invoiceStatusLabels} />
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={22} className="px-3 py-6 text-center text-gray-500 dark:text-gray-400">
                  No data found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
