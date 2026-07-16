"use client";

import { useRouter, usePathname } from "next/navigation";

const TABS = [
  { key: "companies", label: "Companies" },
  { key: "clients", label: "Clients" },
  { key: "labels", label: "Status Labels" },
  { key: "bulk", label: "Bulk Upload" },
  { key: "permissions", label: "Permissions" },
  { key: "users", label: "Users" },
  { key: "activity", label: "Activity Log" },
];

export function SettingsTabs({ active }) {
  const router = useRouter();
  const pathname = usePathname();

  function handleClick(tab) {
    const params = new URLSearchParams(window.location.search);
    params.set("tab", tab);
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="flex flex-wrap gap-1 border-b border-gray-200 pb-3 dark:border-gray-700">
      {TABS.map((t) => (
        <button
          key={t.key}
          type="button"
          onClick={() => handleClick(t.key)}
          className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
            active === t.key
              ? "bg-blue-600 text-white"
              : "text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
