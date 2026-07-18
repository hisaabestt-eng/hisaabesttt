import { existsSync } from "fs";
import path from "path";
import { getCompanies, getClients, getDefaultCompany } from "@/lib/records";
import { listPOs, getEstimatesWithoutPO, getPOYears } from "@/lib/poAdmin";
import { getStatusLabels } from "@/lib/settingsAdmin";
import { getServerSession } from "@/lib/session";
import { getPermissions } from "@/lib/permissions";
import { PO_PROGRESS_OPTIONS } from "@/lib/status";
import { CompanySelect, ClientSelect, SearchBox, ProgressFilter, YearFilter } from "@/components/MainFilterBar";
import { AddPOButton } from "@/components/POModal";
import { POSummaryRow } from "@/components/POSummaryRow";

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
    maximumFractionDigits: 2,
  });
}

export default async function PurchaseOrdersPage({ searchParams }) {
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

  const years = await getPOYears(compId);
  // Defaulting to the current year hides everything for a company whose
  // data is all from a past year — only do it when the current year
  // actually has data; otherwise show everything (matches what the Year
  // dropdown displays when nothing has been explicitly chosen).
  const currentYear = new Date().getFullYear();
  const rawYear = params?.year || (years.includes(currentYear) ? String(currentYear) : "all");
  const year = rawYear === "all" ? "" : rawYear;

  const [purchaseOrders, estimatesWithoutPO, statusLabels, session, permissions] = await Promise.all([
    listPOs({ compId, clientId, search, progress, year, yearType }),
    getEstimatesWithoutPO(compId, clientId),
    getStatusLabels("po"),
    getServerSession(),
    getPermissions(),
  ]);
  const progressOptions = [...PO_PROGRESS_OPTIONS, ...statusLabels.map((l) => l.label_name)];
  const canAdd = session.role === "admin" || permissions.can_add;
  const canEdit = session.role === "admin" || permissions.can_edit;
  const canDelete = session.role === "admin" || permissions.can_delete;

  const totals = purchaseOrders.reduce(
    (acc, po) => {
      if (po.lifecycle !== "Raised") return acc;
      acc.amount += Number(po.amount) || 0;
      acc.invoiced += Number(po.invoiced_amount) || 0;
      acc.balance += Number(po.invoice_balance) || 0;
      return acc;
    },
    { amount: 0, invoiced: 0, balance: 0 }
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Purchase Orders</h1>
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
          <AddPOButton key={`${compId}-${clientId}`} compId={compId} estimatesWithoutPO={estimatesWithoutPO} />
        )}
      </div>

      <div className="text-sm text-gray-600 dark:text-gray-400">
        {purchaseOrders.length} purchase orders — click a row to see its invoices
      </div>

      <div className="max-h-[70vh] overflow-y-auto overflow-x-auto rounded-lg border border-gray-100 dark:border-gray-700">
        <table className="min-w-full divide-y divide-gray-100 text-sm dark:divide-gray-700">
          <thead className="sticky top-0 bg-gray-50 dark:bg-gray-900/40">
            <tr>
              <th className="px-3 py-3 text-left font-medium text-gray-600 dark:text-gray-400">Record ID</th>
              <th className="px-3 py-3 text-left font-medium text-gray-600 dark:text-gray-400">PO No</th>
              <th className="px-3 py-3 text-left font-medium text-gray-600 dark:text-gray-400">PO Date</th>
              <th className="min-w-[320px] px-3 py-3 text-left font-medium text-gray-600 dark:text-gray-400">
                Description
              </th>
              <th className="px-3 py-3 text-right font-medium text-gray-600 dark:text-gray-400">Amount</th>
              <th className="px-3 py-3 text-right font-medium text-gray-600 dark:text-gray-400">Invoiced</th>
              <th className="px-3 py-3 text-right font-medium text-gray-600 dark:text-gray-400">Balance to Invoice</th>
              <th className="px-3 py-3 text-left font-medium text-gray-600 dark:text-gray-400">Document</th>
              <th className="px-3 py-3 text-center font-medium text-gray-600 dark:text-gray-400">Status</th>
              <th className="px-3 py-3 text-left font-medium text-gray-600 dark:text-gray-400">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {purchaseOrders.map((po) => (
              <POSummaryRow
                key={po.po_id}
                po={po}
                statusLabels={statusLabels}
                docFileExists={po.doc_id ? documentFileExists(po.po_id, po.file_name) : false}
                canEdit={canEdit}
                canDelete={canDelete}
              />
            ))}
            {purchaseOrders.length === 0 && (
              <tr>
                <td colSpan={10} className="px-3 py-6 text-center text-gray-500 dark:text-gray-400">
                  No purchase orders found.
                </td>
              </tr>
            )}
          </tbody>
          {purchaseOrders.length > 0 && (
            <tfoot className="sticky bottom-0 border-t-2 border-gray-200 bg-gray-50 font-medium dark:border-gray-700 dark:bg-gray-900/40">
              <tr>
                <td colSpan={4} className="px-3 py-3 text-right text-gray-700 dark:text-gray-300">
                  Total (Raised only)
                </td>
                <td className="px-3 py-3 text-right text-gray-900 dark:text-gray-100">{formatMoney(totals.amount)}</td>
                <td className="px-3 py-3 text-right text-gray-900 dark:text-gray-100">{formatMoney(totals.invoiced)}</td>
                <td className="px-3 py-3 text-right text-gray-900 dark:text-gray-100">{formatMoney(totals.balance)}</td>
                <td colSpan={3}></td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
