import Link from "next/link";

const LINKS = [
  { href: "/", label: "Main" },
  { href: "/records", label: "Records" },
  { href: "/estimates", label: "Estimates" },
  { href: "/purchase-orders", label: "Purchase Orders" },
  { href: "/invoices", label: "Invoices" },
  { href: "/payments", label: "Payments" },
  { href: "/payments/allocations", label: "Payment Allocations" },
];

export default function NavBar() {
  return (
    <nav className="border-b bg-white">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
        <span className="font-semibold text-gray-900">Agency Tracker</span>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
          {LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-gray-600 hover:text-gray-900"
            >
              {link.label}
            </Link>
          ))}
        </div>
      </div>
    </nav>
  );
}
