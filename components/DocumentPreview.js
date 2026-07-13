"use client";

import { useState } from "react";

function driveIdFromUrl(url) {
  const m = url.match(/\/file\/d\/([^/]+)/);
  return m ? m[1] : null;
}

function getExt(fileName) {
  return (fileName || "").split(".").pop()?.toLowerCase() || "";
}

// Decides how a document can be shown inline instead of just opening a new
// tab. Drive links use Drive's own preview iframe (handles PDF/image/Excel
// alike); local uploads are previewed by extension — Excel needs client-side
// parsing since browsers can't render spreadsheets natively.
function previewKind({ externalUrl, fileName }) {
  if (externalUrl) {
    const driveId = driveIdFromUrl(externalUrl);
    if (driveId) {
      return { kind: "iframe", src: `https://drive.google.com/file/d/${driveId}/preview` };
    }
    return { kind: "none" };
  }
  const ext = getExt(fileName);
  if (ext === "pdf") return { kind: "iframe", src: null };
  if (["jpg", "jpeg", "png", "gif", "webp"].includes(ext)) return { kind: "image" };
  if (["xls", "xlsx", "csv"].includes(ext)) return { kind: "excel" };
  return { kind: "none" };
}

// Wraps a document link so PDFs, images, and Excel files open in an inline
// preview modal instead of forcing a new tab — Word/other types still just
// open in a new tab via the normal <a> behavior.
export function DocumentPreviewLink({ href, fileName, externalUrl, children, className }) {
  const [open, setOpen] = useState(false);
  const [tableHtml, setTableHtml] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const info = previewKind({ externalUrl, fileName });

  async function handleClick(e) {
    if (info.kind === "none") return;
    e.preventDefault();
    setOpen(true);
    if (info.kind === "excel" && !tableHtml) {
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
            className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-lg bg-white shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b px-4 py-2">
              <span className="text-sm font-medium text-gray-700">Preview</span>
              <div className="flex items-center gap-3">
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
                  className="text-gray-400 hover:text-gray-700"
                >
                  ✕
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-auto bg-gray-50">
              {info.kind === "iframe" && (
                <iframe src={info.src || href} className="h-[75vh] w-full" title="Document preview" />
              )}
              {info.kind === "image" && (
                <img src={href} alt="Document preview" className="mx-auto max-h-[75vh]" />
              )}
              {info.kind === "excel" && (
                <div className="p-4">
                  {loading && <p className="text-sm text-gray-500">Loading…</p>}
                  {error && <p className="text-sm text-red-600">{error}</p>}
                  {tableHtml && (
                    <div
                      className="overflow-x-auto text-xs [&_table]:border-collapse [&_td]:border [&_td]:border-gray-200 [&_td]:px-2 [&_td]:py-1"
                      dangerouslySetInnerHTML={{ __html: tableHtml }}
                    />
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
