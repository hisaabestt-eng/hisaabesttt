"use client";

import { useState } from "react";
import { parseFlexibleDate } from "@/lib/dates";

function toDisplay(isoValue) {
  if (!isoValue) return "";
  const [y, m, d] = isoValue.split("-");
  if (!y || !m || !d) return "";
  return `${d}/${m}/${y}`;
}

// Native <input type="date"> requires clicking into the exact day/month/year
// segment before typing, which is easy to get wrong. This is a plain text
// field instead — type continuous digits (26072025), DD/MM/YYYY, DD-MM-YYYY,
// or just DD/MM (defaults to the current year) — parsed on blur via the same
// flexible parser bulk uploads already use. Keeps the same value/onChange
// contract (a YYYY-MM-DD string) as the native input it replaces.
// Optional `showPicker` adds a small calendar icon that opens the browser's
// native date picker — a real (invisible) <input type="date"> sits right
// over the icon so clicking it works everywhere, no JS picker API needed.
// Typing in the text field itself still works exactly as before.
export function DateField({ value, onChange, required, className = "", id, showPicker = false }) {
  const [prevValue, setPrevValue] = useState(value);
  const [text, setText] = useState(toDisplay(value));
  const [invalid, setInvalid] = useState(false);

  // Adjusting state during render (not in an effect) when a prop changes —
  // React's own recommended pattern for this, since it re-renders before
  // committing instead of causing an extra effect-triggered pass. Needed
  // for modals that reset their date state without remounting this field
  // (e.g. re-opening "Add Estimate" against a different record).
  if (value !== prevValue) {
    setPrevValue(value);
    setText(toDisplay(value));
    setInvalid(false);
  }

  function handleBlur() {
    if (text.trim() === "") {
      setInvalid(false);
      return;
    }
    const parsed = parseFlexibleDate(text);
    if (parsed) {
      setText(toDisplay(parsed));
      setInvalid(false);
      if (parsed !== value) onChange(parsed);
    } else {
      setInvalid(true);
    }
  }

  function handlePickerChange(e) {
    const picked = e.target.value;
    setText(toDisplay(picked));
    setInvalid(false);
    if (picked !== value) onChange(picked);
  }

  return (
    <div>
      <div className={showPicker ? "relative inline-block" : undefined}>
        <input
          id={id}
          type="text"
          inputMode="numeric"
          placeholder="DD/MM/YYYY"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={handleBlur}
          required={required}
          className={`${className} ${showPicker ? "pr-7" : ""} ${invalid ? "border-red-400" : ""}`}
        />
        {showPicker && (
          <>
            <input
              type="date"
              value={value || ""}
              onChange={handlePickerChange}
              tabIndex={-1}
              aria-hidden="true"
              className="absolute inset-y-0 right-0 w-7 cursor-pointer opacity-0"
            />
            <svg
              viewBox="0 0 20 20"
              fill="currentColor"
              className="pointer-events-none absolute right-1.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
            >
              <path
                fillRule="evenodd"
                clipRule="evenodd"
                d="M5.75 2a.75.75 0 0 1 .75.75V4h7V2.75a.75.75 0 0 1 1.5 0V4h.25A2.75 2.75 0 0 1 18 6.75v8.5A2.75 2.75 0 0 1 15.25 18H4.75A2.75 2.75 0 0 1 2 15.25v-8.5A2.75 2.75 0 0 1 4.75 4H5V2.75a.75.75 0 0 1 .75-.75Zm-1 5.5c-.69 0-1.25.56-1.25 1.25v6.5c0 .69.56 1.25 1.25 1.25h10.5c.69 0 1.25-.56 1.25-1.25v-6.5c0-.69-.56-1.25-1.25-1.25H4.75Z"
              />
            </svg>
          </>
        )}
      </div>
      {invalid && (
        <p className="mt-1 text-xs text-red-600">
          Not a valid date — try DD/MM/YYYY, or just type DDMMYYYY.
        </p>
      )}
    </div>
  );
}
