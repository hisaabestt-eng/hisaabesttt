"use client";

import { useState } from "react";
import { useRouter, usePathname } from "next/navigation";

// Build the yyyy-mm-dd string from local date parts, not toISOString(),
// which converts to UTC and can shift the date by a day in IST.
function toDateInputValue(value) {
  const d = value ? new Date(value) : new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// Excel date cells parse into JS Date objects (cellDates: true) — left as-is,
// JSON.stringify would convert them to a UTC ISO string, which shifts to the
// previous day in IST and fails the server's date validation. Convert to a
// plain YYYY-MM-DD using local date parts before it ever reaches JSON.
function toDateOnlyString(value) {
  if (!(value instanceof Date)) return value;
  return toDateInputValue(value);
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
  const pathname = usePathname();

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
    // The page's Client filter shows exactly one client at a time — if it
    // isn't already the one this record was just added for, a plain
    // router.refresh() would leave the new record invisible until the user
    // manually switches the filter. Navigate there directly instead.
    const params = new URLSearchParams(window.location.search);
    params.set("company", compId);
    params.set("client", clientId);
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-full bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
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
            className="w-full max-w-md rounded-lg bg-white dark:bg-gray-800 p-5 shadow-xl"
          >
            <h2 className="mb-3 text-base font-semibold text-gray-900 dark:text-gray-100">Add Record</h2>

            {error && <p className="mb-2 text-sm text-red-600">{error}</p>}

            <div className="flex flex-col gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">Client</label>
                {!addingClient ? (
                  <div className="flex gap-2">
                    <select
                      value={clientId}
                      onChange={(e) => setClientId(e.target.value)}
                      required
                      className="flex-1 rounded-md border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 px-2 py-1.5 text-sm"
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
                      className="rounded-md border px-2 py-1.5 text-xs text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-400 dark:hover:bg-gray-700"
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
                      className="flex-1 rounded-md border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 px-2 py-1.5 text-sm"
                    />
                    <button
                      type="button"
                      onClick={handleAddClient}
                      disabled={saving}
                      className="rounded-full bg-blue-600 px-2 py-1.5 text-xs text-white hover:bg-blue-700 disabled:opacity-50"
                    >
                      Save
                    </button>
                    {clientList.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setAddingClient(false)}
                        className="rounded-md border px-2 py-1.5 text-xs text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-400 dark:hover:bg-gray-700"
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
                <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">Record Date</label>
                <input
                  type="date"
                  value={recordDate}
                  onChange={(e) => setRecordDate(e.target.value)}
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

function toExcelDateCell(value) {
  if (value instanceof Date) return value;
  return value;
}

// Excel/CSV upload for adding many records at once. Every row is validated
// server-side before anything is written — if any row has a mistake, the
// whole file is rejected and every problem (row + field + reason) comes
// back at once so it can all be fixed in one pass instead of trial-and-error.
export function BulkUploadRecordsButton({ compId }) {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [errors, setErrors] = useState([]);
  const [parseError, setParseError] = useState("");
  const [success, setSuccess] = useState(null);
  const router = useRouter();

  async function handleDownloadTemplate() {
    const XLSX = await import("xlsx");
    const ws = XLSX.utils.aoa_to_sheet([
      ["Client Name", "Record Date", "Description", "Amount"],
      ["Example Client", toExcelDateCell(new Date()), "Sample work description", 50000],
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Records");
    XLSX.writeFile(wb, "records-bulk-upload-template.xlsx");
  }

  function handleOpen() {
    setFile(null);
    setErrors([]);
    setParseError("");
    setSuccess(null);
    setOpen(true);
  }

  async function handleUpload() {
    if (!file) return;
    setUploading(true);
    setErrors([]);
    setParseError("");
    setSuccess(null);

    let rows;
    try {
      const XLSX = await import("xlsx");
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array", cellDates: true });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json(sheet, { defval: "" });
      rows = json.map((r) => ({
        clientName: r["Client Name"],
        recordDate: toDateOnlyString(r["Record Date"]),
        description: r["Description"],
        amount: r["Amount"],
      }));
    } catch {
      setParseError("Could not read this file — make sure it's the .xlsx template with the same column headers.");
      setUploading(false);
      return;
    }

    const res = await fetch("/api/records-admin/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ compId, rows }),
    });
    const data = await res.json();
    setUploading(false);
    if (!res.ok) {
      setErrors(data.errors || [{ row: "-", field: "-", message: data.error || "Upload failed" }]);
      return;
    }
    setSuccess(data.created);
    setFile(null);
    router.refresh();
  }

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
      >
        Bulk Upload (Records Only)
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg bg-white dark:bg-gray-800 p-5 shadow-xl"
          >
            <h2 className="mb-3 text-base font-semibold text-gray-900 dark:text-gray-100">Bulk Upload Records</h2>
            <p className="mb-3 text-xs text-gray-500 dark:text-gray-400">
              Columns: Client Name, Record Date, Description, Amount. If any row has a mistake,
              nothing is saved — fix it and upload again.
            </p>

            <button
              type="button"
              onClick={handleDownloadTemplate}
              className="mb-3 text-xs text-blue-600 underline"
            >
              Download template
            </button>

            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={(e) => setFile(e.target.files[0] || null)}
              className="mb-3 block text-sm"
            />

            {parseError && <p className="mb-2 text-sm text-red-600">{parseError}</p>}

            {success !== null && (
              <p className="mb-3 text-sm text-green-700">{success} record(s) uploaded successfully.</p>
            )}

            {errors.length > 0 && (
              <div className="mb-3 max-h-60 overflow-y-auto rounded-md border border-red-200 bg-red-50 p-2 text-xs">
                <p className="mb-1 font-medium text-red-700">
                  {errors.length} problem(s) found — nothing was saved:
                </p>
                <ul className="list-disc space-y-0.5 pl-4 text-red-700">
                  {errors.map((e, i) => (
                    <li key={i}>
                      Row {e.row}, {e.field}: {e.message}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-md border px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-400 dark:hover:bg-gray-700"
              >
                Close
              </button>
              <button
                type="button"
                onClick={handleUpload}
                disabled={!file || uploading}
                className="rounded-full bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {uploading ? "Uploading..." : "Upload"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export function EditRecordButton({ record, statusLabels = [] }) {
  const [open, setOpen] = useState(false);
  const [recordDate, setRecordDate] = useState(toDateInputValue(record.record_date));
  const [description, setDescription] = useState(record.description);
  const [amount, setAmount] = useState(record.amount);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  const amountLocked = Boolean(record.po_id);
  const [statusChoice, setStatusChoice] = useState(
    record.custom_status || (record.is_archived ? "Archived" : "Raised")
  );

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSaving(true);

    const isCustomChoice = !["Raised", "Archived"].includes(statusChoice);
    const targetArchived = statusChoice === "Archived";
    if (targetArchived !== record.is_archived) {
      const res = await fetch(`/api/records-admin/${record.record_id}/archive`, {
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

    const res = await fetch(`/api/records-admin/${record.record_id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        recordDate,
        description,
        amount,
        customStatus: isCustomChoice ? statusChoice : null,
      }),
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
            className="w-full max-w-md rounded-lg bg-white dark:bg-gray-800 p-5 shadow-xl"
          >
            <h2 className="mb-3 text-base font-semibold text-gray-900 dark:text-gray-100">Edit Record</h2>
            {error && <p className="mb-2 text-sm text-red-600">{error}</p>}

            <div className="flex flex-col gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">Record Date</label>
                <input
                  type="date"
                  value={recordDate}
                  onChange={(e) => setRecordDate(e.target.value)}
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
                    A Purchase Order already exists — edit the amount on the Estimate instead.
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
