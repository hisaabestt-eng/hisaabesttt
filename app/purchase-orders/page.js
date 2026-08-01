import { existsSync } from "fs";
import path from "path";
import { getCompanies, getClients, getDefaultCompany } from "@/lib/records";
import { listPOs, getEstimatesWithoutPO, getPOYears } from "@/lib/poAdmin";
import { getStatusLabels } from "@/lib/settingsAdmin";
import { getServerSession } from "@/lib/session";
import { getPermissions } from "@/lib/permissions";
import { PO_PROGRESS_OPTIONS } from "@/lib/status";
import {
  CompanySelect,
  ClientSelect,
  SearchBox,
  ProgressFilter,
  YearFilter,
  ClearFiltersButton,
  EnteredTodayButton,
} from "@/components/MainFilterBar";
import { AddPOButton } from "@/components/POModal";
import { POsTable } from "@/components/POsTable";

// Uploaded files are stored on disk as "<po_id>-<original name>".
function storedFileName(poId, fileName) {
  return `${poId}-${fileName}`;
}

function documentFileExists(poId, fileName) {
  if (!fileName) return false;
  return existsSync(
    path.join(process.cwd(), "public", "uploads", "purchase-order", storedFileName(poId, fileName))
  );
}

function estimateDocumentFileExists(estId, fileName) {
  if (!fileName) return false;
  return existsSync(path.join(process.cwd(), "public", "uploads", "estimates", `${estId}-${fileName}`));
}

export default async function PurchaseOrdersPage({ searchParams }) {
  const params = await searchParams;
  const search = params?.search || "";
  const progress = params?.progress ? params.progress.split(",") : [];
  const yearType = params?.yearType === "fy" ? "fy" : params?.yearType === "custom" ? "custom" : "calendar";
  const from = params?.from || "";
  const to = params?.to || "";
  const enteredOn = params?.enteredOn || "";

  const [companies, clients] = await Promise.all([getCompanies(), getClients()]);
  const defaultCompany = params?.company ? null : await getDefaultCompany(companies);
  const compId = params?.company || defaultCompany?.comp_id || "";
  const clientsForCompany = clients.filter((c) => c.comp_id === compId);
  const selectedCompanyObj = companies.find((c) => c.comp_id === compId);
  const defaultClientId = clientsForCompany.find(
    (c) => c.client_id === selectedCompanyObj?.default_client_id
  )?.client_id;
  const clientId = params?.client || defaultClientId || clientsForCompany[0]?.client_id || "";

  const years = await getPOYears(compId);
  // Defaulting to the current year hides everything for a company whose
  // data is all from a past year — only do it when the current year
  // actually has data; otherwise show everything (matches what the Year
  // dropdown displays when nothing has been explicitly chosen).
  const currentYear = new Date().getFullYear();
  const rawYear = params?.year || (years.includes(currentYear) ? String(currentYear) : "all");
  const year = rawYear === "all" ? "" : rawYear;

  const [purchaseOrders, estimatesWithoutPO, statusLabels, session, permissions] = await Promise.all([
    listPOs({ compId, clientId, search, progress, year, yearType, from, to, enteredOn }),
    getEstimatesWithoutPO(compId, clientId),
    getStatusLabels("po"),
    getServerSession(),
    getPermissions(),
  ]);
  const progressOptions = [...PO_PROGRESS_OPTIONS, ...statusLabels.map((l) => l.label_name)];
  const canAdd = session.role === "admin" || permissions.can_add;
  const canEdit = session.role === "admin" || permissions.can_edit;
  const canDelete = session.role === "admin" || permissions.can_delete;

  const posWithDocFlag = purchaseOrders.map((po) => ({
    ...po,
    docFileExists: po.doc_id ? documentFileExists(po.po_id, po.file_name) : false,
    estimateDocFileExists: po.estimate_doc_id
      ? estimateDocumentFileExists(po.est_id, po.estimate_file_name)
      : false,
  }));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Purchase Orders</h1>
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
          <ProgressFilter options={progressOptions} selected={progress} />
          <YearFilter years={years} year={rawYear} yearType={yearType} from={from} to={to} />
          <EnteredTodayButton />
          <ClearFiltersButton />
          {canAdd && (
            <div className="ml-auto">
              <AddPOButton key={`${compId}-${clientId}`} compId={compId} estimatesWithoutPO={estimatesWithoutPO} />
            </div>
          )}
        </div>
      </div>

      <POsTable
        purchaseOrders={posWithDocFlag}
        statusLabels={statusLabels}
        canEdit={canEdit}
        canDelete={canDelete}
        search={search}
        progress={progress}
      />
    </div>
  );
}
