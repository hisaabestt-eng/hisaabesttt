"use client";

import { useState } from "react";
import { DocumentPreviewLink } from "./DocumentPreview";

function formatDate(value) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function docHref(document) {
  if (!document) return null;
  return document.external_url || document.publicPath || null;
}

function Field({ label, value }) {
  return (
    <div>
      <div className="text-xs font-medium uppercase tracking-wide text-gray-400">{label}</div>
      <div className="text-sm text-gray-800 dark:text-gray-200">{value}</div>
    </div>
  );
}

function DocumentField({ document }) {
  const href = docHref(document);
  return (
    <div>
      <div className="text-xs font-medium uppercase tracking-wide text-gray-400">Document</div>
      {href ? (
        <DocumentPreviewLink
          href={href}
          fileName={document?.file_name}
          externalUrl={document?.external_url}
          className="text-sm text-blue-600 underline"
        >
          {document.external_url ? "External Link" : document.file_name}
        </DocumentPreviewLink>
      ) : (
        <div className="text-sm text-gray-400">
          {document?.doc_id ? "Uploaded before file storage was set up — no file to preview." : "No document attached."}
        </div>
      )}
    </div>
  );
}

export default function InvoiceChainButton({ invoiceNo }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [detail, setDetail] = useState(null);

  async function openModal() {
    setOpen(true);
    setLoading(true);
    const res = await fetch(`/api/invoices/${invoiceNo}/chain`);
    const data = await res.json();
    setDetail(data);
    setLoading(false);
  }

  return (
    <>
      <button
        type="button"
        onClick={openModal}
        className="text-left text-gray-700 underline decoration-dotted hover:text-gray-900 dark:text-gray-300 dark:hover:text-gray-100"
      >
        {invoiceNo}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-lg bg-white dark:bg-gray-800 p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">Invoice Details</h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-gray-400 hover:text-gray-700 dark:text-gray-300"
              >
                ✕
              </button>
            </div>

            {loading && <p className="text-sm text-gray-500 dark:text-gray-400">Loading...</p>}

            {!loading && detail && (
              <div className="flex flex-col gap-4">
                <div className="grid grid-cols-2 gap-3 border-b pb-3">
                  <Field label="Estimate Date" value={formatDate(detail.estimateDate)} />
                  <Field label="Estimate No" value={detail.estimateNo || "—"} />
                </div>

                <div className="border-b pb-3">
                  <Field label="Estimate Description" value={detail.estimateDescription || "—"} />
                </div>

                <div className="grid grid-cols-2 gap-3 border-b pb-3">
                  <Field label="PO Date" value={formatDate(detail.poDate)} />
                  <Field label="PO Number" value={detail.poNo || "—"} />
                </div>

                <div className="grid grid-cols-2 gap-3 border-b pb-3">
                  <Field label="Invoice Date" value={formatDate(detail.invoiceDate)} />
                  <Field label="Invoice No" value={detail.invoiceNo || "—"} />
                </div>

                <DocumentField document={detail.document} />
              </div>
            )}

            {!loading && !detail && (
              <p className="text-sm text-gray-500 dark:text-gray-400">Not found.</p>
            )}
          </div>
        </div>
      )}
    </>
  );
}
