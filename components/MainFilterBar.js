"use client";

import { useRouter, usePathname } from "next/navigation";
import { useRef, useState, useEffect } from "react";

export function CompanySelect({ companies, compId }) {
  const router = useRouter();
  const pathname = usePathname();

  function handleChange(e) {
    const params = new URLSearchParams(window.location.search);
    params.set("company", e.target.value);
    params.delete("client");
    params.delete("page");
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <select
      value={compId}
      onChange={handleChange}
      className="rounded-md border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 px-2 py-1.5 text-sm"
    >
      {companies.map((c) => (
        <option key={c.comp_id} value={c.comp_id}>
          {c.company_name}
          {c.status && c.status !== "Active" ? " (Inactive)" : ""}
        </option>
      ))}
    </select>
  );
}

export function ClientSelect({ clients, compId, clientId }) {
  const router = useRouter();
  const pathname = usePathname();

  const visibleClients = clients.filter((c) => c.comp_id === compId);

  function handleChange(e) {
    const params = new URLSearchParams(window.location.search);
    params.set("client", e.target.value);
    params.delete("page");
    router.push(`${pathname}?${params.toString()}`);
  }

  if (visibleClients.length === 0) {
    return <span className="text-sm text-gray-400">No clients yet for this company</span>;
  }

  return (
    <select
      value={clientId}
      onChange={handleChange}
      className="rounded-md border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 px-2 py-1.5 text-sm"
    >
      {visibleClients.map((c) => (
        <option key={c.client_id} value={c.client_id}>
          {c.client_name}
          {c.status && c.status !== "Active" ? " (Inactive)" : ""}
        </option>
      ))}
    </select>
  );
}

// Calendar-year or financial-year (Apr–Mar) filter, used by the Detailed
// Invoices report so GST/TDS can be reviewed one tax period at a time.
export function YearFilter({ years, year, yearType }) {
  const router = useRouter();
  const pathname = usePathname();
  const effectiveType = yearType === "fy" ? "fy" : "calendar";

  function handleTypeChange(e) {
    const params = new URLSearchParams(window.location.search);
    params.set("yearType", e.target.value);
    params.delete("page");
    router.push(`${pathname}?${params.toString()}`);
  }

  // Always writes the param (never deletes it) — including "all" — so a
  // page reload can tell "user explicitly chose All years" apart from
  // "no choice made yet" (which defaults to the current year instead).
  function handleYearChange(e) {
    const params = new URLSearchParams(window.location.search);
    params.set("year", e.target.value);
    params.delete("page");
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="flex items-center gap-2">
      <select
        value={effectiveType}
        onChange={handleTypeChange}
        className="rounded-md border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 px-2 py-1.5 text-sm"
      >
        <option value="calendar">Calendar Year</option>
        <option value="fy">Financial Year (Apr–Mar)</option>
      </select>
      <select
        value={year || "all"}
        onChange={handleYearChange}
        className="rounded-md border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 px-2 py-1.5 text-sm"
      >
        <option value="all">All years</option>
        {years.map((y) => (
          <option key={y} value={y}>
            {effectiveType === "fy" ? `FY ${y}-${String(y + 1).slice(-2)}` : y}
          </option>
        ))}
      </select>
    </div>
  );
}

// Lets the Detailed Invoices report jump straight to just Archived or just
// Cancelled invoices — free-text search alone can't reliably do this since
// legacy data has the "Cancled" typo instead of "Cancelled".
export function LifecycleFilter({ lifecycle }) {
  const router = useRouter();
  const pathname = usePathname();

  function handleChange(e) {
    const params = new URLSearchParams(window.location.search);
    if (e.target.value) params.set("lifecycle", e.target.value);
    else params.delete("lifecycle");
    params.delete("page");
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <select
      value={lifecycle || ""}
      onChange={handleChange}
      className="rounded-md border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 px-2 py-1.5 text-sm"
    >
      <option value="">All statuses</option>
      <option value="Raised">Raised only</option>
      <option value="Archived">Archived only</option>
      <option value="Cancelled">Cancelled only</option>
    </select>
  );
}

// Checkbox dropdown for picking several Progress values at once (e.g. "Paid"
// + "Partial Paid" together) — stored as one comma-joined `?progress=` param
// rather than the single-value pattern the other filters here use.
export function ProgressFilter({ options, selected }) {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function toggleValue(value) {
    const next = selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value];
    const params = new URLSearchParams(window.location.search);
    if (next.length > 0) params.set("progress", next.join(","));
    else params.delete("progress");
    params.delete("page");
    router.push(`${pathname}?${params.toString()}`);
  }

  function clearAll() {
    const params = new URLSearchParams(window.location.search);
    params.delete("progress");
    params.delete("page");
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="rounded-md border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 px-2.5 py-1.5 text-sm text-gray-700 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-600"
      >
        Progress{selected.length > 0 ? ` (${selected.length})` : ""}
      </button>

      {open && (
        <div className="absolute z-20 mt-1 max-h-72 w-60 overflow-y-auto rounded-md border border-gray-200 bg-white p-2 shadow-lg dark:border-gray-700 dark:bg-gray-800">
          {options.map((opt) => (
            <label
              key={opt}
              className="flex items-center gap-2 rounded px-2 py-1 text-sm text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-700"
            >
              <input type="checkbox" checked={selected.includes(opt)} onChange={() => toggleValue(opt)} />
              {opt}
            </label>
          ))}
          {selected.length > 0 && (
            <button
              type="button"
              onClick={clearAll}
              className="mt-1 w-full rounded px-2 py-1 text-left text-xs text-blue-600 hover:bg-gray-50 dark:text-blue-400 dark:hover:bg-gray-700"
            >
              Clear all
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export function SearchBox({ search }) {
  const router = useRouter();
  const pathname = usePathname();
  const timerRef = useRef(null);

  function handleChange(e) {
    const value = e.target.value;
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      const params = new URLSearchParams(window.location.search);
      if (value) params.set("search", value);
      else params.delete("search");
      params.delete("page");
      router.push(`${pathname}?${params.toString()}`);
    }, 300);
  }

  return (
    <input
      type="text"
      defaultValue={search}
      onChange={handleChange}
      placeholder="Search"
      className="w-full rounded-md border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 px-2 py-1.5 text-sm"
    />
  );
}
