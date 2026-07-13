import { getCompanies, getClients, getDefaultCompany } from "@/lib/records";
import { listRecords, getClientsForCompanyPicker } from "@/lib/recordsAdmin";
import { LIFECYCLE_STYLES, progressLabel, progressStyle } from "@/lib/status";
import { CompanySelect, ClientSelect, SearchBox } from "@/components/MainFilterBar";
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

  const [companies, clients] = await Promise.all([getCompanies(), getClients()]);
  const defaultCompany = params?.company ? null : await getDefaultCompany(companies);
  const compId = params?.company || defaultCompany?.comp_id || "";
  const clientsForCompany = clients.filter((c) => c.comp_id === compId);
  const clientId = params?.client || clientsForCompany[0]?.client_id || "";

  const [records, pickerClients] = await Promise.all([
    listRecords({ compId, clientId, search }),
    getClientsForCompanyPicker(compId),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-gray-900">Records</h1>
        <CompanySelect companies={companies} compId={compId} />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="min-w-0 flex-1">
          <SearchBox search={search} />
        </div>
        <ClientSelect clients={clients} compId={compId} clientId={clientId} />
        <AddRecordButton key={compId} compId={compId} clients={pickerClients} />
      </div>

      <div className="text-sm text-gray-600">{records.length} records</div>

      <div className="max-h-[70vh] overflow-y-auto overflow-x-auto rounded-lg border bg-white">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="sticky top-0 bg-gray-50">
            <tr>
              <th className="px-3 py-2 text-left font-medium text-gray-600">Record ID</th>
              <th className="px-3 py-2 text-left font-medium text-gray-600">Date</th>
              <th className="min-w-[320px] px-3 py-2 text-left font-medium text-gray-600">
                Description
              </th>
              <th className="px-3 py-2 text-right font-medium text-gray-600">Amount</th>
              <th className="px-3 py-2 text-left font-medium text-gray-600">Status</th>
              <th className="px-3 py-2 text-left font-medium text-gray-600">Progress</th>
              <th className="px-3 py-2 text-left font-medium text-gray-600">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {records.map((record) => (
              <tr key={record.record_id}>
                <td className="px-3 py-2 font-mono text-xs text-gray-500">{record.record_id}</td>
                <td className="px-3 py-2 text-gray-700">{formatDate(record.record_date)}</td>
                <td className="px-3 py-2 text-gray-700">{record.description}</td>
                <td className="px-3 py-2 text-right text-gray-700">
                  {formatMoney(record.amount)}
                </td>
                <td className="px-3 py-2">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${LIFECYCLE_STYLES[record.lifecycle]}`}
                  >
                    {record.lifecycle}
                  </span>
                </td>
                <td className="px-3 py-2">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${progressStyle(record)}`}
                  >
                    {progressLabel(record, "Record")}
                  </span>
                </td>
                <td className="px-3 py-2">
                  <div className="flex gap-2">
                    <EditRecordButton record={record} />
                    {!record.est_id && <DeleteRecordButton recordId={record.record_id} />}
                  </div>
                </td>
              </tr>
            ))}
            {records.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-gray-500">
                  No records found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
