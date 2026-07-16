import { getCompanies, getClients, getDefaultCompany } from "@/lib/records";
import { listInvoiceSummaries } from "@/lib/paymentsAdmin";
import { getInvoiceYears } from "@/lib/invoicesAdmin";
import { getServerSession } from "@/lib/session";
import { getPermissions } from "@/lib/permissions";
import { INVOICE_PROGRESS_OPTIONS } from "@/lib/status";
import { CompanySelect, ClientSelect, SearchBox, ProgressFilter, YearFilter } from "@/components/MainFilterBar";
import { InvoiceSummaryRow } from "@/components/InvoiceSummaryRow";

function formatMoney(value) {
  if (value === null || value === undefined) return "—";
  return Number(value).toLocaleString("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  });
}

export default async function PaymentAllocationsPage({ searchParams }) {
  const params = await searchParams;
  const search = params?.search || "";
  const progress = params?.progress ? params.progress.split(",") : [];
  const yearType = params?.yearType === "fy" ? "fy" : "calendar";

  const [companies, clients] = await Promise.all([getCompanies(), getClients()]);
  const defaultCompany = params?.company ? null : await getDefaultCompany(companies);
  const compId = params?.company || defaultCompany?.comp_id || "";
  const clientsForCompany = clients.filter((c) => c.comp_id === compId);
  const selectedCompanyObj = companies.find((c) => c.comp_id === compId);
  const defaultClientId = clientsForCompany.find(
    (c) => c.client_id === selectedCompanyObj?.default_client_id
  )?.client_id;
  const clientId = params?.client || defaultClientId || clientsForCompany[0]?.client_id || "";

  const years = await getInvoiceYears(compId);
  // Defaulting to the current year hides everything for a company whose
  // data is all from a past year — only do it when the current year
  // actually has data; otherwise show everything (matches what the Year
  // dropdown displays when nothing has been explicitly chosen).
  const currentYear = new Date().getFullYear();
  const rawYear = params?.year || (years.includes(currentYear) ? String(currentYear) : "all");
  const year = rawYear === "all" ? "" : rawYear;

  const [invoices, session, permissions] = await Promise.all([
    listInvoiceSummaries({ compId, clientId, search, progress, year, yearType }),
    getServerSession(),
    getPermissions(),
  ]);
  const canEdit = session.role === "admin" || permissions.can_edit;

  const totals = invoices.reduce(
    (acc, inv) => {
      if (inv.lifecycle !== "Raised") return acc;
      acc.amount += Number(inv.invoice_total) || 0;
      acc.received += Number(inv.total_received) || 0;
      acc.balance += Number(inv.balance_due) || 0;
      return acc;
    },
    { amount: 0, received: 0, balance: 0 }
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Payment Allocations</h1>
        <CompanySelect companies={companies} compId={compId} />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="min-w-0 flex-1">
          <SearchBox search={search} />
        </div>
        <ClientSelect clients={clients} compId={compId} clientId={clientId} />
        <ProgressFilter options={INVOICE_PROGRESS_OPTIONS} selected={progress} />
        <YearFilter years={years} year={rawYear} yearType={yearType} />
      </div>

      <div className="text-sm text-gray-600 dark:text-gray-400">
        {invoices.length} invoices — click a row to see its payment history
      </div>

      <div className="max-h-[70vh] overflow-y-auto overflow-x-auto rounded-lg border border-gray-100 dark:border-gray-700">
        <table className="min-w-full divide-y divide-gray-100 text-sm dark:divide-gray-700">
          <thead className="sticky top-0 bg-gray-50 dark:bg-gray-900/40">
            <tr>
              <th className="px-3 py-3 text-left font-medium text-gray-600 dark:text-gray-400">Invoice No</th>
              <th className="px-3 py-3 text-right font-medium text-gray-600 dark:text-gray-400">Invoice Amount</th>
              <th className="px-3 py-3 text-right font-medium text-gray-600 dark:text-gray-400">Total Received</th>
              <th className="px-3 py-3 text-right font-medium text-gray-600 dark:text-gray-400">Balance Due</th>
              <th className="px-3 py-3 text-center font-medium text-gray-600 dark:text-gray-400">Payment Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {invoices.map((inv) => (
              <InvoiceSummaryRow key={inv.inv_id} invoice={inv} canEdit={canEdit} />
            ))}
            {invoices.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-gray-500 dark:text-gray-400">
                  No invoices found.
                </td>
              </tr>
            )}
          </tbody>
          {invoices.length > 0 && (
            <tfoot className="sticky bottom-0 border-t-2 border-gray-200 bg-gray-50 font-medium dark:border-gray-700 dark:bg-gray-900/40">
              <tr>
                <td className="px-3 py-3 text-right text-gray-700 dark:text-gray-300">Total (Raised only)</td>
                <td className="px-3 py-3 text-right text-gray-900 dark:text-gray-100">{formatMoney(totals.amount)}</td>
                <td className="px-3 py-3 text-right text-gray-900 dark:text-gray-100">{formatMoney(totals.received)}</td>
                <td className="px-3 py-3 text-right text-gray-900 dark:text-gray-100">{formatMoney(totals.balance)}</td>
                <td></td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
