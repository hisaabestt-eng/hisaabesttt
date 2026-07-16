"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Admin decides here what the "user" role is allowed to do — admin itself
// always has full access regardless of these toggles (enforced in proxy.js).
export function PermissionsForm({ permissions }) {
  const [canAdd, setCanAdd] = useState(permissions.can_add);
  const [canEdit, setCanEdit] = useState(permissions.can_edit);
  const [canDelete, setCanDelete] = useState(permissions.can_delete);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const router = useRouter();

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    await fetch("/api/permissions-admin", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ canAdd, canEdit, canDelete }),
    });
    setSaving(false);
    setSaved(true);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-gray-100 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
      <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
        <input type="checkbox" checked={canAdd} onChange={(e) => setCanAdd(e.target.checked)} />
        User can Add — create new records, estimates, POs, invoices, payments
      </label>
      <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
        <input type="checkbox" checked={canEdit} onChange={(e) => setCanEdit(e.target.checked)} />
        User can Edit existing entries
      </label>
      <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
        <input type="checkbox" checked={canDelete} onChange={(e) => setCanDelete(e.target.checked)} />
        User can Delete entries
      </label>
      <div className="flex items-center gap-2 pt-1">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="self-start rounded-full bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save"}
        </button>
        {saved && <span className="text-xs text-green-600 dark:text-green-400">Saved</span>}
      </div>
    </div>
  );
}
