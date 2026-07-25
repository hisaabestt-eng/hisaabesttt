"use client";

import { useRef, useState } from "react";
import { useRefineFilter, RefineToggleButton } from "./useRefineFilter";
import { narrowInvoicesToSearch, narrowInvoicesToProgress } from "@/lib/searchNarrow";
import { progressLabel } from "@/lib/status";
import { RecordSummaryRow } from "./RecordSummaryRow";

function formatMoney(value) {
  if (value === null || value === undefined) return "—";
  return Number(value).toLocaleString("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  });
}

function formatDate(value) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

// Mirrors the status badge logic in RecordSummaryRow so exports/screenshots
// show the exact same value the table displays (aggregate "N invoices" badge
// vs. a single narrowed invoice's own progress vs. the plain record status).
function rowStatusText(row) {
  const invoices = row.invoices || [];
  if (invoices.length > 1) return `${invoices.length} invoices`;
  if (invoices.length === 1) return progressLabel(invoices[0], "Invoice");
  return row.status;
}

export function MainTable({ rows, totalCount, search, progress }) {
  const { refining, toggleRefining, visibleRows, isChecked, toggleRow } = useRefineFilter(
    rows,
    (row) => row.record_id
  );
  const tableWrapperRef = useRef(null);
  const [exporting, setExporting] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [exportError, setExportError] = useState("");

  const totalAmount = visibleRows.reduce((sum, row) => sum + (Number(row.estimate_amount) || 0), 0);

  // The narrowed rows actually rendered on screen — same computation
  // RecordSummaryRow gets below, kept here too so Excel/PNG exports match
  // exactly what's visible instead of the pre-narrowed server data.
  const narrowedRows = visibleRows.map((row) => ({
    ...row,
    invoices: narrowInvoicesToProgress(narrowInvoicesToSearch(row.invoices, search), progress),
  }));

  async function handleExportExcel() {
    setExportError("");
    if (narrowedRows.length === 0) {
      setExportError("Nothing to export for this filter.");
      return;
    }
    setExporting(true);
    try {
      const XLSX = await import("xlsx");
      const sheetRows = narrowedRows.map((row) => ({
        "Record ID": row.record_id,
        Date: formatDate(row.estimate_date),
        Description: row.estimate_description,
        Amount: Number(row.estimate_amount) || 0,
        Status: rowStatusText(row),
      }));
      const ws = XLSX.utils.json_to_sheet(sheetRows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Main Page");
      XLSX.writeFile(wb, `main-page-${Date.now()}.xlsx`);
    } catch (e) {
      setExportError(`Could not export: ${e?.message || e}`);
    }
    setExporting(false);
  }

  async function handleScreenshot() {
    setExportError("");
    if (!tableWrapperRef.current) return;
    setCapturing(true);
    try {
      const html2canvas = (await import("html2canvas-pro")).default;
      // Clone the table out of the scrollable/sticky wrapper so the capture
      // includes every row (not just what's currently scrolled into view).
      const clone = tableWrapperRef.current.cloneNode(true);
      clone.className = "rounded-lg border border-gray-100 bg-white";
      clone.style.position = "fixed";
      clone.style.top = "-99999px";
      clone.style.left = "-99999px";
      clone.style.maxHeight = "none";
      clone.style.overflow = "visible";
      clone.querySelectorAll(".sticky").forEach((el) => el.classList.remove("sticky", "top-0", "bottom-0"));
      document.body.appendChild(clone);
      const canvas = await html2canvas(clone, { backgroundColor: "#ffffff", scale: 2 });
      document.body.removeChild(clone);
      const link = document.createElement("a");
      link.download = `main-page-${Date.now()}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    } catch (e) {
      setExportError(`Could not create screenshot: ${e?.message || e}`);
    }
    setCapturing(false);
  }

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm text-gray-600 dark:text-gray-400">{totalCount} records</div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleExportExcel}
            disabled={exporting}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
          >
            {exporting ? "Exporting..." : "Download Excel"}
          </button>
          <button
            type="button"
            onClick={handleScreenshot}
            disabled={capturing}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
          >
            {capturing ? "Capturing..." : "Download Screenshot"}
          </button>
          <RefineToggleButton
            refining={refining}
            toggleRefining={toggleRefining}
            totalCount={rows.length}
            visibleCount={visibleRows.length}
          />
        </div>
      </div>
      {exportError && <p className="text-xs text-red-600">{exportError}</p>}

      <div
        ref={tableWrapperRef}
        className="max-h-[70vh] overflow-y-auto overflow-x-auto rounded-lg border border-gray-100 dark:border-gray-700"
      >
        <table className="min-w-full divide-y divide-gray-100 text-sm dark:divide-gray-700">
          <thead className="sticky top-0 bg-gray-50 dark:bg-gray-900/40">
            <tr>
              <th className="whitespace-nowrap px-3 py-3 text-left font-medium text-gray-600 dark:text-gray-400">
                Date
              </th>
              <th className="min-w-[320px] px-3 py-3 text-left font-medium text-gray-600 dark:text-gray-400">
                Description
              </th>
              <th className="px-3 py-3 text-right font-medium text-gray-600 dark:text-gray-400">Amount</th>
              <th className="w-40 px-3 py-3 text-center font-medium text-gray-600 dark:text-gray-400">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {narrowedRows.map((row) => (
              <RecordSummaryRow
                key={row.record_id}
                row={row}
                refining={refining}
                checked={isChecked(row.record_id)}
                onToggle={toggleRow}
              />
            ))}
            {visibleRows.length === 0 && (
              <tr>
                <td colSpan={4} className="px-3 py-6 text-center text-gray-500 dark:text-gray-400">
                  {rows.length === 0 ? "No records found." : "All rows refined out — untick some to bring them back."}
                </td>
              </tr>
            )}
          </tbody>
          {visibleRows.length > 0 && (
            <tfoot className="sticky bottom-0 border-t-2 border-gray-200 bg-gray-50 font-medium dark:border-gray-700 dark:bg-gray-900/40">
              <tr>
                <td colSpan={2} className="px-3 py-3 text-right text-gray-700 dark:text-gray-300">
                  Total
                </td>
                <td className="px-3 py-3 text-right text-gray-900 dark:text-gray-100">{formatMoney(totalAmount)}</td>
                <td></td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </>
  );
}
