"use client";

import { useState } from "react";

// Shared everywhere an Estimate's tags need to be viewable/editable — the
// Main page had view+add already; this adds remove and reuses the same look
// on the Records/Estimates/Purchase Orders pages and the record detail page,
// since a tag belongs to the Estimate itself, not to whichever page happens
// to be showing it.
export function EstimateTagsEditor({ estId, initialTags = [] }) {
  const [tags, setTags] = useState(initialTags);
  const [input, setInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleAdd(e) {
    e.preventDefault();
    if (!input.trim()) return;
    setSaving(true);
    setError("");
    const res = await fetch(`/api/estimates/${estId}/tags`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tag: input.trim() }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) {
      setError(data.error || "Could not add tag");
      return;
    }
    setTags(data.tags);
    setInput("");
  }

  async function handleRemove(tag) {
    setSaving(true);
    setError("");
    const res = await fetch(`/api/estimates/${estId}/tags`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tag }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) {
      setError(data.error || "Could not remove tag");
      return;
    }
    setTags(data.tags);
  }

  return (
    <div onClick={(e) => e.stopPropagation()}>
      <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
        {tags.length === 0 && <span className="text-xs text-gray-400">No tags yet</span>}
        {tags.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-700 dark:bg-gray-700 dark:text-gray-300"
          >
            {tag}
            <button
              type="button"
              onClick={() => handleRemove(tag)}
              disabled={saving}
              className="text-gray-400 hover:text-red-600 disabled:opacity-50"
              aria-label={`Remove tag ${tag}`}
            >
              ×
            </button>
          </span>
        ))}
      </div>
      <form onSubmit={handleAdd} className="flex gap-1.5">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Add a tag..."
          className="w-32 rounded-md border border-gray-300 px-2 py-1 text-xs dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
        />
        <button
          type="submit"
          disabled={saving || !input.trim()}
          className="rounded-full bg-blue-600 px-2 py-1 text-xs text-white hover:bg-blue-700 disabled:opacity-50"
        >
          Add
        </button>
      </form>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
