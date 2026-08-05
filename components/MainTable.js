"use client";

import { useRef, useState } from "react";
import { useRefineFilter, RefineToggleButton } from "./useRefineFilter";
import { ProgressFilter, ClearFiltersButton } from "./MainFilterBar";
import { narrowInvoicesToSearch, narrowInvoicesToProgress } from "@/lib/searchNarrow";
import { progressLabel, mainRowAmount } from "@/lib/status";
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

export function MainTable({ rows, totalCount, search, progress, progressOptions }) {
  const {
    refining,
    toggleRefining,
    displayRows,
    visibleRows,
    isChecked,
    toggleRow,
    selectAll,
    deselectAll,
  } = useRefineFilter(rows, (row) => row.record_id);
  const tableWrapperRef = useRef(null);
  const [exporting, setExporting] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [exportError, setExportError] = useState("");

  function narrowRow(row) {
    return {
      ...row,
      invoices: narrowInvoicesToProgress(narrowInvoicesToSearch(row.invoices, search), progress),
      allInvoices: row.invoices || [],
    };
  }

  // Every row renders regardless of checked state (see useRefineFilter) —
  // this is what the table body actually maps over.
  const displayNarrowedRows = displayRows.map(narrowRow);
  // Only the checked/included subset — what totals, Excel export, and the
  // screenshot capture should reflect.
  const checkedNarrowedRows = visibleRows.map(narrowRow);

  const totalAmount = checkedNarrowedRows.reduce((sum, row) => sum + mainRowAmount(row), 0);

  async function handleExportExcel() {
    setExportError("");
    if (checkedNarrowedRows.length === 0) {
      setExportError("Nothing to export for this filter.");
      return;
    }
    setExporting(true);
    try {
      const XLSX = await import("xlsx");
      const sheetRows = checkedNarrowedRows.map((row) => ({
        "Record ID": row.record_id,
        Date: formatDate(row.estimate_date),
        Description: row.estimate_description,
        "PO No": row.po_no || "",
        "PO Date": row.po_no ? formatDate(row.po_date) : "",
        "Invoice No": (row.invoices || []).map((inv) => inv.invoice_no).join(", "),
        "Invoice Date": (row.invoices || []).map((inv) => formatDate(inv.invoice_date)).join(", "),
        Amount: mainRowAmount(row),
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

  // Keeps each downloaded image a reasonable, easy-to-view height instead of
  // one giant strip — greedily packs whole rows into a chunk until adding
  // another would cross this budget (px, unscaled).
  const MAX_CHUNK_HEIGHT = 1400;

  function stripUnderline(root) {
    root.querySelectorAll(".underline").forEach((el) => {
      el.classList.remove("underline", "decoration-dotted");
      el.style.textDecoration = "none";
    });
  }

  async function captureChunk(html2canvas, { thead, rows, tfoot, tableClassName, label }) {
    const wrapDiv = document.createElement("div");
    wrapDiv.className = "rounded-lg border border-gray-100 bg-white p-2";
    wrapDiv.style.position = "fixed";
    wrapDiv.style.top = "-99999px";
    wrapDiv.style.left = "-99999px";

    if (label) {
      const caption = document.createElement("div");
      caption.className = "px-1 pb-2 text-xs font-medium text-gray-500";
      caption.textContent = label;
      wrapDiv.appendChild(caption);
    }

    const cloneTable = document.createElement("table");
    cloneTable.className = tableClassName;
    const cloneThead = thead.cloneNode(true);
    cloneThead.classList.remove("sticky", "top-0", "bottom-0");
    cloneTable.appendChild(cloneThead);
    const cloneTbody = document.createElement("tbody");
    cloneTbody.className = "divide-y divide-gray-100";
    rows.forEach((r) => cloneTbody.appendChild(r.cloneNode(true)));
    cloneTable.appendChild(cloneTbody);
    if (tfoot) {
      const cloneTfoot = tfoot.cloneNode(true);
      cloneTfoot.classList.remove("sticky", "top-0", "bottom-0");
      cloneTable.appendChild(cloneTfoot);
    }
    wrapDiv.appendChild(cloneTable);

    // html2canvas-pro mis-renders a dotted underline as a strike-through the
    // middle of the text — that underline is only a "this is clickable"
    // hint anyway, meaningless in a static image, so drop it.
    stripUnderline(wrapDiv);

    document.body.appendChild(wrapDiv);
    const canvas = await html2canvas(wrapDiv, { backgroundColor: "#ffffff", scale: 2 });
    document.body.removeChild(wrapDiv);
    return canvas;
  }

  async function handleScreenshot() {
    setExportError("");
    if (!tableWrapperRef.current) return;
    setCapturing(true);
    try {
      const html2canvas = (await import("html2canvas-pro")).default;
      const table = tableWrapperRef.current.querySelector("table");
      const thead = table.querySelector("thead");
      const tbody = table.querySelector("tbody");
      const tfoot = table.querySelector("tfoot");
      // Every row renders regardless of checked state (so refining stays
      // usable), but the capture itself should still only include what's
      // actually checked/included — otherwise a row unticked mid-refine
      // would silently sneak back into the screenshot.
      const allRows = Array.from(tbody.children).filter(
        (row) => !refining || isChecked(row.dataset.recordId)
      );

      const chunks = [];
      let current = [];
      let currentHeight = 0;
      for (const row of allRows) {
        const h = row.offsetHeight;
        if (current.length > 0 && currentHeight + h > MAX_CHUNK_HEIGHT) {
          chunks.push(current);
          current = [];
          currentHeight = 0;
        }
        current.push(row);
        currentHeight += h;
      }
      chunks.push(current);

      const stamp = Date.now();
      for (let i = 0; i < chunks.length; i++) {
        const isLast = i === chunks.length - 1;
        const canvas = await captureChunk(html2canvas, {
          thead,
          rows: chunks[i],
          tfoot: isLast ? tfoot : null,
          tableClassName: table.className,
          label: chunks.length > 1 ? `Main Page — part ${i + 1} of ${chunks.length}` : null,
        });
        const link = document.createElement("a");
        link.download =
          chunks.length > 1 ? `main-page-${stamp}-part${i + 1}.png` : `main-page-${stamp}.png`;
        link.href = canvas.toDataURL("image/png");
        link.click();
        // Small gap so the browser doesn't treat back-to-back downloads as
        // an unwanted multi-download flood and block the later ones.
        if (!isLast) await new Promise((r) => setTimeout(r, 300));
      }
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
          <ProgressFilter options={progressOptions} selected={progress} />
          <ClearFiltersButton />
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
            selectAll={selectAll}
            deselectAll={deselectAll}
          />
        </div>
      </div>
      {exportError && <p className="text-xs text-red-600">{exportError}</p>}

      <div
        ref={tableWrapperRef}
        className="max-h-[70vh] overflow-y-auto overflow-x-auto overscroll-contain rounded-lg border border-gray-100 dark:border-gray-700"
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
              <th className="whitespace-nowrap px-3 py-3 text-left font-medium text-gray-600 dark:text-gray-400">
                PO Details
              </th>
              <th className="whitespace-nowrap px-3 py-3 text-left font-medium text-gray-600 dark:text-gray-400">
                Invoice Details
              </th>
              <th className="px-3 py-3 text-right font-medium text-gray-600 dark:text-gray-400">Amount</th>
              <th className="w-40 px-3 py-3 text-center font-medium text-gray-600 dark:text-gray-400">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {displayNarrowedRows.map((row) => (
              <RecordSummaryRow
                key={row.record_id}
                row={row}
                refining={refining}
                checked={isChecked(row.record_id)}
                onToggle={toggleRow}
              />
            ))}
            {displayNarrowedRows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-gray-500 dark:text-gray-400">
                  {rows.length === 0 ? "No records found." : "All rows refined out — click Refine list to adjust."}
                </td>
              </tr>
            )}
          </tbody>
          {displayNarrowedRows.length > 0 && (
            <tfoot className="sticky bottom-0 border-t-2 border-gray-200 bg-gray-50 font-medium dark:border-gray-700 dark:bg-gray-900/40">
              <tr>
                <td colSpan={2} className="px-3 py-3 text-right text-gray-700 dark:text-gray-300">
                  Total
                </td>
                <td colSpan={2}></td>
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
