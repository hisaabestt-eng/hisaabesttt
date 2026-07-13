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

export function AddEstimateButton({ recordsWithoutEstimate }) {
  const [open, setOpen] = useState(false);
  const [recordId, setRecordId] = useState(recordsWithoutEstimate[0]?.record_id || "");
  const [estNo, setEstNo] = useState("");
  const [estDate, setEstDate] = useState(toDateInputValue());
  const [description, setDescription] = useState(recordsWithoutEstimate[0]?.description || "");
  const [amount, setAmount] = useState(recordsWithoutEstimate[0]?.amount || "");
  const [doc, setDoc] = useState(EMPTY_DOC);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  function handleRecordChange(e) {
    const id = e.target.value;
    setRecordId(id);
    const rec = recordsWithoutEstimate.find((r) => r.record_id === id);
    if (rec) {
      setDescription(rec.description);
      setAmount(rec.amount);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSaving(true);
    const res = await fetch("/api/estimates-admin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ recordId, estNo, estDate, description, amount }),
    });
    const data = await res.json();
    if (!res.ok) {
      setSaving(false);
      setError(data.error || "Could not save estimate");
      return;
    }
    await uploadDocumentField(`/api/estimates-admin/${data.estId}/document`, doc);
    setSaving(false);
    setOpen(false);
    setEstNo("");
    setDoc(EMPTY_DOC);
    router.refresh();
  }

  if (recordsWithoutEstimate.length === 0) {
    return (
      <span className="text-xs text-gray-400">
        No records without an estimate — add one on the Records page first.
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
        + Add Estimate
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
            <h2 className="mb-3 text-base font-semibold text-gray-900">Add Estimate</h2>
            {error && <p className="mb-2 text-sm text-red-600">{error}</p>}

            <div className="flex flex-col gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500">
                  Record (no estimate yet)
                </label>
                <select
                  value={recordId}
                  onChange={handleRecordChange}
                  required
                  className="w-full rounded border-gray-300 px-2 py-1.5 text-sm"
                >
                  {recordsWithoutEstimate.map((r) => (
                    <option key={r.record_id} value={r.record_id}>
                      {r.client_name} — {r.description} ({new Date(r.record_date).toLocaleDateString("en-IN")})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500">Estimate No</label>
                <input
                  type="text"
                  value={estNo}
                  onChange={(e) => setEstNo(e.target.value)}
                  required
                  className="w-full rounded border-gray-300 px-2 py-1.5 text-sm"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500">Estimate Date</label>
                <input
                  type="date"
                  value={estDate}
                  onChange={(e) => setEstDate(e.target.value)}
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

              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500">Amount</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  required
                  className="w-full rounded border-gray-300 px-2 py-1.5 text-sm"
                />
              </div>

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

export function EditEstimateButton({ estimate }) {
  const [open, setOpen] = useState(false);
  const [estNo, setEstNo] = useState(estimate.est_no);
  const [estDate, setEstDate] = useState(toDateInputValue(estimate.estimate_date));
  const [description, setDescription] = useState(estimate.description);
  const [amount, setAmount] = useState(estimate.amount);
  const [doc, setDoc] = useState(EMPTY_DOC);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  const amountLocked = Boolean(estimate.po_id);
  const [archiving, setArchiving] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSaving(true);
    const res = await fetch(`/api/estimates-admin/${estimate.est_id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ estNo, estDate, description, amount }),
    });
    const data = await res.json();
    if (!res.ok) {
      setSaving(false);
      setError(data.error || "Could not save changes");
      return;
    }
    await uploadDocumentField(`/api/estimates-admin/${estimate.est_id}/document`, doc);
    setSaving(false);
    setOpen(false);
    router.refresh();
  }

  async function handleArchiveToggle() {
    setArchiving(true);
    setError("");
    const res = await fetch(`/api/estimates-admin/${estimate.est_id}/archive`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ archived: !estimate.is_archived }),
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
            <h2 className="mb-3 text-base font-semibold text-gray-900">Edit Estimate</h2>
            {error && <p className="mb-2 text-sm text-red-600">{error}</p>}

            <div className="flex flex-col gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500">Estimate No</label>
                <input
                  type="text"
                  value={estNo}
                  onChange={(e) => setEstNo(e.target.value)}
                  required
                  className="w-full rounded border-gray-300 px-2 py-1.5 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500">Estimate Date</label>
                <input
                  type="date"
                  value={estDate}
                  onChange={(e) => setEstDate(e.target.value)}
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
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500">Amount</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  required
                  disabled={amountLocked}
                  className="w-full rounded border-gray-300 px-2 py-1.5 text-sm disabled:bg-gray-100 disabled:text-gray-500"
                />
                {amountLocked && (
                  <p className="mt-1 text-xs text-gray-400">
                    A Purchase Order already exists — edit the amount on the PO instead.
                  </p>
                )}
              </div>
              <DocumentField label="Replace Document (optional)" doc={doc} setDoc={setDoc} />
            </div>

            <div className="mt-4 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={handleArchiveToggle}
                disabled={archiving}
                className="rounded border px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50"
              >
                {estimate.is_archived ? "Unarchive" : "Archive"}
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

export function DeleteEstimateButton({ estId }) {
  const router = useRouter();

  async function handleDelete() {
    if (!confirm("Delete this estimate? This cannot be undone.")) return;
    const res = await fetch(`/api/estimates-admin/${estId}`, { method: "DELETE" });
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
