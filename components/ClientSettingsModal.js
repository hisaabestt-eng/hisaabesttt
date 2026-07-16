"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function AddClientButton({ compId }) {
  const [open, setOpen] = useState(false);
  const [clientName, setClientName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSaving(true);
    const res = await fetch("/api/clients", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientName, compId }),
    });
    const data = await res.json();
    if (!res.ok) {
      setSaving(false);
      setError(data.error || "Could not save client");
      return;
    }
    setSaving(false);
    setOpen(false);
    setClientName("");
    router.refresh();
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-full bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
      >
        + Add Client
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setOpen(false)}
        >
          <form
            onSubmit={handleSubmit}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-lg bg-white dark:bg-gray-800 p-5 shadow-xl"
          >
            <h2 className="mb-3 text-base font-semibold text-gray-900 dark:text-gray-100">Add Client</h2>
            {error && <p className="mb-2 text-sm text-red-600">{error}</p>}

            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">Client Name</label>
              <input
                type="text"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                required
                className="w-full rounded-md border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 px-2 py-1.5 text-sm"
              />
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

export function EditClientButton({ clientId, clientName }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(clientName);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSaving(true);
    const res = await fetch(`/api/clients-admin/${clientId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientName: name }),
    });
    const data = await res.json();
    if (!res.ok) {
      setSaving(false);
      setError(data.error || "Could not save client");
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
        className="text-xs text-gray-600 underline hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
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
            className="w-full max-w-md rounded-lg bg-white dark:bg-gray-800 p-5 shadow-xl"
          >
            <h2 className="mb-3 text-base font-semibold text-gray-900 dark:text-gray-100">Edit Client</h2>
            {error && <p className="mb-2 text-sm text-red-600">{error}</p>}

            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">Client Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full rounded-md border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 px-2 py-1.5 text-sm"
              />
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

export function ClientStatusButton({ clientId, status }) {
  const [saving, setSaving] = useState(false);
  const router = useRouter();
  const isActive = status === "Active";

  async function handleToggle() {
    setSaving(true);
    const res = await fetch(`/api/clients-admin/${clientId}/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: isActive ? "Inactive" : "Active" }),
    });
    setSaving(false);
    if (!res.ok) {
      const data = await res.json();
      alert(data.error || "Could not update status");
      return;
    }
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={handleToggle}
      disabled={saving}
      className="text-xs text-gray-600 underline hover:text-gray-900 disabled:opacity-50"
    >
      {isActive ? "Deactivate" : "Activate"}
    </button>
  );
}
