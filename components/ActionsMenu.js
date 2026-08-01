"use client";

import { useState, useRef, useEffect } from "react";

// A "⋮" trigger for a row's Edit/Delete (kept out of the table's Actions
// column so it doesn't force extra width on every row). Positioned via
// getBoundingClientRect + `position: fixed` rather than a plain absolute
// dropdown, since these tables scroll (overflow-y-auto) and an absolutely
// positioned menu would get clipped by that ancestor for rows near the
// bottom of the visible area.
export function ActionsMenu({ children }) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const btnRef = useRef(null);
  const menuRef = useRef(null);

  function toggleOpen(e) {
    e.stopPropagation();
    if (!open && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      setCoords({ top: rect.bottom + 4, left: rect.right });
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
      {open && (
        <div
          ref={menuRef}
          style={{ position: "fixed", top: coords.top, left: coords.left, transform: "translateX(-100%)" }}
          className="z-50 flex min-w-[110px] flex-col gap-0.5 rounded-md border border-gray-200 bg-white py-1.5 shadow-lg dark:border-gray-700 dark:bg-gray-800 [&_button]:w-full [&_button]:px-3 [&_button]:py-1 [&_button]:text-left [&_button]:text-xs [&_button]:no-underline [&_button]:hover:bg-gray-50 dark:[&_button]:hover:bg-gray-700"
          onClick={(e) => {
            e.stopPropagation();
            setOpen(false);
          }}
        >
          {children}
        </div>
      )}
    </>
  );
}
