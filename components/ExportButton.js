"use client";

import { useState } from "react";

// Generic Excel export button — fetches JSON rows for one entity, scoped to
// whatever Company/Client is selected in the Settings Export section, and
// converts them to a downloadable .xlsx client-side (the reverse of
// BulkUploadButton's upload flow).
export function ExportButton({ entity, label, compId, clientId, fileName }) {
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");

  async function handleExport() {
    setExporting(true);
    setError("");
    try {
      const params = new URLSearchParams({ entity, compId, clientId: clientId || "" });
      const res = await fetch(`/api/export?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Could not export");
        setExporting(false);
        return;
      }
      if (data.rows.length === 0) {
        setError("Nothing to export for this selection.");
        setExporting(false);
        return;
      }
      const XLSX = await import("xlsx");
      const ws = XLSX.utils.json_to_sheet(data.rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Export");
      XLSX.writeFile(wb, fileName);
    } catch {
      setError("Could not export.");
    }
    setExporting(false);
  }

  return (
    <div>
      <button
        type="button"
        onClick={handleExport}
        disabled={exporting}
        className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
      >
        {exporting ? "Exporting..." : label}
      </button>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
