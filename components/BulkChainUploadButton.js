"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const TEMPLATE_HEADERS = [
  "Client Name",
  "Record Date",
  "Description",
  "Amount",
  "Estimate No",
  "Estimate Date",
  "Estimate Document Link",
  "PO No",
  "PO Date",
  "PO Document Link",
  "Invoice No",
  "Invoice Date",
  "Invoice Amount",
  "GST %",
  "TDS %",
  "Invoice Document Link",
];

// Bulk-imports a full Record -> Estimate -> PO -> Invoice chain from one
// spreadsheet — one row per deal, stopping at whichever stage that deal has
// actually reached (a row can end at just a Record, or go all the way to an
// Invoice). Every row in the file is validated before anything is written;
// one bad row rejects the whole upload, same rule as the Records-only upload.
export function BulkChainUploadButton({ compId }) {
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
      TEMPLATE_HEADERS,
      [
        "Example Client",
        new Date(),
        "Sample work description",
        100000,
        "EST-EXAMPLE-1",
        new Date(),
        "",
        "PO-EXAMPLE-1",
        new Date(),
        "",
        "INV-EXAMPLE-1",
        new Date(),
        100000,
        18,
        2,
        "",
      ],
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Chain");
    XLSX.writeFile(wb, "bulk-chain-upload-template.xlsx");
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
        recordDate: r["Record Date"],
        description: r["Description"],
        amount: r["Amount"],
        estNo: r["Estimate No"],
        estDate: r["Estimate Date"],
        estDocLink: r["Estimate Document Link"],
        poNo: r["PO No"],
        poDate: r["PO Date"],
        poDocLink: r["PO Document Link"],
        invoiceNo: r["Invoice No"],
        invoiceDate: r["Invoice Date"],
        invoiceAmount: r["Invoice Amount"],
        gstPct: r["GST %"],
        tdsPct: r["TDS %"],
        invoiceDocLink: r["Invoice Document Link"],
      }));
    } catch {
      setParseError(
        "Could not read this file — make sure it's the .xlsx template with the same column headers."
      );
      setUploading(false);
      return;
    }

    const res = await fetch("/api/bulk-chain", {
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
    setSuccess(data);
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
        Bulk Upload (Full Chain)
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg bg-white dark:bg-gray-800 p-5 shadow-xl"
          >
            <h2 className="mb-3 text-base font-semibold text-gray-900 dark:text-gray-100">
              Bulk Upload — Record + Estimate + PO + Invoice
            </h2>
            <p className="mb-3 text-xs text-gray-500 dark:text-gray-400">
              One row = one deal. A row can stop at just a Record, or go all the way to an Invoice —
              but it can&apos;t skip a stage (e.g. a PO needs Estimate No/Date filled in on the same row).
              Document Link columns are optional and take a Google Drive (or other) link — a local
              file can&apos;t be attached in bulk, add that later via Edit. If any row has a mistake,
              nothing is saved.
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

            {success && (
              <p className="mb-3 text-sm text-green-700">
                Uploaded: {success.recordCount} record(s), {success.estimateCount} estimate(s),{" "}
                {success.poCount} PO(s), {success.invoiceCount} invoice(s).
              </p>
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
