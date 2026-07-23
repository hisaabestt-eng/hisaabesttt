"use client";

import { useState } from "react";

// Lets a user manually drop specific rows out of an already search/filtered
// list — e.g. searching "March" surfaces A-G, but C and F aren't actually
// wanted this time. Purely client-side and purely visual: nothing is
// deleted, nothing is persisted, it only hides rows from the current view.
// Checkboxes only appear once "refining" is switched on, and every row
// starts checked (visible) — unchecking one drops it out.
//
// Resets whenever the underlying rows change (a new search/filter came back
// from the server) — a stale hidden-row set from a previous search would
// otherwise silently keep hiding rows that have nothing to do with the new
// results. Comparing the row ids (not just array identity) means a
// same-length-different-content page (e.g. after an edit) still resets, but
// a search that happens to return the exact same rows won't cost the user
// their in-progress refinement.
export function useRefineFilter(rows, getRowId) {
  const [refining, setRefining] = useState(false);
  const [hiddenIds, setHiddenIds] = useState(() => new Set());
  const [prevKey, setPrevKey] = useState(() => rows.map(getRowId).join("|"));

  const key = rows.map(getRowId).join("|");
  if (key !== prevKey) {
    setPrevKey(key);
    setHiddenIds(new Set());
  }

  function toggleRow(id) {
    setHiddenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleRefining() {
    setRefining((v) => !v);
    setHiddenIds(new Set());
  }

  const visibleRows = refining ? rows.filter((r) => !hiddenIds.has(getRowId(r))) : rows;

  return {
    refining,
    toggleRefining,
    visibleRows,
    isChecked: (id) => !hiddenIds.has(id),
    toggleRow,
    hiddenCount: hiddenIds.size,
  };
}

export function RefineToggleButton({ refining, toggleRefining, totalCount, visibleCount }) {
  return (
    <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
      <button
        type="button"
        onClick={toggleRefining}
        className={`rounded-full border px-3 py-1 text-xs font-medium ${
          refining
            ? "border-blue-600 bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
            : "border-gray-300 text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-400 dark:hover:bg-gray-700"
        }`}
      >
        {refining ? "Done refining" : "Refine list"}
      </button>
      {refining && (
        <span>
          {visibleCount} of {totalCount} shown — untick a row to drop it from this view
        </span>
      )}
    </div>
  );
}
