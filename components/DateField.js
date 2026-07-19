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
export function DateField({ value, onChange, required, className = "", id }) {
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

  return (
    <div>
      <input
        id={id}
        type="text"
        inputMode="numeric"
        placeholder="DD/MM/YYYY"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={handleBlur}
        required={required}
        className={`${className} ${invalid ? "border-red-400" : ""}`}
      />
      {invalid && (
        <p className="mt-1 text-xs text-red-600">
          Not a valid date — try DD/MM/YYYY, or just type DDMMYYYY.
        </p>
      )}
    </div>
  );
}
