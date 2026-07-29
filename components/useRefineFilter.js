"use client";

import { useState } from "react";

// Lets a user narrow an already search/filtered list down to just the rows
// they tick — e.g. searching "March" surfaces A-G, but only C and F are
// actually wanted this time. Purely client-side and purely visual: nothing
// is deleted, nothing is persisted.
//
// Two distinct phases:
//   - Editing ("Refine list" clicked, refining=true): every row stays on
//     screen — including unticked ones, shown dimmed — so Deselect All then
//     ticking back just the few you want actually works (unticking used to
//     remove a row outright, which was a dead end: once everything was
//     unticked there was nothing left on screen to tick back in).
//   - Applied ("Done refining" clicked, refining=false): the table narrows
//     down to just the ticked rows and *stays* narrowed — that's the whole
//     point of refining. Clicking "Refine list" again re-opens editing with
//     every row visible again, so the selection can be adjusted further.
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

  // Only flips the edit/applied phase — the ticked set itself carries over
  // in both directions, so "Done refining" applies whatever was just picked
  // instead of discarding it.
  function toggleRefining() {
    setRefining((v) => !v);
  }

  // Gmail-style "select all" / "select none" — much faster than unticking
  // (or reticking) rows one at a time on a long list.
  function selectAll() {
    setHiddenIds(new Set());
  }

  function deselectAll() {
    setHiddenIds(new Set(rows.map(getRowId)));
  }

  // The checked/included subset — feeds totals, export, screenshot, and
  // (once refining is turned off) the table itself.
  const visibleRows = rows.filter((r) => !hiddenIds.has(getRowId(r)));

  return {
    refining,
    toggleRefining,
    // What the table actually renders: everything while adjusting the
    // selection, just the ticked subset once it's applied.
    displayRows: refining ? rows : visibleRows,
    visibleRows,
    isChecked: (id) => !hiddenIds.has(id),
    toggleRow,
    hiddenCount: hiddenIds.size,
    selectAll,
    deselectAll,
  };
}

export function RefineToggleButton({
  refining,
  toggleRefining,
  totalCount,
  visibleCount,
  selectAll,
  deselectAll,
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
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
        <>
          <button
            type="button"
            onClick={selectAll}
            className="text-xs font-medium text-blue-600 hover:underline dark:text-blue-400"
          >
            Select all
          </button>
          <span className="text-gray-300 dark:text-gray-600">|</span>
          <button
            type="button"
            onClick={deselectAll}
            className="text-xs font-medium text-blue-600 hover:underline dark:text-blue-400"
          >
            Deselect all
          </button>
          <span>{visibleCount} of {totalCount} selected — tick/untick rows to include or drop them</span>
        </>
      )}
    </div>
  );
}
