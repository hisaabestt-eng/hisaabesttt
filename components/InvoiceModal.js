"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { DocumentField, EMPTY_DOC, uploadDocumentField } from "./DocumentField";

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

function AmountFields({ invoiceAmount, setInvoiceAmount, gstPct, setGstPct, tdsPct, setTdsPct, disabled }) {
  const amount = Number(invoiceAmount) || 0;
  const gstAmount = (amount * (Number(gstPct) || 0)) / 100;
  const tdsAmount = (amount * (Number(tdsPct) || 0)) / 100;
  const subtotal = amount + gstAmount;
  const total = subtotal - tdsAmount;

  return (
    <>
      <div>
        <label className="mb-1 block text-xs font-medium text-gray-500">Invoice Amount</label>
        <input
          type="number"
          min="0"
          step="0.01"
          value={invoiceAmount}
          onChange={(e) => setInvoiceAmount(e.target.value)}
          required
          disabled={disabled}
          className="w-full rounded border-gray-300 px-2 py-1.5 text-sm disabled:bg-gray-100 disabled:text-gray-500"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500">GST % (e.g. 18)</label>
          <div className="flex items-center rounded border border-gray-300 focus-within:ring-1 focus-within:ring-gray-400">
            <input
              type="number"
              min="0"
              step="0.01"
              value={gstPct}
              onChange={(e) => setGstPct(e.target.value)}
              disabled={disabled}
              className="w-full appearance-none rounded border-0 px-2 py-1.5 text-right text-sm outline-none [-moz-appearance:textfield] disabled:bg-gray-100 disabled:text-gray-500 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            />
            <span className="pr-2 text-sm text-gray-400">%</span>
          </div>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500">TDS % (e.g. 2)</label>
          <div className="flex items-center rounded border border-gray-300 focus-within:ring-1 focus-within:ring-gray-400">
            <input
              type="number"
              min="0"
              step="0.01"
              value={tdsPct}
              onChange={(e) => setTdsPct(e.target.value)}
              disabled={disabled}
              className="w-full appearance-none rounded border-0 px-2 py-1.5 text-right text-sm outline-none [-moz-appearance:textfield] disabled:bg-gray-100 disabled:text-gray-500 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            />
            <span className="pr-2 text-sm text-gray-400">%</span>
          </div>
        </div>
      </div>
      {disabled && (
        <p className="text-xs text-gray-400">
          A payment already exists — edit the amount on the Payments page instead.
        </p>
      )}
      <div className="rounded border border-gray-200 bg-gray-50 px-3 py-2 text-sm">
        <div className="flex justify-between text-gray-700">
          <span>Invoice Amount</span>
          <span>{formatINR(amount)}</span>
        </div>
        <div className="mt-1 flex justify-between text-gray-600">
          <span>Add: GST ({gstPct || 0}%)</span>
          <span>+{formatINR(gstAmount)}</span>
        </div>
        <div className="mt-1 flex justify-between border-t border-gray-200 pt-1 text-gray-700">
          <span>Subtotal</span>
          <span>{formatINR(subtotal)}</span>
        </div>
        <div className="mt-1 flex justify-between text-gray-600">
          <span>Less: TDS ({tdsPct || 0}%)</span>
          <span>-{formatINR(tdsAmount)}</span>
        </div>
        <div className="mt-1 flex justify-between border-t border-gray-200 pt-1 font-medium text-gray-900">
          <span>Invoice Total</span>
          <span>{formatINR(total)}</span>
        </div>
      </div>
    </>
  );
}

export function AddInvoiceButton({ pos }) {
  const [open, setOpen] = useState(false);
  const [poId, setPoId] = useState(pos[0]?.po_id || "");
  const [invoiceNo, setInvoiceNo] = useState("");
  const [invoiceDate, setInvoiceDate] = useState(toDateInputValue());
  const [description, setDescription] = useState(pos[0]?.description || "");
  const [invoiceAmount, setInvoiceAmount] = useState(pos[0]?.amount || "");
  const [gstPct, setGstPct] = useState("18");
  const [tdsPct, setTdsPct] = useState("2");
  const [doc, setDoc] = useState(EMPTY_DOC);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  function handlePOChange(e) {
    const id = e.target.value;
    setPoId(id);
    const po = pos.find((p) => p.po_id === id);
    if (po) {
      setDescription(po.description);
      setInvoiceAmount(po.amount);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSaving(true);
    const res = await fetch("/api/invoices-admin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        poId,
        invoiceNo,
        invoiceDate,
        description,
        invoiceAmount,
        gstPercentage: Number(gstPct) / 100,
        tdsPercentage: Number(tdsPct) / 100,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setSaving(false);
      setError(data.error || "Could not save invoice");
      return;
    }
    await uploadDocumentField(`/api/invoices-admin/${data.invId}/document`, doc);
    setSaving(false);
    setOpen(false);
    setInvoiceNo("");
    setDoc(EMPTY_DOC);
    router.refresh();
  }

  if (pos.length === 0) {
    return (
      <span className="text-xs text-gray-400">
        No purchase orders yet — add one on the Purchase Orders page first.
      </span>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded bg-gray-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-gray-700"
      >
        + Add Invoice
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setOpen(false)}
        >
          <form
            onSubmit={handleSubmit}
            onClick={(e) => e.stopPropagation()}
            className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-lg bg-white p-5 shadow-xl"
          >
            <h2 className="mb-3 text-base font-semibold text-gray-900">Add Invoice</h2>
            {error && <p className="mb-2 text-sm text-red-600">{error}</p>}

            <div className="flex flex-col gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500">Purchase Order</label>
                <select
                  value={poId}
                  onChange={handlePOChange}
                  required
                  className="w-full rounded border-gray-300 px-2 py-1.5 text-sm"
                >
                  {pos.map((po) => (
                    <option key={po.po_id} value={po.po_id}>
                      {po.client_name} — {po.po_no} — {po.description} (
                      {new Date(po.po_date).toLocaleDateString("en-IN")})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500">Invoice No</label>
                <input
                  type="text"
                  value={invoiceNo}
                  onChange={(e) => setInvoiceNo(e.target.value)}
                  required
                  className="w-full rounded border-gray-300 px-2 py-1.5 text-sm"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500">Invoice Date</label>
                <input
                  type="date"
                  value={invoiceDate}
                  onChange={(e) => setInvoiceDate(e.target.value)}
                  required
                  className="w-full rounded border-gray-300 px-2 py-1.5 text-sm"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500">Description</label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  required
                  className="w-full rounded border-gray-300 px-2 py-1.5 text-sm"
                />
              </div>

              <AmountFields
                invoiceAmount={invoiceAmount}
                setInvoiceAmount={setInvoiceAmount}
                gstPct={gstPct}
                setGstPct={setGstPct}
                tdsPct={tdsPct}
                setTdsPct={setTdsPct}
                disabled={false}
              />

              <DocumentField label="Document (optional)" doc={doc} setDoc={setDoc} />
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded border px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="rounded bg-gray-900 px-3 py-1.5 text-sm text-white disabled:opacity-50"
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

export function EditInvoiceButton({ invoice }) {
  const [open, setOpen] = useState(false);
  const [invoiceNo, setInvoiceNo] = useState(invoice.invoice_no);
  const [invoiceDate, setInvoiceDate] = useState(toDateInputValue(invoice.invoice_date));
  const [description, setDescription] = useState(invoice.description);
  const [invoiceAmount, setInvoiceAmount] = useState(invoice.invoice_amount);
  const [gstPct, setGstPct] = useState(Number(invoice.gst_percentage) * 100);
  const [tdsPct, setTdsPct] = useState(Number(invoice.tds_percentage) * 100);
  const [doc, setDoc] = useState(EMPTY_DOC);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [archiving, setArchiving] = useState(false);
  const router = useRouter();
  const amountLocked = invoice.status !== "Payment Pending";

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSaving(true);
    const res = await fetch(`/api/invoices-admin/${invoice.inv_id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        invoiceNo,
        invoiceDate,
        description,
        invoiceAmount,
        gstPercentage: Number(gstPct) / 100,
        tdsPercentage: Number(tdsPct) / 100,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setSaving(false);
      setError(data.error || "Could not save changes");
      return;
    }
    await uploadDocumentField(`/api/invoices-admin/${invoice.inv_id}/document`, doc);
    setSaving(false);
    setOpen(false);
    router.refresh();
  }

  async function handleArchiveToggle() {
    setArchiving(true);
    setError("");
    const res = await fetch(`/api/invoices-admin/${invoice.inv_id}/archive`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ archived: !invoice.is_archived }),
    });
    const data = await res.json();
    setArchiving(false);
    if (!res.ok) {
      setError(data.error || "Could not update archive status");
      return;
    }
    setOpen(false);
    router.refresh();
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-xs text-gray-600 underline hover:text-gray-900"
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
            className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-lg bg-white p-5 shadow-xl"
          >
            <h2 className="mb-3 text-base font-semibold text-gray-900">Edit Invoice</h2>
            {error && <p className="mb-2 text-sm text-red-600">{error}</p>}

            <div className="flex flex-col gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500">Invoice No</label>
                <input
                  type="text"
                  value={invoiceNo}
                  onChange={(e) => setInvoiceNo(e.target.value)}
                  required
                  className="w-full rounded border-gray-300 px-2 py-1.5 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500">Invoice Date</label>
                <input
                  type="date"
                  value={invoiceDate}
                  onChange={(e) => setInvoiceDate(e.target.value)}
                  required
                  className="w-full rounded border-gray-300 px-2 py-1.5 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500">Description</label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  required
                  className="w-full rounded border-gray-300 px-2 py-1.5 text-sm"
                />
              </div>

              <AmountFields
                invoiceAmount={invoiceAmount}
                setInvoiceAmount={setInvoiceAmount}
                gstPct={gstPct}
                setGstPct={setGstPct}
                tdsPct={tdsPct}
                setTdsPct={setTdsPct}
                disabled={amountLocked}
              />

              <DocumentField label="Replace Document (optional)" doc={doc} setDoc={setDoc} />
            </div>

            <div className="mt-4 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={handleArchiveToggle}
                disabled={archiving}
                className="rounded border px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50"
              >
                {invoice.is_archived ? "Unarchive" : "Archive"}
              </button>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded border px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded bg-gray-900 px-3 py-1.5 text-sm text-white disabled:opacity-50"
                >
                  {saving ? "Saving..." : "Save"}
                </button>
              </div>
            </div>
          </form>
        </div>
      )}
    </>
  );
}

export function DeleteInvoiceButton({ invId }) {
  const router = useRouter();

  async function handleDelete() {
    if (!confirm("Delete this invoice? This cannot be undone.")) return;
    const res = await fetch(`/api/invoices-admin/${invId}`, { method: "DELETE" });
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
