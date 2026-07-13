"use client";

import { useRouter, usePathname } from "next/navigation";
import { useRef } from "react";

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
      className="rounded border-gray-300 px-2 py-1.5 text-sm"
    >
      {companies.map((c) => (
        <option key={c.comp_id} value={c.comp_id}>
          {c.company_name}
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
      className="rounded border-gray-300 px-2 py-1.5 text-sm"
    >
      {visibleClients.map((c) => (
        <option key={c.client_id} value={c.client_id}>
          {c.client_name}
        </option>
      ))}
    </select>
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
      placeholder="Search client, description, status, est/PO no... (multiple words allowed)"
      className="w-full rounded border-gray-300 px-2 py-1.5 text-sm"
    />
  );
}
