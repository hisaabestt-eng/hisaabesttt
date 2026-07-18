"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { DocumentField, EMPTY_DOC, uploadDocumentField } from "./DocumentField";
import { ConfirmDialog } from "./ConfirmDialog";

function toDateInputValue(value) {
  const d = value ? new Date(value) : new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function AddEstimateButton({ recordsWithoutEstimate, compId }) {
  const [open, setOpen] = useState(false);
  const [recordId, setRecordId] = useState(recordsWithoutEstimate[0]?.record_id || "");
  const [estNo, setEstNo] = useState("");
  const [estDate, setEstDate] = useState(toDateInputValue());
  const [description, setDescription] = useState(recordsWithoutEstimate[0]?.description || "");
  const [amount, setAmount] = useState(recordsWithoutEstimate[0]?.amount || "");
  const [doc, setDoc] = useState(EMPTY_DOC);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [confirmDuplicate, setConfirmDuplicate] = useState(false);
  const [duplicateAcknowledged, setDuplicateAcknowledged] = useState(false);
  const router = useRouter();

  function handleEstNoChange(e) {
    setEstNo(e.target.value);
    setDuplicateAcknowledged(false);
  }

  function handleRecordChange(e) {
    const id = e.target.value;
    setRecordId(id);
    const rec = recordsWithoutEstimate.find((r) => r.record_id === id);
    if (rec) {
      setDescription(rec.description);
      setAmount(rec.amount);
    }
  }

  // recordsWithoutEstimate shrinks after each estimate is created, but this
  // component doesn't remount between opens — re-sync to the current first
  // record so the fields don't show stale data for a record no longer in the list.
  function handleOpen() {
    if (recordsWithoutEstimate.length === 0) {
      alert("No records without an estimate — add one on the Records page first.");
      return;
    }
    setRecordId(recordsWithoutEstimate[0]?.record_id || "");
    setDescription(recordsWithoutEstimate[0]?.description || "");
    setAmount(recordsWithoutEstimate[0]?.amount || "");
    setOpen(true);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    if (!duplicateAcknowledged) {
      setSaving(true);
      const checkRes = await fetch(
        `/api/estimates-admin/check-number?estNo=${encodeURIComponent(estNo)}&compId=${encodeURIComponent(compId)}`
      );
      const checkData = await checkRes.json();
      setSaving(false);
      if (checkData.exists) {
        setConfirmDuplicate(true);
        return;
      }
    }

    await saveEstimate();
  }

  async function saveEstimate() {
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
    setDuplicateAcknowledged(false);
    setDoc(EMPTY_DOC);
    router.refresh();
  }

  function handleConfirmDuplicate() {
    setConfirmDuplicate(false);
    setDuplicateAcknowledged(true);
    saveEstimate();
  }

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        className="rounded-full bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
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
            className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-lg bg-white dark:bg-gray-800 p-5 shadow-xl"
          >
            <h2 className="mb-3 text-base font-semibold text-gray-900 dark:text-gray-100">Add Estimate</h2>
            {error && <p className="mb-2 text-sm text-red-600">{error}</p>}

            <div className="flex flex-col gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">
                  Record (no estimate yet)
                </label>
                <select
                  value={recordId}
                  onChange={handleRecordChange}
                  required
                  className="w-full rounded-md border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 px-2 py-1.5 text-sm"
                >
                  {recordsWithoutEstimate.map((r) => (
                    <option key={r.record_id} value={r.record_id}>
                      {r.client_name} — {r.description} ({new Date(r.record_date).toLocaleDateString("en-IN")})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">Estimate No</label>
                <input
                  type="text"
                  value={estNo}
                  onChange={handleEstNoChange}
                  required
                  className="w-full rounded-md border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 px-2 py-1.5 text-sm"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">Estimate Date</label>
                <input
                  type="date"
                  value={estDate}
                  onChange={(e) => setEstDate(e.target.value)}
                  required
                  className="w-full rounded-md border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 px-2 py-1.5 text-sm"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">Description</label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  required
                  className="w-full rounded-md border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 px-2 py-1.5 text-sm"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">Amount</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  required
                  className="w-full rounded-md border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 px-2 py-1.5 text-sm"
                />
              </div>

              <DocumentField label="Document (optional)" doc={doc} setDoc={setDoc} />
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

      <ConfirmDialog
        open={confirmDuplicate}
        message={`Estimate No "${estNo}" has already been used before. Are you sure you want to continue?`}
        onConfirm={handleConfirmDuplicate}
        onCancel={() => setConfirmDuplicate(false)}
      />
    </>
  );
}

export function EditEstimateButton({ estimate, statusLabels = [] }) {
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
  const [statusChoice, setStatusChoice] = useState(
    estimate.custom_status || (estimate.is_archived ? "Archived" : "Raised")
  );

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSaving(true);

    const isCustomChoice = !["Raised", "Archived"].includes(statusChoice);
    const targetArchived = statusChoice === "Archived";
    if (targetArchived !== estimate.is_archived) {
      const res = await fetch(`/api/estimates-admin/${estimate.est_id}/archive`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ archived: targetArchived }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSaving(false);
        setError(data.error || "Could not update status");
        return;
      }
    }

    const res = await fetch(`/api/estimates-admin/${estimate.est_id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        estNo,
        estDate,
        description,
        amount,
        customStatus: isCustomChoice ? statusChoice : null,
      }),
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
            <h2 className="mb-3 text-base font-semibold text-gray-900 dark:text-gray-100">Edit Estimate</h2>
            {error && <p className="mb-2 text-sm text-red-600">{error}</p>}

            <div className="flex flex-col gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">Estimate No</label>
                <input
                  type="text"
                  value={estNo}
                  onChange={(e) => setEstNo(e.target.value)}
                  required
                  className="w-full rounded-md border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 px-2 py-1.5 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">Estimate Date</label>
                <input
                  type="date"
                  value={estDate}
                  onChange={(e) => setEstDate(e.target.value)}
                  required
                  className="w-full rounded-md border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 px-2 py-1.5 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">Description</label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  required
                  className="w-full rounded-md border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 px-2 py-1.5 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">Amount</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  required
                  disabled={amountLocked}
                  className="w-full rounded-md border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 px-2 py-1.5 text-sm disabled:bg-gray-100 disabled:text-gray-500 dark:disabled:bg-gray-800 dark:disabled:text-gray-400"
                />
                {amountLocked && (
                  <p className="mt-1 text-xs text-gray-400">
                    A Purchase Order already exists — edit the amount on the PO instead.
                  </p>
                )}
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">Status</label>
                <select
                  value={statusChoice}
                  onChange={(e) => setStatusChoice(e.target.value)}
                  className="w-full rounded-md border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 px-2 py-1.5 text-sm"
                >
                  <option value="Raised">Raised</option>
                  {statusLabels.map((l) => (
                    <option key={l.label_id} value={l.label_name}>
                      {l.label_name}
                    </option>
                  ))}
                  <option value="Archived">Archived</option>
                </select>
              </div>
              <DocumentField label="Replace Document (optional)" doc={doc} setDoc={setDoc} />
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
