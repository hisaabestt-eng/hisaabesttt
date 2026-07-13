"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Build the yyyy-mm-dd string from local date parts, not toISOString(),
// which converts to UTC and can shift the date by a day in IST.
function toDateInputValue(value) {
  const d = value ? new Date(value) : new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function AddRecordButton({ compId, clients }) {
  const [open, setOpen] = useState(false);
  const [clientList, setClientList] = useState(clients);
  const [clientId, setClientId] = useState(clients[0]?.client_id || "");
  const [newClientName, setNewClientName] = useState("");
  const [addingClient, setAddingClient] = useState(clients.length === 0);
  const [recordDate, setRecordDate] = useState(toDateInputValue());
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  async function handleAddClient() {
    if (!newClientName.trim()) return;
    setSaving(true);
    const res = await fetch("/api/clients", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientName: newClientName, compId }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) {
      setError(data.error || "Could not add client");
      return;
    }
    setClientList((list) => [...list, { client_id: data.clientId, client_name: data.clientName }]);
    setClientId(data.clientId);
    setNewClientName("");
    setAddingClient(false);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSaving(true);
    const res = await fetch("/api/records-admin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ compId, clientId, recordDate, description, amount }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) {
      setError(data.error || "Could not save record");
      return;
    }
    setOpen(false);
    setDescription("");
    setAmount("");
    router.refresh();
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded bg-gray-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-gray-700"
      >
        + Add Record
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setOpen(false)}
        >
          <form
            onSubmit={handleSubmit}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-lg bg-white p-5 shadow-xl"
          >
            <h2 className="mb-3 text-base font-semibold text-gray-900">Add Record</h2>

            {error && <p className="mb-2 text-sm text-red-600">{error}</p>}

            <div className="flex flex-col gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500">Client</label>
                {!addingClient ? (
                  <div className="flex gap-2">
                    <select
                      value={clientId}
                      onChange={(e) => setClientId(e.target.value)}
                      required
                      className="flex-1 rounded border-gray-300 px-2 py-1.5 text-sm"
                    >
                      {clientList.map((c) => (
                        <option key={c.client_id} value={c.client_id}>
                          {c.client_name}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => setAddingClient(true)}
                      className="rounded border px-2 py-1.5 text-xs text-gray-600 hover:bg-gray-50"
                    >
                      + New
                    </button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newClientName}
                      onChange={(e) => setNewClientName(e.target.value)}
                      placeholder="New client name"
                      className="flex-1 rounded border-gray-300 px-2 py-1.5 text-sm"
                    />
                    <button
                      type="button"
                      onClick={handleAddClient}
                      disabled={saving}
                      className="rounded bg-gray-900 px-2 py-1.5 text-xs text-white disabled:opacity-50"
                    >
                      Save
                    </button>
                    {clientList.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setAddingClient(false)}
                        className="rounded border px-2 py-1.5 text-xs text-gray-600 hover:bg-gray-50"
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                )}
                {clientList.length === 0 && (
                  <p className="mt-1 text-xs text-gray-400">
                    No clients under this company yet — add one to get started.
                  </p>
                )}
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500">Record Date</label>
                <input
                  type="date"
                  value={recordDate}
                  onChange={(e) => setRecordDate(e.target.value)}
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

export function EditRecordButton({ record }) {
  const [open, setOpen] = useState(false);
  const [recordDate, setRecordDate] = useState(toDateInputValue(record.record_date));
  const [description, setDescription] = useState(record.description);
  const [amount, setAmount] = useState(record.amount);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  const amountLocked = Boolean(record.po_id);
  const [archiving, setArchiving] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSaving(true);
    const res = await fetch(`/api/records-admin/${record.record_id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ recordDate, description, amount }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) {
      setError(data.error || "Could not save changes");
      return;
    }
    setOpen(false);
    router.refresh();
  }

  async function handleArchiveToggle() {
    setArchiving(true);
    setError("");
    const res = await fetch(`/api/records-admin/${record.record_id}/archive`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ archived: !record.is_archived }),
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
            className="w-full max-w-md rounded-lg bg-white p-5 shadow-xl"
          >
            <h2 className="mb-3 text-base font-semibold text-gray-900">Edit Record</h2>
            {error && <p className="mb-2 text-sm text-red-600">{error}</p>}

            <div className="flex flex-col gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500">Record Date</label>
                <input
                  type="date"
                  value={recordDate}
                  onChange={(e) => setRecordDate(e.target.value)}
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
                    A Purchase Order already exists — edit the amount on the Estimate instead.
                  </p>
                )}
              </div>
            </div>

            <div className="mt-4 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={handleArchiveToggle}
                disabled={archiving}
                className="rounded border px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50"
              >
                {record.is_archived ? "Unarchive" : "Archive"}
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

export function DeleteRecordButton({ recordId }) {
  const [error, setError] = useState("");
  const router = useRouter();

  async function handleDelete() {
    if (!confirm("Delete this record? This cannot be undone.")) return;
    const res = await fetch(`/api/records-admin/${recordId}`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Could not delete");
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
