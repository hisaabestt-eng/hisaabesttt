"use client";

import { useEffect } from "react";

// Every modal in this app is a `fixed inset-0` overlay, but the page
// underneath was never scroll-locked while one is open — a mouse wheel or
// trackpad scroll over the modal, if the modal's own content didn't happen
// to be under the cursor, would scroll the table/page behind it instead of
// the modal, making the modal feel stuck (can't reach Save/Cancel) while the
// background visibly moves.
export function useBodyScrollLock(active) {
  useEffect(() => {
    if (!active) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = original;
    };
  }, [active]);
}
