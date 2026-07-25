import { getCompanies, getClients, getDefaultCompany, getRecordsOverview } from "@/lib/records";
import { getEstimateYears } from "@/lib/estimatesAdmin";
import { MAIN_PROGRESS_OPTIONS } from "@/lib/status";
import {
  CompanySelect,
  ClientSelect,
  SearchBox,
  ProgressFilter,
  YearFilter,
  ClearFiltersButton,
} from "@/components/MainFilterBar";
import { MainTable } from "@/components/MainTable";

export default async function Home({ searchParams }) {
  const params = await searchParams;
  const search = params?.search || "";
  const progress = params?.progress ? params.progress.split(",") : [];
  const yearType = params?.yearType === "fy" ? "fy" : params?.yearType === "custom" ? "custom" : "calendar";
  const from = params?.from || "";
  const to = params?.to || "";

  const [companies, clients] = await Promise.all([getCompanies(), getClients()]);
  const defaultCompany = params?.company ? null : await getDefaultCompany(companies);

  const compId = params?.company || defaultCompany?.comp_id || "";
  const clientsForCompany = clients.filter((c) => c.comp_id === compId);
  const selectedCompanyObj = companies.find((c) => c.comp_id === compId);
  const defaultClientId = clientsForCompany.find(
    (c) => c.client_id === selectedCompanyObj?.default_client_id
  )?.client_id;
  const clientId = params?.client || defaultClientId || clientsForCompany[0]?.client_id || "";

  const years = await getEstimateYears(compId);
  // Defaulting to the current year hides everything for a company whose
  // data is all from a past year — only do it when the current year
  // actually has data; otherwise show everything (matches what the Year
  // dropdown displays when nothing has been explicitly chosen).
  const currentYear = new Date().getFullYear();
  const rawYear = params?.year || (years.includes(currentYear) ? String(currentYear) : "all");
  const year = rawYear === "all" ? "" : rawYear;

  const overview = await getRecordsOverview({ compId, clientId, search, progress, year, yearType, from, to });

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Main Page</h1>
        <CompanySelect companies={companies} compId={compId} />
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="min-w-0 flex-1">
            <SearchBox key={search} search={search} />
          </div>
          <ClientSelect clients={clients} compId={compId} clientId={clientId} />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <ProgressFilter options={MAIN_PROGRESS_OPTIONS} selected={progress} />
          <YearFilter years={years} year={rawYear} yearType={yearType} from={from} to={to} />
          <ClearFiltersButton />
        </div>
      </div>

      <MainTable rows={overview.rows} totalCount={overview.total} search={search} progress={progress} />
    </div>
  );
}
