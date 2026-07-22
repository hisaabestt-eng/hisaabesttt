"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { DateField } from "./DateField";

function toDateInputValue(value) {
  const d = value ? new Date(value) : new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatINR(value) {
  return Number(value || 0).toLocaleString("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  });
}

// One row of the allocation table: pick an outstanding invoice for this
// client, then how much of the payment's remaining balance goes to it.
// Options already picked in other rows are hidden so the same invoice
// can't be allocated twice.
function AllocationRow({ row, invoices, usedInvoiceNos, maxAmount, onChange, onRemove, canRemove }) {
  const available = invoices.filter(
    (inv) => inv.invoice_no === row.invoiceNo || !usedInvoiceNos.includes(inv.invoice_no)
  );
  const selected = invoices.find((inv) => inv.invoice_no === row.invoiceNo);
  const exceedsMax = maxAmount !== undefined && Number(row.amount) > maxAmount + 0.01;

  return (
    <div className="flex items-end gap-2">
      <div className="flex-1">
        <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">Invoice</label>
        <select
          value={row.invoiceNo}
          onChange={(e) => {
            const invoiceNo = e.target.value;
            // Pre-fill with the invoice's own balance (capped by whatever's
            // actually available for this row) so the common case — pay one
            // invoice in full — needs no typing; still fully editable after.
            const inv = invoices.find((i) => i.invoice_no === invoiceNo);
            const suggested = inv ? Math.min(Number(inv.balance), maxAmount ?? Number(inv.balance)) : "";
            onChange({ ...row, invoiceNo, amount: inv ? String(suggested) : "" });
          }}
          required
          className="w-full rounded-md border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 px-2 py-1.5 text-sm"
        >
          <option value="">Select invoice…</option>
          {available.map((inv) => (
            <option key={inv.invoice_no} value={inv.invoice_no}>
              {inv.invoice_no} — {inv.description} (balance {formatINR(inv.balance)})
            </option>
          ))}
        </select>
        {selected && (
          <p className="mt-1 text-xs text-gray-400">Balance due: {formatINR(selected.balance)}</p>
        )}
      </div>
      <div className="w-36">
        <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">Amount</label>
        <input
          type="number"
          min="0"
          max={maxAmount !== undefined ? maxAmount : undefined}
          step="0.01"
          value={row.amount}
          onChange={(e) => onChange({ ...row, amount: e.target.value })}
          required
          className={`w-full rounded-md border px-2 py-1.5 text-sm dark:bg-gray-700 dark:text-gray-100 ${
            exceedsMax ? "border-red-400" : "border-gray-300 dark:border-gray-600"
          }`}
        />
        {maxAmount !== undefined && (
          <p className={`mt-1 text-xs ${exceedsMax ? "text-red-600" : "text-gray-400"}`}>
            Max: {formatINR(maxAmount)}
          </p>
        )}
      </div>
      <button
        type="button"
        onClick={onRemove}
        disabled={!canRemove}
        className="mb-1.5 rounded-md border px-2 py-1.5 text-xs text-gray-500 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40 dark:text-gray-400 dark:hover:bg-gray-700"
      >
        ✕
      </button>
    </div>
  );
}

// Step 1: just record that the client handed over money. No invoices here —
// that's a separate step (AllocatePaymentButton) once the payment exists.
export function AddPaymentButton({ compId, clientId }) {
  const [open, setOpen] = useState(false);
  const [paymentDate, setPaymentDate] = useState(toDateInputValue());
  const [amountReceived, setAmountReceived] = useState("");
  const [remarks, setRemarks] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSaving(true);
    const res = await fetch("/api/payments-admin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ compId, clientId, paymentDate, amountReceived, remarks }),
    });
    const data = await res.json();
    if (!res.ok) {
      setSaving(false);
      setError(data.error || "Could not save payment");
      return;
    }
    setSaving(false);
    setOpen(false);
    setAmountReceived("");
    setRemarks("");
    router.refresh();
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-full bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
      >
        + Add Payment
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setOpen(false)}
        >
          <form
            onSubmit={handleSubmit}
            onClick={(e) => e.stopPropagation()}
            className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-lg bg-white dark:bg-gray-800 p-5 shadow-xl"
          >
            <h2 className="mb-3 text-base font-semibold text-gray-900 dark:text-gray-100">Add Payment</h2>
            {error && <p className="mb-2 text-sm text-red-600">{error}</p>}

            <div className="flex flex-col gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">Payment Date</label>
                <DateField
                  value={paymentDate}
                  onChange={setPaymentDate}
                  required
                  className="w-full rounded-md border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 px-2 py-1.5 text-sm"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">Amount Received</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={amountReceived}
                  onChange={(e) => setAmountReceived(e.target.value)}
                  required
                  className="w-full rounded-md border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 px-2 py-1.5 text-sm"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">Remarks (optional)</label>
                <input
                  type="text"
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  className="w-full rounded-md border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 px-2 py-1.5 text-sm"
                />
              </div>
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-md border px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-400 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="rounded-full bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save"}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}

// Step 2: apply an already-recorded payment's remaining balance to one or
// more of the client's outstanding invoices.
export function AllocatePaymentButton({ payment, outstandingInvoices }) {
  const [open, setOpen] = useState(false);
  const [allocationDate, setAllocationDate] = useState(toDateInputValue(payment.payment_date));
  const [rows, setRows] = useState([{ invoiceNo: outstandingInvoices[0]?.invoice_no || "", amount: "" }]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  const usedInvoiceNos = rows.map((r) => r.invoiceNo).filter(Boolean);
  const totalAllocated = rows.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
  const remainingToAllocate = Number(payment.balance) - totalAllocated;

  function updateRow(index, next) {
    setRows((prev) => prev.map((r, i) => (i === index ? next : r)));
  }

  function addRow() {
    setRows((prev) => [...prev, { invoiceNo: "", amount: "" }]);
  }

  function removeRow(index) {
    setRows((prev) => prev.filter((_, i) => i !== index));
  }

  // outstandingInvoices' balances shrink after each allocation, but this
  // component doesn't remount between opens — re-sync to a fresh single row
  // so it doesn't show a stale invoice/amount from a previous allocation.
  // Allocation date defaults to the payment's own date (money was received
  // then, so that's the natural default) rather than today — and since it's
  // read fresh from `payment` each time, editing the payment's date later
  // carries through automatically the next time this is opened.
  function handleOpen() {
    setAllocationDate(toDateInputValue(payment.payment_date));
    setRows([{ invoiceNo: outstandingInvoices[0]?.invoice_no || "", amount: "" }]);
    setOpen(true);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSaving(true);
    const res = await fetch(`/api/payments-admin/${payment.py_id}/allocate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        allocationDate,
        allocations: rows.filter((r) => r.invoiceNo && Number(r.amount) > 0),
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setSaving(false);
      setError(data.error || "Could not allocate payment");
      return;
    }
    setSaving(false);
    setOpen(false);
    router.refresh();
  }

  if (Number(payment.balance) <= 0 || outstandingInvoices.length === 0) {
    return null;
  }

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        className="text-xs text-blue-600 underline hover:text-blue-800"
      >
        Allocate
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setOpen(false)}
        >
          <form
            onSubmit={handleSubmit}
            onClick={(e) => e.stopPropagation()}
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg bg-white dark:bg-gray-800 p-5 shadow-xl"
          >
            <h2 className="mb-3 text-base font-semibold text-gray-900 dark:text-gray-100">Allocate Payment</h2>
            {error && <p className="mb-2 text-sm text-red-600">{error}</p>}

            <div className="mb-3 rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-600 dark:text-gray-400">
              Unallocated balance on this payment: {formatINR(payment.balance)}
            </div>

            <div className="flex flex-col gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">Allocation Date</label>
                <DateField
                  value={allocationDate}
                  onChange={setAllocationDate}
                  required
                  className="w-full rounded-md border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 px-2 py-1.5 text-sm"
                />
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between">
                  <label className="text-xs font-medium text-gray-500 dark:text-gray-400">Allocate to Invoices</label>
                  {rows.length < outstandingInvoices.length && (
                    <button type="button" onClick={addRow} className="text-xs text-blue-600 underline">
                      + Add another invoice
                    </button>
                  )}
                </div>
                <div className="flex flex-col gap-2">
                  {rows.map((row, i) => {
                    const selected = outstandingInvoices.find((inv) => inv.invoice_no === row.invoiceNo);
                    const otherRowsTotal = totalAllocated - (Number(row.amount) || 0);
                    const remainingPaymentForRow = Number(payment.balance) - otherRowsTotal;
                    const maxAmount = selected
                      ? Math.min(Number(selected.balance), remainingPaymentForRow)
                      : remainingPaymentForRow;
                    return (
                      <AllocationRow
                        key={i}
                        row={row}
                        invoices={outstandingInvoices}
                        usedInvoiceNos={usedInvoiceNos}
                        maxAmount={maxAmount}
                        onChange={(next) => updateRow(i, next)}
                        onRemove={() => removeRow(i)}
                        canRemove={rows.length > 1}
                      />
                    );
                  })}
                </div>
              </div>

              <div className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm">
                <div className="flex justify-between text-gray-600 dark:text-gray-400">
                  <span>Allocated</span>
                  <span>{formatINR(totalAllocated)}</span>
                </div>
                {remainingToAllocate < -0.01 ? (
                  <div className="mt-1 flex justify-between font-medium text-red-600">
                    <span>Over-allocated by</span>
                    <span>{formatINR(-remainingToAllocate)}</span>
                  </div>
                ) : (
                  <div className="mt-1 flex justify-between font-medium text-gray-700 dark:text-gray-300">
                    <span>Unallocated</span>
                    <span>{formatINR(remainingToAllocate)}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-md border px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-400 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving || remainingToAllocate < -0.01}
                className="rounded-full bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save"}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}

export function EditPaymentButton({ payment }) {
  const [open, setOpen] = useState(false);
  const [paymentDate, setPaymentDate] = useState(toDateInputValue(payment.payment_date));
  const [remarks, setRemarks] = useState(payment.remarks || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSaving(true);
    const res = await fetch(`/api/payments-admin/${payment.py_id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paymentDate, remarks }),
    });
    const data = await res.json();
    if (!res.ok) {
      setSaving(false);
      setError(data.error || "Could not save changes");
      return;
    }
    setSaving(false);
    setOpen(false);
    router.refresh();
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-xs text-gray-600 underline hover:text-gray-900 dark:text-gray-100"
      >
        Edit
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setOpen(false)}
        >
          <form
            onSubmit={handleSubmit}
            onClick={(e) => e.stopPropagation()}
            className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-lg bg-white dark:bg-gray-800 p-5 shadow-xl"
          >
            <h2 className="mb-3 text-base font-semibold text-gray-900 dark:text-gray-100">Edit Payment</h2>
            {error && <p className="mb-2 text-sm text-red-600">{error}</p>}

            <div className="flex flex-col gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">Payment Date</label>
                <DateField
                  value={paymentDate}
                  onChange={setPaymentDate}
                  required
                  className="w-full rounded-md border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 px-2 py-1.5 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">Remarks (optional)</label>
                <input
                  type="text"
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  className="w-full rounded-md border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 px-2 py-1.5 text-sm"
                />
              </div>

              {payment.allocations.length > 0 && (
                <div className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm">
                  <div className="mb-1 text-xs font-medium text-gray-500 dark:text-gray-400">
                    Allocated to (not editable here)
                  </div>
                  {payment.allocations.map((a) => (
                    <div key={a.invoice_no} className="flex justify-between text-gray-600 dark:text-gray-400">
                      <span>{a.invoice_no}</span>
                      <span>{formatINR(a.amount)}</span>
                    </div>
                  ))}
                  <p className="mt-2 text-xs text-gray-400">
                    To change invoices or amounts, delete this payment and record it again.
                  </p>
                </div>
              )}
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-md border px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-400 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="rounded-full bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save"}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}

export function DeletePaymentButton({ pyId }) {
  const router = useRouter();

  async function handleDelete() {
    if (!confirm("Delete this payment? Its invoices will return to unpaid/partially-paid. This cannot be undone.")) {
      return;
    }
    const res = await fetch(`/api/payments-admin/${pyId}`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok) {
      alert(data.error || "Could not delete");
      return;
    }
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={handleDelete}
      className="text-xs text-red-600 underline hover:text-red-800"
    >
      Delete
    </button>
  );
}
