import { existsSync } from "fs";
import path from "path";
import { getCompanies, getClients, getDefaultCompany } from "@/lib/records";
import { listEstimates, getEstimateYears } from "@/lib/estimatesAdmin";
import { getRecordsWithoutEstimate } from "@/lib/recordsAdmin";
import { listPOs } from "@/lib/poAdmin";
import { listInvoices } from "@/lib/invoicesAdmin";
import { getStatusLabels } from "@/lib/settingsAdmin";
import { getServerSession } from "@/lib/session";
import { getPermissions } from "@/lib/permissions";
import { ESTIMATE_PROGRESS_OPTIONS } from "@/lib/status";
import { CompanySelect, ClientSelect, SearchBox, ProgressFilter, YearFilter } from "@/components/MainFilterBar";
import { AddEstimateButton } from "@/components/EstimateModal";
import { EstimateSummaryRow } from "@/components/EstimateSummaryRow";

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

function formatMoney(value) {
  if (value === null || value === undefined) return "—";
  return Number(value).toLocaleString("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  });
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
  const [estimates, recordsWithoutEstimate, statusLabels, poStatusLabels, allPOs, allInvoices, session, permissions] =
    await Promise.all([
      listEstimates({ compId, clientId, search, progress, year, yearType }),
      getRecordsWithoutEstimate(compId, clientId),
      getStatusLabels("estimate"),
      getStatusLabels("po"),
      listPOs({ compId, clientId: "", ...NO_FILTER }),
      listInvoices({ compId, clientId: "", ...NO_FILTER }),
      getServerSession(),
      getPermissions(),
    ]);
  const progressOptions = [...ESTIMATE_PROGRESS_OPTIONS, ...statusLabels.map((l) => l.label_name)];
  const canAdd = session.role === "admin" || permissions.can_add;
  const canEdit = session.role === "admin" || permissions.can_edit;
  const canDelete = session.role === "admin" || permissions.can_delete;

  const totalAmount = estimates.reduce(
    (sum, est) => (est.lifecycle === "Raised" ? sum + (Number(est.amount) || 0) : sum),
    0
  );

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
          />
        )}
      </div>

      <div className="text-sm text-gray-600 dark:text-gray-400">{estimates.length} estimates</div>

      <div className="max-h-[70vh] overflow-y-auto overflow-x-auto rounded-lg border border-gray-100 dark:border-gray-700">
        <table className="min-w-full divide-y divide-gray-100 text-sm dark:divide-gray-700">
          <thead className="sticky top-0 bg-gray-50 dark:bg-gray-900/40">
            <tr>
              <th className="px-3 py-3 text-left font-medium text-gray-600 dark:text-gray-400">Record ID</th>
              <th className="px-3 py-3 text-left font-medium text-gray-600 dark:text-gray-400">Est No</th>
              <th className="px-3 py-3 text-left font-medium text-gray-600 dark:text-gray-400">Est Date</th>
              <th className="min-w-[320px] px-3 py-3 text-left font-medium text-gray-600 dark:text-gray-400">
                Description
              </th>
              <th className="px-3 py-3 text-right font-medium text-gray-600 dark:text-gray-400">Amount</th>
              <th className="px-3 py-3 text-left font-medium text-gray-600 dark:text-gray-400">Document</th>
              <th className="px-3 py-3 text-center font-medium text-gray-600 dark:text-gray-400">Status</th>
              <th className="px-3 py-3 text-center font-medium text-gray-600 dark:text-gray-400">Progress</th>
              <th className="px-3 py-3 text-left font-medium text-gray-600 dark:text-gray-400">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {estimates.map((est) => {
              const po = est.po_id ? allPOs.find((p) => p.po_id === est.po_id) : null;
              const invoices = po
                ? allInvoices.filter((inv) => inv.po_no === po.po_no)
                : allInvoices.filter((inv) => inv.est_id === est.est_id);
              return (
                <EstimateSummaryRow
                  key={est.est_id}
                  est={est}
                  po={po}
                  invoices={invoices}
                  statusLabels={statusLabels}
                  poStatusLabels={poStatusLabels}
                  docFileExists={est.doc_id ? documentFileExists(est.est_id, est.file_name) : false}
                  canEdit={canEdit}
                  canDelete={canDelete}
                />
              );
            })}
            {estimates.length === 0 && (
              <tr>
                <td colSpan={9} className="px-3 py-6 text-center text-gray-500 dark:text-gray-400">
                  No estimates found.
                </td>
              </tr>
            )}
          </tbody>
          {estimates.length > 0 && (
            <tfoot className="sticky bottom-0 border-t-2 border-gray-200 bg-gray-50 font-medium dark:border-gray-700 dark:bg-gray-900/40">
              <tr>
                <td colSpan={4} className="px-3 py-3 text-right text-gray-700 dark:text-gray-300">
                  Total (Raised only)
                </td>
                <td className="px-3 py-3 text-right text-gray-900 dark:text-gray-100">{formatMoney(totalAmount)}</td>
                <td colSpan={4}></td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
