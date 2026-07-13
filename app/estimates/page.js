import { existsSync } from "fs";
import path from "path";
import { getCompanies, getClients, getDefaultCompany } from "@/lib/records";
import { listEstimates } from "@/lib/estimatesAdmin";
import { getRecordsWithoutEstimate } from "@/lib/recordsAdmin";
import { LIFECYCLE_STYLES, progressLabel, progressStyle } from "@/lib/status";
import { CompanySelect, ClientSelect, SearchBox } from "@/components/MainFilterBar";
import { AddEstimateButton, EditEstimateButton, DeleteEstimateButton } from "@/components/EstimateModal";
import { DocumentPreviewLink } from "@/components/DocumentPreview";

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

export default async function EstimatesPage({ searchParams }) {
  const params = await searchParams;
  const search = params?.search || "";

  const [companies, clients] = await Promise.all([getCompanies(), getClients()]);
  const defaultCompany = params?.company ? null : await getDefaultCompany(companies);
  const compId = params?.company || defaultCompany?.comp_id || "";
  const clientsForCompany = clients.filter((c) => c.comp_id === compId);
  const clientId = params?.client || clientsForCompany[0]?.client_id || "";

  const [estimates, recordsWithoutEstimate] = await Promise.all([
    listEstimates({ compId, clientId, search }),
    getRecordsWithoutEstimate(compId, clientId),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-gray-900">Estimates</h1>
        <CompanySelect companies={companies} compId={compId} />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="min-w-0 flex-1">
          <SearchBox search={search} />
        </div>
        <ClientSelect clients={clients} compId={compId} clientId={clientId} />
        <AddEstimateButton key={`${compId}-${clientId}`} recordsWithoutEstimate={recordsWithoutEstimate} />
      </div>

      <div className="text-sm text-gray-600">{estimates.length} estimates</div>

      <div className="max-h-[70vh] overflow-y-auto overflow-x-auto rounded-lg border bg-white">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="sticky top-0 bg-gray-50">
            <tr>
              <th className="px-3 py-2 text-left font-medium text-gray-600">Record ID</th>
              <th className="px-3 py-2 text-left font-medium text-gray-600">Est No</th>
              <th className="px-3 py-2 text-left font-medium text-gray-600">Est Date</th>
              <th className="min-w-[320px] px-3 py-2 text-left font-medium text-gray-600">
                Description
              </th>
              <th className="px-3 py-2 text-right font-medium text-gray-600">Amount</th>
              <th className="px-3 py-2 text-left font-medium text-gray-600">Document</th>
              <th className="px-3 py-2 text-left font-medium text-gray-600">Status</th>
              <th className="px-3 py-2 text-left font-medium text-gray-600">Progress</th>
              <th className="px-3 py-2 text-left font-medium text-gray-600">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {estimates.map((est) => (
              <tr key={est.est_id}>
                <td className="px-3 py-2 font-mono text-xs text-gray-500">{est.record_id}</td>
                <td className="px-3 py-2 text-gray-700">{est.est_no}</td>
                <td className="px-3 py-2 text-gray-700">{formatDate(est.estimate_date)}</td>
                <td className="px-3 py-2 text-gray-700">{est.description}</td>
                <td className="px-3 py-2 text-right text-gray-700">{formatMoney(est.amount)}</td>
                <td className="px-3 py-2">
                  {est.external_url ? (
                    <DocumentPreviewLink
                      href={est.external_url}
                      externalUrl={est.external_url}
                      className="text-xs text-blue-600 underline"
                    >
                      🔗 External Link
                    </DocumentPreviewLink>
                  ) : est.doc_id && documentFileExists(est.est_id, est.file_name) ? (
                    <DocumentPreviewLink
                      href={`/uploads/estimates/${storedFileName(est.est_id, est.file_name)}`}
                      fileName={est.file_name}
                      className="text-xs text-blue-600 underline"
                    >
                      📎 {est.file_name}
                    </DocumentPreviewLink>
                  ) : est.doc_id ? (
                    <span className="text-xs text-gray-400" title="Uploaded before file storage was set up">
                      📎 {est.file_name} (no file)
                    </span>
                  ) : (
                    <span className="text-xs text-gray-400">No document</span>
                  )}
                </td>
                <td className="px-3 py-2">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${LIFECYCLE_STYLES[est.lifecycle]}`}
                  >
                    {est.lifecycle}
                  </span>
                </td>
                <td className="px-3 py-2">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${progressStyle(est)}`}
                  >
                    {progressLabel(est, "Estimate")}
                  </span>
                </td>
                <td className="px-3 py-2">
                  <div className="flex gap-2">
                    <EditEstimateButton estimate={est} />
                    {!est.po_id && <DeleteEstimateButton estId={est.est_id} />}
                  </div>
                </td>
              </tr>
            ))}
            {estimates.length === 0 && (
              <tr>
                <td colSpan={9} className="px-3 py-6 text-center text-gray-500">
                  No estimates found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
