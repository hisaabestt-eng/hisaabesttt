import { getCompanies, getClients, getDefaultCompany } from "@/lib/records";
import { listInvoiceAllocations } from "@/lib/paymentsAdmin";
import { progressLabel, progressStyle } from "@/lib/status";
import { CompanySelect, ClientSelect, SearchBox } from "@/components/MainFilterBar";

function formatMoney(value) {
  if (value === null || value === undefined) return "—";
  return Number(value).toLocaleString("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  });
}

function formatDate(value) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default async function PaymentAllocationsPage({ searchParams }) {
  const params = await searchParams;
  const search = params?.search || "";

  const [companies, clients] = await Promise.all([getCompanies(), getClients()]);
  const defaultCompany = params?.company ? null : await getDefaultCompany(companies);
  const compId = params?.company || defaultCompany?.comp_id || "";
  const clientsForCompany = clients.filter((c) => c.comp_id === compId);
  const clientId = params?.client || clientsForCompany[0]?.client_id || "";

  const allocations = await listInvoiceAllocations({ compId, clientId, search });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-gray-900">Payment Allocations</h1>
        <CompanySelect companies={companies} compId={compId} />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="min-w-0 flex-1">
          <SearchBox search={search} />
        </div>
        <ClientSelect clients={clients} compId={compId} clientId={clientId} />
      </div>

      <div className="text-sm text-gray-600">{allocations.length} invoice allocations</div>

      <div className="max-h-[70vh] overflow-y-auto overflow-x-auto rounded-lg border bg-white">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="sticky top-0 bg-gray-50">
            <tr>
              <th className="px-3 py-2 text-left font-medium text-gray-600">Invoice No</th>
              <th className="px-3 py-2 text-right font-medium text-gray-600">Invoice Amount</th>
              <th className="px-3 py-2 text-right font-medium text-gray-600">Allocated Amount</th>
              <th className="px-3 py-2 text-right font-medium text-gray-600">Balance Amount</th>
              <th className="px-3 py-2 text-left font-medium text-gray-600">Allocated Date</th>
              <th className="px-3 py-2 text-left font-medium text-gray-600">Progress</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {allocations.map((a) => (
              <tr key={`${a.py_id}-${a.invoice_no}`}>
                <td className="px-3 py-2 text-gray-700">{a.invoice_no}</td>
                <td className="px-3 py-2 text-right text-gray-700">{formatMoney(a.invoice_total)}</td>
                <td className="px-3 py-2 text-right text-gray-700">{formatMoney(a.amount)}</td>
                <td className="px-3 py-2 text-right text-gray-700">
                  {formatMoney(a.invoice_balance)}
                </td>
                <td className="px-3 py-2 text-gray-700">{formatDate(a.allocated_at)}</td>
                <td className="px-3 py-2">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${progressStyle(a)}`}>
                    {progressLabel(a, "Invoice")}
                  </span>
                </td>
              </tr>
            ))}
            {allocations.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-gray-500">
                  No invoice allocations found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
