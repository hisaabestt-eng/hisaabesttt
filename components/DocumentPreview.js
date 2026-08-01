"use client";

import { useState, useEffect } from "react";

function driveIdFromUrl(url) {
  const m = url.match(/\/file\/d\/([^/]+)/);
  return m ? m[1] : null;
}

function sheetsIdFromUrl(url) {
  const m = url.match(/\/spreadsheets\/d\/([^/]+)/);
  return m ? m[1] : null;
}

function getExt(fileName) {
  return (fileName || "").split(".").pop()?.toLowerCase() || "";
}

function docHref(document) {
  if (!document) return null;
  return document.external_url || document.publicPath || null;
}

// Decides how a document can be shown inline instead of just opening a new
// tab. Drive file links and Google Sheets links each use Google's own
// preview iframe for that surface; local uploads are previewed by
// extension — Excel needs client-side parsing since browsers can't render
// spreadsheets natively.
function previewKind({ externalUrl, fileName }) {
  if (externalUrl) {
    const driveId = driveIdFromUrl(externalUrl);
    if (driveId) {
      return { kind: "iframe", src: `https://drive.google.com/file/d/${driveId}/preview` };
    }
    const sheetsId = sheetsIdFromUrl(externalUrl);
    if (sheetsId) {
      return { kind: "iframe", src: `https://docs.google.com/spreadsheets/d/${sheetsId}/preview` };
    }
    return { kind: "none" };
  }
  const ext = getExt(fileName);
  if (ext === "pdf") return { kind: "iframe", src: null };
  if (["jpg", "jpeg", "png", "gif", "webp"].includes(ext)) return { kind: "image" };
  if (["xls", "xlsx", "csv"].includes(ext)) return { kind: "excel" };
  return { kind: "none" };
}

const ZOOM_MIN = 0.5;
const ZOOM_MAX = 1.2;
const ZOOM_STEP = 0.1;

// Wraps a document link so PDFs, images, and Excel files open in an inline
// preview modal instead of forcing a new tab — Word/other types still just
// open in a new tab via the normal <a> behavior.
export function DocumentPreviewLink({ href, fileName, externalUrl, children, className, autoOpen = false }) {
  const [open, setOpen] = useState(autoOpen);
  const [tableHtml, setTableHtml] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  // Spreadsheets tend to have many columns that don't fit a fixed-width
  // modal — a wider modal plus a default zoomed-out view (both the Sheets
  // iframe and the parsed-table view) shows more of the sheet at once
  // instead of forcing horizontal scrolling for every row.
  const [zoom, setZoom] = useState(0.8);
  const info = previewKind({ externalUrl, fileName });
  const isSpreadsheet = info.kind === "excel" || (info.kind === "iframe" && info.src?.includes("spreadsheets"));

  async function loadExcelPreview() {
    setLoading(true);
    setError("");
    try {
      const XLSX = await import("xlsx");
      const res = await fetch(href);
      const buf = await res.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const html = XLSX.utils.sheet_to_html(wb.Sheets[wb.SheetNames[0]]);
      setTableHtml(html);
    } catch {
      setError("Could not load this spreadsheet for preview.");
    }
    setLoading(false);
  }

  // autoOpen skips the click that would normally trigger the Excel fetch —
  // load it once on mount instead.
  useEffect(() => {
    if (autoOpen && info.kind === "excel") loadExcelPreview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleClick(e) {
    if (info.kind === "none") return;
    e.preventDefault();
    setOpen(true);
    if (info.kind === "excel" && !tableHtml) {
      await loadExcelPreview();
    }
  }

  return (
    <>
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        onClick={handleClick}
        className={className}
      >
        {children}
      </a>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className={`flex max-h-[90vh] w-full flex-col overflow-hidden rounded-lg bg-white dark:bg-gray-800 shadow-xl ${
              isSpreadsheet ? "max-w-6xl" : "max-w-3xl"
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b px-4 py-2">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Preview</span>
              <div className="flex items-center gap-3">
                {isSpreadsheet && (
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setZoom((z) => Math.max(ZOOM_MIN, +(z - ZOOM_STEP).toFixed(2)))}
                      disabled={zoom <= ZOOM_MIN}
                      className="rounded border border-gray-300 px-1.5 text-xs text-gray-600 hover:bg-gray-50 disabled:opacity-40 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
                      title="Zoom out"
                    >
                      −
                    </button>
                    <button
                      type="button"
                      onClick={() => setZoom(1)}
                      className="w-10 text-center text-xs text-gray-500 hover:underline dark:text-gray-400"
                      title="Reset zoom"
                    >
                      {Math.round(zoom * 100)}%
                    </button>
                    <button
                      type="button"
                      onClick={() => setZoom((z) => Math.min(ZOOM_MAX, +(z + ZOOM_STEP).toFixed(2)))}
                      disabled={zoom >= ZOOM_MAX}
                      className="rounded border border-gray-300 px-1.5 text-xs text-gray-600 hover:bg-gray-50 disabled:opacity-40 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
                      title="Zoom in"
                    >
                      +
                    </button>
                  </div>
                )}
                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-blue-600 underline"
                >
                  Open in new tab
                </a>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="text-gray-400 hover:text-gray-700 dark:text-gray-300"
                >
                  ✕
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-auto bg-gray-50">
              {info.kind === "iframe" && isSpreadsheet && (
                <div className="h-[75vh] overflow-auto">
                  <div
                    style={{
                      width: `${100 / zoom}%`,
                      height: `${100 / zoom}%`,
                      transform: `scale(${zoom})`,
                      transformOrigin: "top left",
                    }}
                  >
                    <iframe src={info.src} className="h-full w-full border-0" title="Document preview" />
                  </div>
                </div>
              )}
              {info.kind === "iframe" && !isSpreadsheet && (
                <iframe src={info.src || href} className="h-[75vh] w-full" title="Document preview" />
              )}
              {info.kind === "image" && (
                <img src={href} alt="Document preview" className="mx-auto max-h-[75vh]" />
              )}
              {info.kind === "excel" && (
                <div className="p-4">
                  {loading && <p className="text-sm text-gray-500 dark:text-gray-400">Loading…</p>}
                  {error && <p className="text-sm text-red-600">{error}</p>}
                  {tableHtml && (
                    <div className="overflow-x-auto">
                      <div
                        style={{ transform: `scale(${zoom})`, transformOrigin: "top left", width: "fit-content" }}
                        className="text-xs [&_table]:border-collapse [&_td]:border [&_td]:border-gray-200 [&_td]:px-2 [&_td]:py-1"
                        dangerouslySetInnerHTML={{ __html: tableHtml }}
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// A list row's own number (Est No / PO No / Invoice No) doubles as the
// document link — no separate Document column. Clicking it previews the
// document when one's attached; otherwise it shows a small "not attached"
// notice instead of doing nothing, so the click always gives feedback.
export function EntityDocLink({ label, externalUrl, docId, docFileExists, fileName, href, className }) {
  const [showNotice, setShowNotice] = useState(false);

  if (externalUrl) {
    return (
      <DocumentPreviewLink href={externalUrl} externalUrl={externalUrl} className={className}>
        {label}
      </DocumentPreviewLink>
    );
  }
  if (docId && docFileExists) {
    return (
      <DocumentPreviewLink href={href} fileName={fileName} className={className}>
        {label}
      </DocumentPreviewLink>
    );
  }

  const note = docId
    ? "This document was uploaded before file storage was set up, so there's no file to preview."
    : "No document attached.";

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setShowNotice(true);
        }}
        className={className}
      >
        {label}
      </button>
      {showNotice && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setShowNotice(false)}
        >
          <div
            className="w-full max-w-sm rounded-lg bg-white dark:bg-gray-800 p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-sm text-gray-700 dark:text-gray-300">{note}</p>
            <button
              type="button"
              onClick={() => setShowNotice(false)}
              className="mt-4 text-xs text-blue-600 underline"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </>
  );
}

// Same idea as EntityDocLink, for callers that don't have the document data
// on hand synchronously (e.g. an invoice number inside a nested table, where
// plumbing docFileExists through every parent's props isn't practical) —
// fetches the document from `fetchUrl` on first click instead.
export function LazyEntityDocLink({ label, fetchUrl, className }) {
  const [resolved, setResolved] = useState(false);
  const [loading, setLoading] = useState(false);
  const [document, setDocument] = useState(null);
  const [showNotice, setShowNotice] = useState(false);

  async function handleClick(e) {
    e.stopPropagation();
    if (resolved) {
      if (!docHref(document)) setShowNotice(true);
      return;
    }
    setLoading(true);
    const res = await fetch(fetchUrl);
    const data = await res.json();
    setDocument(data.document);
    setResolved(true);
    setLoading(false);
    if (!docHref(data.document)) setShowNotice(true);
  }

  const href = docHref(document);
  if (resolved && href) {
    return (
      <DocumentPreviewLink
        href={href}
        fileName={document?.file_name}
        externalUrl={document?.external_url}
        className={className}
        autoOpen
      >
        {label}
      </DocumentPreviewLink>
    );
  }

  const note = document?.doc_id
    ? "This document was uploaded before file storage was set up, so there's no file to preview."
    : "No document attached.";

  return (
    <>
      <button type="button" onClick={handleClick} className={className} disabled={loading}>
        {label}
      </button>
      {showNotice && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setShowNotice(false)}
        >
          <div
            className="w-full max-w-sm rounded-lg bg-white dark:bg-gray-800 p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-sm text-gray-700 dark:text-gray-300">{note}</p>
            <button
              type="button"
              onClick={() => setShowNotice(false)}
              className="mt-4 text-xs text-blue-600 underline"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </>
  );
}
