"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { STATUS_STYLES, LIFECYCLE_STYLES } from "@/lib/status";
import { parseTags } from "@/lib/tags";
import { DocumentPreviewLink } from "./DocumentPreview";

function formatDate(value) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

// The number itself (Estimate No / PO No / Invoice No) is the link when a
// document or external link exists — no separate "View document" line.
function docHref(document) {
  if (!document) return null;
  return document.external_url || document.publicPath || null;
}

function Field({ label, value, doc }) {
  const href = doc !== undefined ? docHref(doc) : null;
  return (
    <div>
      <div className="text-xs font-medium uppercase tracking-wide text-gray-400">{label}</div>
      {href ? (
        <DocumentPreviewLink
          href={href}
          fileName={doc?.file_name}
          externalUrl={doc?.external_url}
          className="text-sm text-blue-600 underline"
        >
          {value}
        </DocumentPreviewLink>
      ) : (
        <div className="text-sm text-gray-800">{value}</div>
      )}
      {doc !== undefined && !href && (
        <div className="text-xs text-gray-400">No document attached</div>
      )}
    </div>
  );
}

export default function RecordDetailButton({ recordId, description }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [detail, setDetail] = useState(null);
  const [tagInput, setTagInput] = useState("");
  const [saving, setSaving] = useState(false);
  const router = useRouter();

  async function openModal() {
    setOpen(true);
    setLoading(true);
    const res = await fetch(`/api/records/${recordId}`);
    const data = await res.json();
    setDetail(data);
    setLoading(false);
  }

  async function submitTag(e) {
    e.preventDefault();
    if (!tagInput.trim() || !detail?.estimate?.id) return;
    setSaving(true);
    const res = await fetch(`/api/estimates/${detail.estimate.id}/tags`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tag: tagInput.trim() }),
    });
    const data = await res.json();
    setDetail((d) => ({ ...d, estimate: { ...d.estimate, tagsList: data.tags } }));
    setTagInput("");
    setSaving(false);
    router.refresh();
  }

  const tagsList = detail?.estimate?.tagsList ?? parseTags(detail?.estimate?.tags);

  return (
    <>
      <button
        type="button"
        onClick={openModal}
        className="text-left text-gray-700 underline decoration-dotted hover:text-gray-900 dark:text-gray-100"
      >
        {description || "—"}
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
              <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">Record Details</h2>
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
                  <Field label="Estimate Date" value={formatDate(detail.estimate.date)} />
                  <Field
                    label="Estimate No"
                    value={detail.estimate.no || "—"}
                    doc={detail.estimate.document}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3 border-b pb-3">
                  <Field label="PO Date" value={formatDate(detail.po?.date)} />
                  <Field label="PO No" value={detail.po?.no || "—"} doc={detail.po?.document} />
                </div>

                {detail.invoices.length === 0 ? (
                  <div className="grid grid-cols-2 gap-3 border-b pb-3">
                    <Field label="Invoice Date" value="—" />
                    <Field label="Invoice No" value="—" />
                  </div>
                ) : (
                  detail.invoices.map((inv) => (
                    <div key={inv.id} className="border-b pb-3">
                      <div className="grid grid-cols-2 gap-3">
                        <Field label="Invoice Date" value={formatDate(inv.date)} />
                        <Field label="Invoice No" value={inv.no || "—"} doc={inv.document} />
                      </div>
                      {inv.paymentStatus && (
                        <div className="mt-2">
                          <div className="text-xs font-medium uppercase tracking-wide text-gray-400">
                            Payment Status
                          </div>
                          <span
                            className={`mt-1 inline-block inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                              STATUS_STYLES[inv.paymentStatus] || LIFECYCLE_STYLES[inv.paymentStatus]
                            }`}
                          >
                            {inv.paymentStatus}
                          </span>
                        </div>
                      )}
                    </div>
                  ))
                )}

                <div>
                  <div className="mb-1 text-xs font-medium uppercase tracking-wide text-gray-400">
                    Tags
                  </div>
                  <div className="mb-2 flex flex-wrap gap-1.5">
                    {tagsList.length === 0 && (
                      <span className="text-sm text-gray-400">No tags yet</span>
                    )}
                    {tagsList.map((tag) => (
                      <span
                        key={tag}
                        className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-700 dark:text-gray-300"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                  <form onSubmit={submitTag} className="flex gap-2">
                    <input
                      type="text"
                      value={tagInput}
                      onChange={(e) => setTagInput(e.target.value)}
                      placeholder="Add a tag..."
                      className="flex-1 rounded-md border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 px-2 py-1 text-sm"
                    />
                    <button
                      type="submit"
                      disabled={saving}
                      className="rounded-full bg-blue-600 px-3 py-1 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
                    >
                      Add
                    </button>
                  </form>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

