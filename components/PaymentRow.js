"use client";

import { useState } from "react";
import { progressLabel, progressStyle } from "@/lib/status";
import { AllocatePaymentButton, EditPaymentButton, DeletePaymentButton } from "./PaymentModal";

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

// Mirrors POSummaryRow/EstimateSummaryRow's click-to-expand pattern: which
// invoices a payment went to, and each one's own Paid/Partial Paid/Payment
// Pending status, lives entirely behind the expand arrow now instead of its
// own "Allocated To" column — the collapsed row only shows the payment
// itself (date, amount, balance, remarks).
export function PaymentRow({
  py,
  outstandingInvoices,
  canEdit,
  canDelete,
  refining = false,
  checked = true,
  onToggle,
}) {
  const [open, setOpen] = useState(false);
  const allocations = py.allocations || [];

  return (
    <>
      <tr
        className={allocations.length > 0 ? "cursor-pointer hover:bg-gray-50" : "hover:bg-gray-50"}
        onClick={allocations.length > 0 ? () => setOpen((v) => !v) : undefined}
      >
        <td className="px-3 py-3 text-gray-700 dark:text-gray-300">
          {refining && (
            <input
              type="checkbox"
              checked={checked}
              onChange={() => onToggle?.(py.py_id)}
              onClick={(e) => e.stopPropagation()}
              className="mr-1.5 align-middle"
            />
          )}
          {allocations.length > 0 && (
            <span className="mr-1.5 inline-block w-3 text-gray-400">{open ? "▾" : "▸"}</span>
          )}
          {formatDate(py.payment_date)}
        </td>
        <td className="px-3 py-3 text-right text-gray-700 dark:text-gray-300">
          {formatMoney(py.amount_received)}
        </td>
        <td className="px-3 py-3 text-right text-gray-700 dark:text-gray-300">{formatMoney(py.balance)}</td>
        <td className="px-3 py-3 text-gray-700 dark:text-gray-300">{py.remarks || "—"}</td>
        <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
          <div className="flex gap-2">
            {canEdit && <EditPaymentButton payment={py} />}
            {canEdit && <AllocatePaymentButton payment={py} outstandingInvoices={outstandingInvoices} />}
            {canDelete && <DeletePaymentButton pyId={py.py_id} />}
          </div>
        </td>
      </tr>
      {open && (
        <tr>
          <td colSpan={5} className="bg-gray-50 p-3 dark:bg-gray-900/40">
            <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
              <div className="border-b border-gray-100 bg-gray-50/60 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-gray-400 dark:border-gray-700 dark:bg-gray-900/40">
                Invoices this payment was allocated to
              </div>
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-xs text-gray-500 dark:text-gray-400">
                    <th className="px-3 pb-0 pt-2.5 text-left font-medium">Invoice No</th>
                    <th className="px-3 pb-0 pt-2.5 text-right font-medium">Amount Allocated</th>
                    <th className="px-3 pb-0 pt-2.5 text-right font-medium">Invoice Total</th>
                    <th className="px-3 pb-0 pt-2.5 text-center font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {allocations.map((a) => (
                    <tr key={a.invoice_no}>
                      <td className="px-3 py-2 text-gray-700 dark:text-gray-300">{a.invoice_no}</td>
                      <td className="px-3 py-2 text-right text-gray-700 dark:text-gray-300">
                        {formatMoney(a.amount)}
                      </td>
                      <td className="px-3 py-2 text-right text-gray-700 dark:text-gray-300">
                        {formatMoney(a.invoice_total)}
                      </td>
                      <td className="px-3 py-2 text-center">
                        <span
                          className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${progressStyle(a)}`}
                        >
                          {progressLabel(a, "Invoice")}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
