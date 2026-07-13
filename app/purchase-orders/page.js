import { existsSync } from "fs";
import path from "path";
import { getCompanies, getClients, getDefaultCompany } from "@/lib/records";
import { listPOs, getEstimatesWithoutPO } from "@/lib/poAdmin";
import { LIFECYCLE_STYLES, progressLabel, progressStyle } from "@/lib/status";
import { CompanySelect, ClientSelect, SearchBox } from "@/components/MainFilterBar";
import { AddPOButton, EditPOButton, DeletePOButton } from "@/components/POModal";
import { DocumentPreviewLink } from "@/components/DocumentPreview";

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

export default async function PurchaseOrdersPage({ searchParams }) {
  const params = await searchParams;
  const search = params?.search || "";

  const [companies, clients] = await Promise.all([getCompanies(), getClients()]);
  const defaultCompany = params?.company ? null : await getDefaultCompany(companies);
  const compId = params?.company || defaultCompany?.comp_id || "";
  const clientsForCompany = clients.filter((c) => c.comp_id === compId);
  const clientId = params?.client || clientsForCompany[0]?.client_id || "";

  const [purchaseOrders, estimatesWithoutPO] = await Promise.all([
    listPOs({ compId, clientId, search }),
    getEstimatesWithoutPO(compId, clientId),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-gray-900">Purchase Orders</h1>
        <CompanySelect companies={companies} compId={compId} />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="min-w-0 flex-1">
          <SearchBox search={search} />
        </div>
        <ClientSelect clients={clients} compId={compId} clientId={clientId} />
        <AddPOButton key={`${compId}-${clientId}`} estimatesWithoutPO={estimatesWithoutPO} />
      </div>

      <div className="text-sm text-gray-600">{purchaseOrders.length} purchase orders</div>

      <div className="max-h-[70vh] overflow-y-auto overflow-x-auto rounded-lg border bg-white">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="sticky top-0 bg-gray-50">
            <tr>
              <th className="px-3 py-2 text-left font-medium text-gray-600">Record ID</th>
              <th className="px-3 py-2 text-left font-medium text-gray-600">PO No</th>
              <th className="px-3 py-2 text-left font-medium text-gray-600">PO Date</th>
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
            {purchaseOrders.map((po) => (
              <tr key={po.po_id}>
                <td className="px-3 py-2 font-mono text-xs text-gray-500">{po.record_id}</td>
                <td className="px-3 py-2 text-gray-700">{po.po_no}</td>
                <td className="px-3 py-2 text-gray-700">{formatDate(po.po_date)}</td>
                <td className="px-3 py-2 text-gray-700">{po.description}</td>
                <td className="px-3 py-2 text-right text-gray-700">{formatMoney(po.amount)}</td>
                <td className="px-3 py-2">
                  {po.external_url ? (
                    <DocumentPreviewLink
                      href={po.external_url}
                      externalUrl={po.external_url}
                      className="text-xs text-blue-600 underline"
                    >
                      🔗 External Link
                    </DocumentPreviewLink>
                  ) : po.doc_id && documentFileExists(po.po_id, po.file_name) ? (
                    <DocumentPreviewLink
                      href={`/uploads/purchase-order/${storedFileName(po.po_id, po.file_name)}`}
                      fileName={po.file_name}
                      className="text-xs text-blue-600 underline"
                    >
                      📎 {po.file_name}
                    </DocumentPreviewLink>
                  ) : po.doc_id ? (
                    <span className="text-xs text-gray-400" title="Uploaded before file storage was set up">
                      📎 {po.file_name} (no file)
                    </span>
                  ) : (
                    <span className="text-xs text-gray-400">No document</span>
                  )}
                </td>
                <td className="px-3 py-2">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${LIFECYCLE_STYLES[po.lifecycle]}`}
                  >
                    {po.lifecycle}
                  </span>
                </td>
                <td className="px-3 py-2">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${progressStyle(po)}`}
                  >
                    {progressLabel(po, "PO")}
                  </span>
                </td>
                <td className="px-3 py-2">
                  <div className="flex gap-2">
                    <EditPOButton po={po} />
                    {!po.inv_id && <DeletePOButton poId={po.po_id} />}
                  </div>
                </td>
              </tr>
            ))}
            {purchaseOrders.length === 0 && (
              <tr>
                <td colSpan={9} className="px-3 py-6 text-center text-gray-500">
                  No purchase orders found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
