"use client";

// Shared by Estimate/PO/Invoice modals: lets the user either upload a file
// (stored locally under public/uploads/) or paste a link (e.g. Google Drive)
// stored as documents.external_url instead.
export function DocumentField({ label, doc, setDoc }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-gray-500">{label}</label>
      <div className="mb-2 flex gap-4 text-xs text-gray-600">
        <label className="flex items-center gap-1.5">
          <input
            type="radio"
            checked={doc.mode === "file"}
            onChange={() => setDoc({ mode: "file", file: null, url: "" })}
          />
          Upload file
        </label>
        <label className="flex items-center gap-1.5">
          <input
            type="radio"
            checked={doc.mode === "link"}
            onChange={() => setDoc({ mode: "link", file: null, url: "" })}
          />
          Paste link
        </label>
      </div>
      {doc.mode === "file" ? (
        <input
          key="file-input"
          type="file"
          onChange={(e) => setDoc({ ...doc, file: e.target.files?.[0] || null })}
          className="w-full text-sm"
        />
      ) : (
        <input
          key="url-input"
          type="url"
          placeholder="https://drive.google.com/..."
          value={doc.url}
          onChange={(e) => setDoc({ ...doc, url: e.target.value })}
          className="w-full rounded border-gray-300 px-2 py-1.5 text-sm"
        />
      )}
    </div>
  );
}

export const EMPTY_DOC = { mode: "file", file: null, url: "" };

export async function uploadDocumentField(apiPath, doc) {
  if (doc.mode === "file" && doc.file) {
    const formData = new FormData();
    formData.append("file", doc.file);
    await fetch(apiPath, { method: "POST", body: formData });
  } else if (doc.mode === "link" && doc.url.trim()) {
    const formData = new FormData();
    formData.append("url", doc.url.trim());
    await fetch(apiPath, { method: "POST", body: formData });
  }
}
