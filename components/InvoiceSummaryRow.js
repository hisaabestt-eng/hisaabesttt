"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { progressLabel, progressStyle } from "@/lib/status";

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

function toDateInputValue(value) {
  const d = value ? new Date(value) : new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// Once an invoice is Submitted but no real payment has landed yet, the
// payment-status cell lets the user pick In Progress / Scheduled right here
// — no need to open the full Invoice edit modal. Once a payment allocation
// exists, the badge switches to Partial Paid/Paid and this edit affordance
// disappears (that part is automatic, computed in listInvoiceSummaries).
function PaymentProgressCell({ invoice, canEdit }) {
  const editable =
    canEdit &&
    invoice.lifecycle === "Raised" &&
    (invoice.status === "In Progress" || invoice.status === "Scheduled");
  const [editing, setEditing] = useState(false);
  const [progressChoice, setProgressChoice] = useState(invoice.status === "Scheduled" ? "Scheduled" : "In Progress");
  const [scheduledDate, setScheduledDate] = useState(
    invoice.scheduled_payment_date ? toDateInputValue(invoice.scheduled_payment_date) : toDateInputValue()
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  async function handleSave() {
    setSaving(true);
    setError("");
    const res = await fetch(`/api/invoices-admin/${invoice.inv_id}/progress`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        scheduledPaymentDate: progressChoice === "Scheduled" ? scheduledDate || null : null,
        rejected: progressChoice === "Rejected",
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setSaving(false);
      setError(data.error || "Could not update");
      return;
    }
    setSaving(false);
    setEditing(false);
    router.refresh();
  }

  if (editing) {
    return (
      <div
        className="flex flex-col gap-1.5 rounded-md border border-gray-200 bg-gray-50 p-2"
        onClick={(e) => e.stopPropagation()}
      >
        {error && <p className="text-xs text-red-600">{error}</p>}
        <select
          value={progressChoice}
          onChange={(e) => setProgressChoice(e.target.value)}
          className="w-full rounded-md border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 px-1.5 py-1 text-xs"
        >
          <option value="In Progress">In Progress</option>
          <option value="Scheduled">Scheduled</option>
          <option value="Rejected">Rejected</option>
        </select>
        {progressChoice === "Scheduled" && (
          <input
            type="date"
            value={scheduledDate}
            onChange={(e) => setScheduledDate(e.target.value)}
            className="w-full rounded-md border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 px-1.5 py-1 text-xs"
          />
        )}
        {progressChoice === "Rejected" && (
          <p className="text-xs text-red-600">This will mark the invoice as Rejected.</p>
        )}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="rounded-full bg-blue-600 px-2 py-0.5 text-xs text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save"}
          </button>
          <button
            type="button"
            onClick={() => setEditing(false)}
            className="rounded-md border px-2 py-0.5 text-xs text-gray-600 hover:bg-gray-100"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center gap-2">
      <div>
        <span className={`inline-flex min-w-[120px] items-center justify-center whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${progressStyle(invoice)}`}>
          {progressLabel(invoice, "Invoice")}
        </span>
        {invoice.status === "Scheduled" && invoice.scheduled_payment_date && (
          <div className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
            {formatDate(invoice.scheduled_payment_date)}
          </div>
        )}
      </div>
      {editable && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setEditing(true);
          }}
          className="text-xs text-gray-500 underline hover:text-gray-900 dark:text-gray-100"
        >
          Edit
        </button>
      )}
    </div>
  );
}

function PaymentStatusCell({ payment }) {
  return <span>{payment.payment_status || "—"}</span>;
}

// One invoice = one row (standard outstanding/ageing-report style). Click
// to expand and see the individual payments that were applied to it,
// instead of flattening that history into the main list.
export function InvoiceSummaryRow({ invoice, canEdit = false }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <tr
        className="cursor-pointer hover:bg-gray-50"
        onClick={() => setOpen((v) => !v)}
      >
        <td className="px-3 py-3 text-gray-700 dark:text-gray-300">
          <span className="mr-1.5 inline-block w-3 text-gray-400">{open ? "▾" : "▸"}</span>
          {invoice.invoice_no}
        </td>
        <td className="px-3 py-3 text-right text-gray-700 dark:text-gray-300">{formatMoney(invoice.invoice_total)}</td>
        <td className="px-3 py-3 text-right text-gray-700 dark:text-gray-300">{formatMoney(invoice.total_received)}</td>
        <td className="px-3 py-3 text-right text-gray-700 dark:text-gray-300">{formatMoney(invoice.balance_due)}</td>
        <td className="px-3 py-3 text-center">
          <PaymentProgressCell invoice={invoice} canEdit={canEdit} />
        </td>
      </tr>
      {open && (
        <tr>
          <td colSpan={5} className="bg-gray-50 p-3 dark:bg-gray-900/40">
            <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
              <div className="border-b border-gray-100 bg-gray-50/60 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-gray-400 dark:border-gray-700 dark:bg-gray-900/40">
                Payment history for {invoice.invoice_no}
              </div>
              {invoice.payments.length === 0 ? (
                <p className="px-3 py-2.5 text-xs text-gray-400">No payments received yet.</p>
              ) : (
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="text-xs text-gray-500 dark:text-gray-400">
                      <th className="px-3 pb-0 pt-2.5 text-left font-medium">Payment Date</th>
                      <th className="px-3 pb-0 pt-2.5 text-right font-medium">Amount Allocated</th>
                      <th className="px-3 pb-0 pt-2.5 text-center font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {invoice.payments.map((p) => (
                      <tr key={p.py_id}>
                        <td className="px-3 py-2 text-gray-700 dark:text-gray-300">{formatDate(p.allocated_at)}</td>
                        <td className="px-3 py-2 text-right text-gray-700 dark:text-gray-300">{formatMoney(p.amount)}</td>
                        <td className="px-3 py-2 text-center text-gray-700 dark:text-gray-300">
                          <PaymentStatusCell payment={p} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
