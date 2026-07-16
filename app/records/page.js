import { getCompanies, getClients, getDefaultCompany } from "@/lib/records";
import { listRecords, getClientsForCompanyPicker, getRecordYears } from "@/lib/recordsAdmin";
import { getStatusLabels } from "@/lib/settingsAdmin";
import { getServerSession } from "@/lib/session";
import { getPermissions } from "@/lib/permissions";
import { progressLabel, progressStyle, lifecycleDisplay, RECORD_PROGRESS_OPTIONS } from "@/lib/status";
import { CompanySelect, ClientSelect, SearchBox, ProgressFilter, YearFilter } from "@/components/MainFilterBar";
import { AddRecordButton, EditRecordButton, DeleteRecordButton } from "@/components/RecordModal";

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

export default async function RecordsPage({ searchParams }) {
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

  const [records, pickerClients, statusLabels, session, permissions, years] = await Promise.all([
    listRecords({ compId, clientId, search, progress, year, yearType }),
    getClientsForCompanyPicker(compId),
    getStatusLabels("record"),
    getServerSession(),
    getPermissions(),
    getRecordYears(compId),
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
              <th className="px-3 py-3 text-center font-medium text-gray-600 dark:text-gray-400">Progress</th>
              <th className="px-3 py-3 text-left font-medium text-gray-600 dark:text-gray-400">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {records.map((record) => (
              <tr key={record.record_id} className="hover:bg-gray-50">
                <td className="px-3 py-3 font-mono text-xs text-gray-500 dark:text-gray-400">
                  {record.record_id}
                </td>
                <td className="px-3 py-3 text-gray-700 dark:text-gray-300">{formatDate(record.record_date)}</td>
                <td className="px-3 py-3 text-gray-700 dark:text-gray-300">{record.description}</td>
                <td className="px-3 py-3 text-right text-gray-700 dark:text-gray-300">
                  {formatMoney(record.amount)}
                </td>
                <td className="px-3 py-3 text-center">
                  <span
                    className={`inline-flex min-w-[120px] items-center justify-center whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${lifecycleDisplay(record).style}`}
                  >
                    {lifecycleDisplay(record).label}
                  </span>
                </td>
                <td className="px-3 py-3 text-center">
                  <span
                    className={`inline-flex min-w-[120px] items-center justify-center whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${progressStyle(record)}`}
                  >
                    {progressLabel(record, "Record")}
                  </span>
                  {record.status === "Scheduled" && record.scheduled_payment_date && (
                    <div className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                      {formatDate(record.scheduled_payment_date)}
                    </div>
                  )}
                </td>
                <td className="px-3 py-3">
                  <div className="flex gap-2">
                    {canEdit && <EditRecordButton record={record} statusLabels={statusLabels} />}
                    {canDelete && !record.est_id && <DeleteRecordButton recordId={record.record_id} />}
                  </div>
                </td>
              </tr>
            ))}
            {records.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-gray-500 dark:text-gray-400">
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
                <td colSpan={3}></td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
