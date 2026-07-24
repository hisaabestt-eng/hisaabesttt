import { getCompanies, getClients, getDefaultCompany } from "@/lib/records";
import { listRecords, getClientsForCompanyPicker, getRecordYears } from "@/lib/recordsAdmin";
import { listEstimates, getSuggestedEstNosByClient } from "@/lib/estimatesAdmin";
import { listPOs } from "@/lib/poAdmin";
import { listInvoices } from "@/lib/invoicesAdmin";
import { getStatusLabels } from "@/lib/settingsAdmin";
import { getServerSession } from "@/lib/session";
import { getPermissions } from "@/lib/permissions";
import { RECORD_PROGRESS_OPTIONS } from "@/lib/status";
import { CompanySelect, ClientSelect, SearchBox, ProgressFilter, YearFilter } from "@/components/MainFilterBar";
import { AddRecordButton } from "@/components/RecordModal";
import { RecordsTable } from "@/components/RecordsTable";

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
    suggestedEstNosByClient,
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
    getSuggestedEstNosByClient(compId),
    getServerSession(),
    getPermissions(),
  ]);
  const progressOptions = [...RECORD_PROGRESS_OPTIONS, ...statusLabels.map((l) => l.label_name)];
  const canAdd = session.role === "admin" || permissions.can_add;
  const canEdit = session.role === "admin" || permissions.can_edit;
  const canDelete = session.role === "admin" || permissions.can_delete;

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
        {canAdd && (
          <AddRecordButton
            key={compId}
            compId={compId}
            clients={pickerClients}
            suggestedEstNosByClient={suggestedEstNosByClient}
          />
        )}
      </div>

      <RecordsTable
        records={records}
        allEstimates={allEstimates}
        allPOs={allPOs}
        allInvoices={allInvoices}
        statusLabels={statusLabels}
        estimateStatusLabels={estimateStatusLabels}
        poStatusLabels={poStatusLabels}
        canEdit={canEdit}
        canDelete={canDelete}
        search={search}
        progress={progress}
      />
    </div>
  );
}
