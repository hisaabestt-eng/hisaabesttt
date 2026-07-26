"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import LogoutButton from "./LogoutButton";
import { ThemeToggle } from "./ThemeToggle";

const BASE_LINKS = [
  { href: "/", label: "Main" },
  { href: "/estimates", label: "Estimates" },
  { href: "/purchase-orders", label: "Purchase Orders" },
  { href: "/invoices", label: "Invoices" },
  { href: "/payments", label: "Payments" },
];

// Settings holds company/client management and the permissions toggle
// itself, so it's only shown (and only reachable — see proxy.js) for admins.
const ADMIN_LINKS = [{ href: "/settings", label: "Settings" }];

// A nav link should also light up on its own nested/dynamic routes, so this
// matches on prefix rather than exact pathname — picking the longest
// matching prefix in case two links' hrefs are ever themselves nested
// inside one another. "/records/RC-0001" (the record detail page) is a
// special case: it's still its own route, but "Records" no longer has a
// top-level link of its own since it moved under the Estimates page's
// Records tab, so it lights up "Estimates" instead.
function findActiveHref(pathname, links) {
  if (pathname.startsWith("/records/")) return "/estimates";
  const matches = links.filter(
    (link) => link.href === "/" ? pathname === "/" : pathname === link.href || pathname.startsWith(`${link.href}/`)
  );
  if (matches.length === 0) return null;
  return matches.reduce((longest, l) => (l.href.length > longest.href.length ? l : longest)).href;
}

export default function NavBar({ session }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const links = session?.role === "admin" ? [...BASE_LINKS, ...ADMIN_LINKS] : BASE_LINKS;
  const activeHref = findActiveHref(pathname, links);

  // Carries the currently selected Company/Client along to whichever page
  // the user clicks next, so it only resets to each page's own default when
  // the site is opened fresh (no params) — not every time they switch pages.
  const carryParams = new URLSearchParams();
  const company = searchParams.get("company");
  const client = searchParams.get("client");
  if (company) carryParams.set("company", company);
  if (client) carryParams.set("client", client);
  const suffix = carryParams.toString() ? `?${carryParams.toString()}` : "";

  return (
    <nav className="border-b border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
      <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-3">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
          <span className="font-semibold tracking-tight text-blue-600 dark:text-blue-400">
            Besttt Hisaab
          </span>
          <div className="flex flex-wrap gap-x-1 gap-y-1 text-sm">
            {links.map((link) => {
              const isActive = link.href === activeHref;
              return (
                <Link
                  key={link.href}
                  href={`${link.href}${suffix}`}
                  className={`rounded-full px-3 py-1.5 transition-colors ${
                    isActive
                      ? "bg-blue-600 text-white"
                      : "text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-700 dark:hover:text-white"
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </div>
        </div>
        <div className="flex items-center gap-3">
          {session && (
            <span className="text-sm text-gray-500 dark:text-gray-400">
              {session.name}{" "}
              <span className="text-xs uppercase tracking-wide">({session.role})</span>
            </span>
          )}
          <ThemeToggle />
          <LogoutButton />
        </div>
      </div>
    </nav>
  );
}
