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

export function AddPOButton({ estimatesWithoutPO, compId }) {
  const [open, setOpen] = useState(false);
  const [estId, setEstId] = useState(estimatesWithoutPO[0]?.est_id || "");
  const [poNo, setPoNo] = useState("");
  const [poDate, setPoDate] = useState(toDateInputValue());
  const [description, setDescription] = useState(estimatesWithoutPO[0]?.description || "");
  const [amount, setAmount] = useState(estimatesWithoutPO[0]?.amount || "");
  const [doc, setDoc] = useState(EMPTY_DOC);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [confirmDuplicate, setConfirmDuplicate] = useState(false);
  const [duplicateAcknowledged, setDuplicateAcknowledged] = useState(false);
  const router = useRouter();

  function handlePoNoChange(e) {
    setPoNo(e.target.value);
    setDuplicateAcknowledged(false);
  }

  function handleEstimateChange(e) {
    const id = e.target.value;
    setEstId(id);
    const est = estimatesWithoutPO.find((r) => r.est_id === id);
    if (est) {
      setDescription(est.description);
      setAmount(est.amount);
    }
  }

  // estimatesWithoutPO shrinks after each PO is created, but this component
  // doesn't remount between opens — re-sync to the current first estimate so
  // the fields don't show stale data for an estimate no longer in the list.
  function handleOpen() {
    if (estimatesWithoutPO.length === 0) {
      alert("No estimates without a PO — add one on the Estimates page first.");
      return;
    }
    setEstId(estimatesWithoutPO[0]?.est_id || "");
    setDescription(estimatesWithoutPO[0]?.description || "");
    setAmount(estimatesWithoutPO[0]?.amount || "");
    setOpen(true);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    if (!duplicateAcknowledged) {
      setSaving(true);
      const checkRes = await fetch(
        `/api/po-admin/check-number?poNo=${encodeURIComponent(poNo)}&compId=${encodeURIComponent(compId)}`
      );
      const checkData = await checkRes.json();
      setSaving(false);
      if (checkData.exists) {
        setConfirmDuplicate(true);
        return;
      }
    }

    await savePO();
  }

  async function savePO() {
    setSaving(true);
    const res = await fetch("/api/po-admin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ estId, poNo, poDate, description, amount }),
    });
    const data = await res.json();
    if (!res.ok) {
      setSaving(false);
      setError(data.error || "Could not save purchase order");
      return;
    }
    await uploadDocumentField(`/api/po-admin/${data.poId}/document`, doc);
    setSaving(false);
    setOpen(false);
    setPoNo("");
    setDuplicateAcknowledged(false);
    setDoc(EMPTY_DOC);
    router.refresh();
  }

  function handleConfirmDuplicate() {
    setConfirmDuplicate(false);
    setDuplicateAcknowledged(true);
    savePO();
  }

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        className="rounded-full bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
      >
        + Add PO
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
            <h2 className="mb-3 text-base font-semibold text-gray-900 dark:text-gray-100">Add Purchase Order</h2>
            {error && <p className="mb-2 text-sm text-red-600">{error}</p>}

            <div className="flex flex-col gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">
                  Estimate (no PO yet)
                </label>
                <select
                  value={estId}
                  onChange={handleEstimateChange}
                  required
                  className="w-full rounded-md border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 px-2 py-1.5 text-sm"
                >
                  {estimatesWithoutPO.map((est) => (
                    <option key={est.est_id} value={est.est_id}>
                      {est.client_name} — {est.description} (
                      {new Date(est.estimate_date).toLocaleDateString("en-IN")})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">PO No</label>
                <input
                  type="text"
                  value={poNo}
                  onChange={handlePoNoChange}
                  required
                  className="w-full rounded-md border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 px-2 py-1.5 text-sm"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">PO Date</label>
                <input
                  type="date"
                  value={poDate}
                  onChange={(e) => setPoDate(e.target.value)}
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
        message={`PO No "${poNo}" has already been used before. Are you sure you want to continue?`}
        onConfirm={handleConfirmDuplicate}
        onCancel={() => setConfirmDuplicate(false)}
      />
    </>
  );
}

export function EditPOButton({ po, statusLabels = [] }) {
  const [open, setOpen] = useState(false);
  const [poNo, setPoNo] = useState(po.po_no);
  const [poDate, setPoDate] = useState(toDateInputValue(po.po_date));
  const [description, setDescription] = useState(po.description);
  const [amount, setAmount] = useState(po.amount);
  const [doc, setDoc] = useState(EMPTY_DOC);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  const amountLocked = Boolean(po.inv_id);
  const [statusChoice, setStatusChoice] = useState(
    po.custom_status || (po.is_archived ? "Archived" : "Raised")
  );

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSaving(true);

    const isCustomChoice = !["Raised", "Archived"].includes(statusChoice);
    const targetArchived = statusChoice === "Archived";
    if (targetArchived !== po.is_archived) {
      const res = await fetch(`/api/po-admin/${po.po_id}/archive`, {
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

    const res = await fetch(`/api/po-admin/${po.po_id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        poNo,
        poDate,
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
    await uploadDocumentField(`/api/po-admin/${po.po_id}/document`, doc);
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
            <h2 className="mb-3 text-base font-semibold text-gray-900 dark:text-gray-100">Edit Purchase Order</h2>
            {error && <p className="mb-2 text-sm text-red-600">{error}</p>}

            <div className="flex flex-col gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">PO No</label>
                <input
                  type="text"
                  value={poNo}
                  onChange={(e) => setPoNo(e.target.value)}
                  required
                  className="w-full rounded-md border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 px-2 py-1.5 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">PO Date</label>
                <input
                  type="date"
                  value={poDate}
                  onChange={(e) => setPoDate(e.target.value)}
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
                    An Invoice already exists — edit the amount on the Invoice instead.
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

export function DeletePOButton({ poId }) {
  const router = useRouter();

  async function handleDelete() {
    if (!confirm("Delete this Purchase Order? This cannot be undone.")) return;
    const res = await fetch(`/api/po-admin/${poId}`, { method: "DELETE" });
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
