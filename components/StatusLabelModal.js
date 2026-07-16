"use client";

import { useState } from "react";
import { useRouter, usePathname } from "next/navigation";

const ENTITY_TYPE_OPTIONS = [
  { value: "record", label: "Records" },
  { value: "estimate", label: "Estimates" },
  { value: "po", label: "Purchase Orders" },
  { value: "invoice", label: "Invoices" },
];

export function EntityTypeSelect({ entityType }) {
  const router = useRouter();
  const pathname = usePathname();

  function handleChange(e) {
    const params = new URLSearchParams(window.location.search);
    params.set("entityType", e.target.value);
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <select
      value={entityType}
      onChange={handleChange}
      className="rounded-md border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 px-2 py-1.5 text-sm"
    >
      {ENTITY_TYPE_OPTIONS.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

export function AddStatusLabelButton({ entityType }) {
  const [open, setOpen] = useState(false);
  const [labelName, setLabelName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSaving(true);
    const res = await fetch("/api/status-labels-admin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entityType, labelName }),
    });
    const data = await res.json();
    if (!res.ok) {
      setSaving(false);
      setError(data.error || "Could not save label");
      return;
    }
    setSaving(false);
    setOpen(false);
    setLabelName("");
    router.refresh();
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-full bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
      >
        + Add Label
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
            <h2 className="mb-3 text-base font-semibold text-gray-900 dark:text-gray-100">Add Status Label</h2>
            {error && <p className="mb-2 text-sm text-red-600">{error}</p>}

            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">Label Name</label>
              <input
                type="text"
                value={labelName}
                onChange={(e) => setLabelName(e.target.value)}
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

export function DeleteStatusLabelButton({ labelId }) {
  const [deleting, setDeleting] = useState(false);
  const router = useRouter();

  async function handleDelete() {
    if (!confirm("Delete this status label?")) return;
    setDeleting(true);
    const res = await fetch(`/api/status-labels-admin/${labelId}`, { method: "DELETE" });
    setDeleting(false);
    if (!res.ok) {
      const data = await res.json();
      alert(data.error || "Could not delete label");
      return;
    }
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={handleDelete}
      disabled={deleting}
      className="text-xs text-red-600 underline hover:text-red-800 disabled:opacity-50"
    >
      {deleting ? "Deleting..." : "Delete"}
    </button>
  );
}
