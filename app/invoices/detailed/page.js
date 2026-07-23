import { getCompanies, getClients, getDefaultCompany } from "@/lib/records";
import { getDetailedInvoices, getInvoiceYears } from "@/lib/invoicesAdmin";
import {
  CompanySelect,
  ClientSelect,
  SearchBox,
  YearFilter,
  LifecycleFilter,
} from "@/components/MainFilterBar";
import { DetailedInvoicesTable } from "@/components/DetailedInvoicesTable";

export default async function DetailedInvoicesPage({ searchParams }) {
  const params = await searchParams;
  const search = params?.search || "";
  const yearType = params?.yearType === "fy" ? "fy" : "calendar";
  const lifecycle = params?.lifecycle || "";

  const [companies, clients] = await Promise.all([getCompanies(), getClients()]);
  const defaultCompany = params?.company ? null : await getDefaultCompany(companies);
  const compId = params?.company || defaultCompany?.comp_id || "";
  const clientId = params?.client || "";

  const years = await getInvoiceYears(compId);
  // Defaulting to the current year hides everything for a company whose
  // data is all from a past year — only do it when the current year
  // actually has data; otherwise show everything (matches what the Year
  // dropdown displays when nothing has been explicitly chosen).
  const currentYear = new Date().getFullYear();
  const rawYear = params?.year || (years.includes(currentYear) ? String(currentYear) : "all");
  const year = rawYear === "all" ? "" : rawYear;

  const invoices = await getDetailedInvoices({ compId, clientId, search, year, yearType, lifecycle });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Detailed Invoices</h1>
        <CompanySelect companies={companies} compId={compId} />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="min-w-0 flex-1">
          <SearchBox search={search} />
        </div>
        <ClientSelect clients={[{ client_id: "", client_name: "All clients", comp_id: compId }, ...clients]} compId={compId} clientId={clientId} />
        <LifecycleFilter lifecycle={lifecycle} />
        <YearFilter years={years} year={rawYear} yearType={yearType} />
      </div>

      <DetailedInvoicesTable invoices={invoices} clientId={clientId} />
    </div>
  );
}
