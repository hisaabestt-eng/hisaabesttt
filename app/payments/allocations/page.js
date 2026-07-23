import { getCompanies, getClients, getDefaultCompany } from "@/lib/records";
import { listInvoiceSummaries } from "@/lib/paymentsAdmin";
import { getInvoiceYears } from "@/lib/invoicesAdmin";
import { getServerSession } from "@/lib/session";
import { getPermissions } from "@/lib/permissions";
import { INVOICE_PROGRESS_OPTIONS } from "@/lib/status";
import { CompanySelect, ClientSelect, SearchBox, ProgressFilter, YearFilter } from "@/components/MainFilterBar";
import { PaymentAllocationsTable } from "@/components/PaymentAllocationsTable";

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

      <PaymentAllocationsTable invoices={invoices} canEdit={canEdit} />
    </div>
  );
}
