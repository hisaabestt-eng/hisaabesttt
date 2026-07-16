import { getCompanies, getClients, getDefaultCompany, getRecordsOverview } from "@/lib/records";
import { getEstimateYears } from "@/lib/estimatesAdmin";
import { MAIN_PROGRESS_OPTIONS } from "@/lib/status";
import { CompanySelect, ClientSelect, SearchBox, ProgressFilter, YearFilter } from "@/components/MainFilterBar";
import { RecordSummaryRow } from "@/components/RecordSummaryRow";

function formatMoney(value) {
  if (value === null || value === undefined) return "—";
  return Number(value).toLocaleString("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  });
}

export default async function Home({ searchParams }) {
  const params = await searchParams;
  const search = params?.search || "";
  const progress = params?.progress ? params.progress.split(",") : [];
  const yearType = params?.yearType === "fy" ? "fy" : "calendar";
  const rawYear = params?.year || String(new Date().getFullYear());
  const year = rawYear === "all" ? "" : rawYear;

  const [companies, clients] = await Promise.all([getCompanies(), getClients()]);
  const defaultCompany = params?.company ? null : await getDefaultCompany(companies);

  const compId = params?.company || defaultCompany?.comp_id || "";
  const clientsForCompany = clients.filter((c) => c.comp_id === compId);
  const selectedCompanyObj = companies.find((c) => c.comp_id === compId);
  const defaultClientId = clientsForCompany.find(
    (c) => c.client_id === selectedCompanyObj?.default_client_id
  )?.client_id;
  const clientId = params?.client || defaultClientId || clientsForCompany[0]?.client_id || "";

  const [overview, years] = await Promise.all([
    getRecordsOverview({ compId, clientId, search, progress, year, yearType }),
    getEstimateYears(compId),
  ]);
  const totalAmount = overview.rows.reduce((sum, row) => sum + (Number(row.estimate_amount) || 0), 0);

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Main Page</h1>
        <CompanySelect companies={companies} compId={compId} />
      </div>

      <div className="flex flex-wrap gap-2">
        <div className="min-w-0 flex-1">
          <SearchBox search={search} />
        </div>
        <ClientSelect clients={clients} compId={compId} clientId={clientId} />
        <ProgressFilter options={MAIN_PROGRESS_OPTIONS} selected={progress} />
        <YearFilter years={years} year={rawYear} yearType={yearType} />
      </div>

      <div className="text-sm text-gray-600 dark:text-gray-400">{overview.total} records</div>

      <div className="max-h-[70vh] overflow-y-auto overflow-x-auto rounded-lg border border-gray-100 dark:border-gray-700">
        <table className="min-w-full divide-y divide-gray-100 text-sm dark:divide-gray-700">
          <thead className="sticky top-0 bg-gray-50 dark:bg-gray-900/40">
            <tr>
              <th className="px-3 py-3 text-left font-medium text-gray-600 dark:text-gray-400">Date</th>
              <th className="min-w-[320px] px-3 py-3 text-left font-medium text-gray-600 dark:text-gray-400">
                Description
              </th>
              <th className="px-3 py-3 text-right font-medium text-gray-600 dark:text-gray-400">Amount</th>
              <th className="w-40 px-3 py-3 text-center font-medium text-gray-600 dark:text-gray-400">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {overview.rows.map((row) => (
              <RecordSummaryRow key={row.record_id} row={row} />
            ))}
            {overview.rows.length === 0 && (
              <tr>
                <td colSpan={4} className="px-3 py-6 text-center text-gray-500 dark:text-gray-400">
                  No records found.
                </td>
              </tr>
            )}
          </tbody>
          {overview.rows.length > 0 && (
            <tfoot className="sticky bottom-0 border-t-2 border-gray-200 bg-gray-50 font-medium dark:border-gray-700 dark:bg-gray-900/40">
              <tr>
                <td colSpan={2} className="px-3 py-3 text-right text-gray-700 dark:text-gray-300">
                  Total
                </td>
                <td className="px-3 py-3 text-right text-gray-900 dark:text-gray-100">{formatMoney(totalAmount)}</td>
                <td></td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
