"use client";

import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";

// A "⋮" trigger for a row's Edit/Delete (kept out of the table's Actions
// column so it doesn't force extra width on every row). The dropdown is
// portaled to document.body rather than rendered in place, for two reasons:
// these tables scroll (overflow-y-auto), so a plain absolutely positioned
// dropdown gets clipped for rows near the bottom of the visible area; and
// Edit/Delete's own modals use `position: fixed; inset: 0` to cover the
// screen, which breaks (becomes relative to the dropdown's own box instead
// of the viewport) if any ancestor sets a CSS transform — which a
// same-DOM-tree dropdown positioned via transform would do.
export function ActionsMenu({ children }) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState({ top: 0, right: 0 });
  const [mounted, setMounted] = useState(false);
  const btnRef = useRef(null);
  const menuRef = useRef(null);

  useEffect(() => setMounted(true), []);

  function toggleOpen(e) {
    e.stopPropagation();
    if (!open && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      setCoords({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
    }
    setOpen((v) => !v);
  }

  useEffect(() => {
    if (!open) return;
    function handleOutside(e) {
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target) &&
        btnRef.current &&
        !btnRef.current.contains(e.target)
      ) {
        setOpen(false);
      }
    }
    function handleScroll() {
      setOpen(false);
    }
    document.addEventListener("mousedown", handleOutside);
    window.addEventListener("scroll", handleScroll, true);
    return () => {
      document.removeEventListener("mousedown", handleOutside);
      window.removeEventListener("scroll", handleScroll, true);
    };
  }, [open]);

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={toggleOpen}
        className="rounded px-1.5 py-0.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-700 dark:hover:text-gray-100"
        aria-label="Actions"
        aria-expanded={open}
      >
        ⋮
      </button>
      {open &&
        mounted &&
        createPortal(
          <div
            ref={menuRef}
            style={{ position: "fixed", top: coords.top, right: coords.right }}
            className="z-50 flex min-w-[110px] flex-col gap-0.5 rounded-md border border-gray-200 bg-white py-1.5 shadow-lg dark:border-gray-700 dark:bg-gray-800 [&_button]:w-full [&_button]:px-3 [&_button]:py-1 [&_button]:text-left [&_button]:text-xs [&_button]:no-underline [&_button]:hover:bg-gray-50 dark:[&_button]:hover:bg-gray-700"
            onClick={(e) => e.stopPropagation()}
          >
            {children}
          </div>,
          document.body
        )}
    </>
  );
}
