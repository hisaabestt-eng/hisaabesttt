import { getCompanies, getClients, getDefaultCompany } from "@/lib/records";
import { listRecords, getClientsForCompanyPicker, getRecordYears } from "@/lib/recordsAdmin";
import { listEstimates } from "@/lib/estimatesAdmin";
import { listPOs } from "@/lib/poAdmin";
import { listInvoices } from "@/lib/invoicesAdmin";
import { getStatusLabels } from "@/lib/settingsAdmin";
import { getServerSession } from "@/lib/session";
import { getPermissions } from "@/lib/permissions";
import { RECORD_PROGRESS_OPTIONS } from "@/lib/status";
import { CompanySelect, ClientSelect, SearchBox, ProgressFilter, YearFilter } from "@/components/MainFilterBar";
import { AddRecordButton } from "@/components/RecordModal";
import { RecordRow } from "@/components/RecordRow";

function formatMoney(value) {
  if (value === null || value === undefined) return "—";
  return Number(value).toLocaleString("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  });
}

export default async function RecordsPage({ searchParams }) {
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

  const years = await getRecordYears(compId);
  // Defaulting to the current year hides everything for a company whose
  // data is all from a past year — only do it when the current year
  // actually has data; otherwise show everything (matches what the Year
  // dropdown displays when nothing has been explicitly chosen).
  const currentYear = new Date().getFullYear();
  const rawYear = params?.year || (years.includes(currentYear) ? String(currentYear) : "all");
  const year = rawYear === "all" ? "" : rawYear;

  const NO_FILTER = { search: "", progress: [], year: "", yearType: "calendar" };
  const [
    records,
    pickerClients,
    statusLabels,
    estimateStatusLabels,
    poStatusLabels,
    allEstimates,
    allPOs,
    allInvoices,
    session,
    permissions,
  ] = await Promise.all([
    listRecords({ compId, clientId, search, progress, year, yearType }),
    getClientsForCompanyPicker(compId),
    getStatusLabels("record"),
    getStatusLabels("estimate"),
    getStatusLabels("po"),
    listEstimates({ compId, clientId: "", ...NO_FILTER }),
    listPOs({ compId, clientId: "", ...NO_FILTER }),
    listInvoices({ compId, clientId: "", ...NO_FILTER }),
    getServerSession(),
    getPermissions(),
  ]);
  const progressOptions = [...RECORD_PROGRESS_OPTIONS, ...statusLabels.map((l) => l.label_name)];
  const canAdd = session.role === "admin" || permissions.can_add;
  const canEdit = session.role === "admin" || permissions.can_edit;
  const canDelete = session.role === "admin" || permissions.can_delete;

  // Archived/Cancelled records don't represent real outstanding work, so
  // they're excluded from the subtotal — same convention as Detailed Invoices.
  const totalAmount = records.reduce(
    (sum, record) => (record.lifecycle === "Raised" ? sum + (Number(record.amount) || 0) : sum),
    0
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Records</h1>
        <CompanySelect companies={companies} compId={compId} />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="min-w-0 flex-1">
          <SearchBox search={search} />
        </div>
        <ClientSelect clients={clients} compId={compId} clientId={clientId} />
        <ProgressFilter options={progressOptions} selected={progress} />
        <YearFilter years={years} year={rawYear} yearType={yearType} />
        {canAdd && <AddRecordButton key={compId} compId={compId} clients={pickerClients} />}
      </div>

      <div className="text-sm text-gray-600 dark:text-gray-400">{records.length} records</div>

      <div className="max-h-[70vh] overflow-y-auto overflow-x-auto rounded-lg border border-gray-100 dark:border-gray-700">
        <table className="min-w-full divide-y divide-gray-100 text-sm dark:divide-gray-700">
          <thead className="sticky top-0 bg-gray-50 dark:bg-gray-900/40">
            <tr>
              <th className="px-3 py-3 text-left font-medium text-gray-600 dark:text-gray-400">Record ID</th>
              <th className="px-3 py-3 text-left font-medium text-gray-600 dark:text-gray-400">Date</th>
              <th className="min-w-[320px] px-3 py-3 text-left font-medium text-gray-600 dark:text-gray-400">
                Description
              </th>
              <th className="px-3 py-3 text-right font-medium text-gray-600 dark:text-gray-400">Amount</th>
              <th className="px-3 py-3 text-center font-medium text-gray-600 dark:text-gray-400">Status</th>
              <th className="px-3 py-3 text-left font-medium text-gray-600 dark:text-gray-400">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {records.map((record) => {
              const estimate = record.est_id ? allEstimates.find((e) => e.est_id === record.est_id) : null;
              const po = record.po_id ? allPOs.find((p) => p.po_id === record.po_id) : null;
              const invoices = po
                ? allInvoices.filter((inv) => inv.po_no === po.po_no)
                : estimate
                  ? allInvoices.filter((inv) => inv.est_id === estimate.est_id)
                  : [];
              return (
                <RecordRow
                  key={record.record_id}
                  record={record}
                  estimate={estimate}
                  po={po}
                  invoices={invoices}
                  statusLabels={statusLabels}
                  estimateStatusLabels={estimateStatusLabels}
                  poStatusLabels={poStatusLabels}
                  canEdit={canEdit}
                  canDelete={canDelete}
                />
              );
            })}
            {records.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-gray-500 dark:text-gray-400">
                  No records found.
                </td>
              </tr>
            )}
          </tbody>
          {records.length > 0 && (
            <tfoot className="sticky bottom-0 border-t-2 border-gray-200 bg-gray-50 font-medium dark:border-gray-700 dark:bg-gray-900/40">
              <tr>
                <td colSpan={3} className="px-3 py-3 text-right text-gray-700 dark:text-gray-300">
                  Total (Raised only)
                </td>
                <td className="px-3 py-3 text-right text-gray-900 dark:text-gray-100">
                  {formatMoney(totalAmount)}
                </td>
                <td colSpan={2}></td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
