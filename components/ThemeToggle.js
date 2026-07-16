"use client";

import { useEffect, useState } from "react";

export function ThemeToggle() {
  const [isDark, setIsDark] = useState(false);

  // The server can't know the visitor's theme (it lives in localStorage /
  // the OS preference), so this has to run on mount rather than during
  // render — the inline script in layout.js already applied the right
  // class before hydration, this just brings the button's own state
  // (and its icon) in sync with that.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- syncing with the DOM class set by the pre-hydration script, not derivable during render
    setIsDark(document.documentElement.classList.contains("dark"));
  }, []);

  function toggle() {
    const next = !isDark;
    setIsDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("theme", next ? "dark" : "light");
  }

  return (
    <button
      type="button"
      onClick={toggle}
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
      className="rounded-full p-2 text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-700 dark:hover:text-white"
    >
      {isDark ? "🌙" : "☀️"}
    </button>
  );
}
