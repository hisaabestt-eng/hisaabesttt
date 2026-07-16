"use client";

// Shared by Estimate/PO/Invoice modals — a pasted link (e.g. Google Drive)
// stored as documents.external_url. No file-upload option: cloud hosting
// (Vercel) has no persistent local disk to keep an uploaded file on.
export function DocumentField({ label, doc, setDoc }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">{label}</label>
      <input
        type="url"
        placeholder="https://drive.google.com/..."
        value={doc.url}
        onChange={(e) => setDoc({ ...doc, url: e.target.value })}
        className="w-full rounded-md border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 px-2 py-1.5 text-sm"
      />
    </div>
  );
}

export const EMPTY_DOC = { url: "" };

export async function uploadDocumentField(apiPath, doc) {
  if (doc.url.trim()) {
    const formData = new FormData();
    formData.append("url", doc.url.trim());
    await fetch(apiPath, { method: "POST", body: formData });
  }
}
