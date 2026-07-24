import { existsSync } from "fs";
import path from "path";
import { getCompanies, getClients, getDefaultCompany } from "@/lib/records";
import { listEstimates, getEstimateYears, getSuggestedEstNosByClient } from "@/lib/estimatesAdmin";
import { getRecordsWithoutEstimate } from "@/lib/recordsAdmin";
import { listPOs } from "@/lib/poAdmin";
import { listInvoices } from "@/lib/invoicesAdmin";
import { getStatusLabels } from "@/lib/settingsAdmin";
import { getServerSession } from "@/lib/session";
import { getPermissions } from "@/lib/permissions";
import { ESTIMATE_PROGRESS_OPTIONS } from "@/lib/status";
import { CompanySelect, ClientSelect, SearchBox, ProgressFilter, YearFilter } from "@/components/MainFilterBar";
import { AddEstimateButton } from "@/components/EstimateModal";
import { EstimatesTable } from "@/components/EstimatesTable";

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

export default async function EstimatesPage({ searchParams }) {
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

  const years = await getEstimateYears(compId);
  // Defaulting to the current year hides everything for a company whose
  // data is all from a past year — only do it when the current year
  // actually has data; otherwise show everything (matches what the Year
  // dropdown displays when nothing has been explicitly chosen).
  const currentYear = new Date().getFullYear();
  const rawYear = params?.year || (years.includes(currentYear) ? String(currentYear) : "all");
  const year = rawYear === "all" ? "" : rawYear;

  const NO_FILTER = { search: "", progress: [], year: "", yearType: "calendar" };
  const [
    estimates,
    recordsWithoutEstimate,
    statusLabels,
    poStatusLabels,
    allPOs,
    allInvoices,
    suggestedEstNosByClient,
    session,
    permissions,
  ] = await Promise.all([
    listEstimates({ compId, clientId, search, progress, year, yearType }),
    getRecordsWithoutEstimate(compId, clientId),
    getStatusLabels("estimate"),
    getStatusLabels("po"),
    listPOs({ compId, clientId: "", ...NO_FILTER }),
    listInvoices({ compId, clientId: "", ...NO_FILTER }),
    getSuggestedEstNosByClient(compId),
    getServerSession(),
    getPermissions(),
  ]);
  const progressOptions = [...ESTIMATE_PROGRESS_OPTIONS, ...statusLabels.map((l) => l.label_name)];
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

      <div className="flex flex-wrap items-center gap-2">
        <div className="min-w-0 flex-1">
          <SearchBox search={search} />
        </div>
        <ClientSelect clients={clients} compId={compId} clientId={clientId} />
        <ProgressFilter options={progressOptions} selected={progress} />
        <YearFilter years={years} year={rawYear} yearType={yearType} />
        {canAdd && (
          <AddEstimateButton
            key={`${compId}-${clientId}`}
            compId={compId}
            recordsWithoutEstimate={recordsWithoutEstimate}
            suggestedEstNosByClient={suggestedEstNosByClient}
          />
        )}
      </div>

      <EstimatesTable
        estimates={estimatesWithDocFlag}
        allPOs={allPOs}
        allInvoices={allInvoices}
        statusLabels={statusLabels}
        poStatusLabels={poStatusLabels}
        canEdit={canEdit}
        canDelete={canDelete}
        search={search}
      />
    </div>
  );
}
