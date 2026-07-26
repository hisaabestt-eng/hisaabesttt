import { existsSync } from "fs";
import path from "path";
import { getCompanies, getClients, getDefaultCompany } from "@/lib/records";
import { listEstimates, getEstimateYears, getSuggestedEstNosByClient } from "@/lib/estimatesAdmin";
import { listRecords, getRecordsWithoutEstimate, getClientsForCompanyPicker, getRecordYears } from "@/lib/recordsAdmin";
import { listPOs } from "@/lib/poAdmin";
import { listInvoices } from "@/lib/invoicesAdmin";
import { getStatusLabels } from "@/lib/settingsAdmin";
import { getServerSession } from "@/lib/session";
import { getPermissions } from "@/lib/permissions";
import { ESTIMATE_PROGRESS_OPTIONS, RECORD_PROGRESS_OPTIONS } from "@/lib/status";
import {
  CompanySelect,
  ClientSelect,
  SearchBox,
  ProgressFilter,
  YearFilter,
  ClearFiltersButton,
} from "@/components/MainFilterBar";
import { AddEstimateButton } from "@/components/EstimateModal";
import { AddRecordButton } from "@/components/RecordModal";
import { EstimatesTable } from "@/components/EstimatesTable";
import { RecordsTable } from "@/components/RecordsTable";
import { RecordsEstimatesTabs } from "@/components/RecordsEstimatesTabs";

// Uploaded files are stored on disk as "<est_id>-<original name>". Old seed
// data has document *rows* with no real file behind them (upload wasn't
// implemented yet when they were created) — only link to ones that exist.
function storedFileName(estId, fileName) {
  return `${estId}-${fileName}`;
}

function documentFileExists(estId, fileName) {
  if (!fileName) return false;
  return existsSync(
    path.join(process.cwd(), "public", "uploads", "estimates", storedFileName(estId, fileName))
  );
}

const TAB_KEYS = ["estimates", "records"];

export default async function EstimatesPage({ searchParams }) {
  const params = await searchParams;
  const search = params?.search || "";
  const progress = params?.progress ? params.progress.split(",") : [];
  const yearType = params?.yearType === "fy" ? "fy" : params?.yearType === "custom" ? "custom" : "calendar";
  const tab = TAB_KEYS.includes(params?.tab) ? params.tab : "records";
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

  // Each tab has its own underlying data (estimates vs. records), so its own
  // list of years with data — used for both the Year dropdown itself and the
  // "does the current year actually have data" default-year check below.
  const years = await (tab === "records" ? getRecordYears(compId) : getEstimateYears(compId));
  const currentYear = new Date().getFullYear();
  const rawYear = params?.year || (years.includes(currentYear) ? String(currentYear) : "all");
  const year = rawYear === "all" ? "" : rawYear;

  const NO_FILTER = { search: "", progress: [], year: "", yearType: "calendar" };
  const [
    estimates,
    records,
    recordsWithoutEstimate,
    pickerClients,
    recordStatusLabels,
    estimateStatusLabels,
    poStatusLabels,
    allPOs,
    allInvoices,
    allEstimates,
    suggestedEstNosByClient,
    session,
    permissions,
  ] = await Promise.all([
    listEstimates({ compId, clientId, search, progress, year, yearType, from, to }),
    listRecords({ compId, clientId, search, progress, year, yearType, from, to }),
    getRecordsWithoutEstimate(compId, clientId),
    getClientsForCompanyPicker(compId),
    getStatusLabels("record"),
    getStatusLabels("estimate"),
    getStatusLabels("po"),
    listPOs({ compId, clientId: "", ...NO_FILTER }),
    listInvoices({ compId, clientId: "", ...NO_FILTER }),
    listEstimates({ compId, clientId: "", ...NO_FILTER }),
    getSuggestedEstNosByClient(compId),
    getServerSession(),
    getPermissions(),
  ]);
  const estimateProgressOptions = [...ESTIMATE_PROGRESS_OPTIONS, ...estimateStatusLabels.map((l) => l.label_name)];
  const recordProgressOptions = [...RECORD_PROGRESS_OPTIONS, ...recordStatusLabels.map((l) => l.label_name)];
  const canAdd = session.role === "admin" || permissions.can_add;
  const canEdit = session.role === "admin" || permissions.can_edit;
  const canDelete = session.role === "admin" || permissions.can_delete;

  const estimatesWithDocFlag = estimates.map((est) => ({
    ...est,
    docFileExists: est.doc_id ? documentFileExists(est.est_id, est.file_name) : false,
  }));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Estimates</h1>
        <CompanySelect companies={companies} compId={compId} />
      </div>

      <RecordsEstimatesTabs active={tab} />

      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="min-w-0 flex-1">
            <SearchBox key={search} search={search} />
          </div>
          <ClientSelect clients={clients} compId={compId} clientId={clientId} />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <ProgressFilter
            options={tab === "records" ? recordProgressOptions : estimateProgressOptions}
            selected={progress}
          />
          <YearFilter years={years} year={rawYear} yearType={yearType} from={from} to={to} />
          <ClearFiltersButton />
          {canAdd && (
            <div className="ml-auto">
              {tab === "records" ? (
                <AddRecordButton
                  key={compId}
                  compId={compId}
                  clients={pickerClients}
                  suggestedEstNosByClient={suggestedEstNosByClient}
                />
              ) : (
                <AddEstimateButton
                  key={`${compId}-${clientId}`}
                  compId={compId}
                  recordsWithoutEstimate={recordsWithoutEstimate}
                  suggestedEstNosByClient={suggestedEstNosByClient}
                />
              )}
            </div>
          )}
        </div>
      </div>

      {tab === "records" ? (
        <RecordsTable
          records={records}
          allEstimates={allEstimates}
          allPOs={allPOs}
          allInvoices={allInvoices}
          statusLabels={recordStatusLabels}
          estimateStatusLabels={estimateStatusLabels}
          poStatusLabels={poStatusLabels}
          canEdit={canEdit}
          canDelete={canDelete}
          search={search}
          progress={progress}
        />
      ) : (
        <EstimatesTable
          estimates={estimatesWithDocFlag}
          allPOs={allPOs}
          allInvoices={allInvoices}
          statusLabels={estimateStatusLabels}
          poStatusLabels={poStatusLabels}
          canEdit={canEdit}
          canDelete={canDelete}
          search={search}
          progress={progress}
        />
      )}
    </div>
  );
}
