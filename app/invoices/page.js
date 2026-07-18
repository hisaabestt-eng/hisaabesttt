import { existsSync } from "fs";
import path from "path";
import Link from "next/link";
import { getCompanies, getClients, getDefaultCompany } from "@/lib/records";
import {
  listInvoices,
  getPOsForPicker,
  getEstimatesForDirectInvoicePicker,
  getInvoiceYears,
} from "@/lib/invoicesAdmin";
import { getStatusLabels } from "@/lib/settingsAdmin";
import { getServerSession } from "@/lib/session";
import { getPermissions } from "@/lib/permissions";
import {
  LIFECYCLE_STYLES,
  CUSTOM_STATUS_STYLE,
  progressLabel,
  progressStyle,
  invoiceDisplayStatus,
  INVOICE_PROGRESS_OPTIONS,
} from "@/lib/status";
import { CompanySelect, ClientSelect, SearchBox, ProgressFilter, YearFilter } from "@/components/MainFilterBar";
import { AddInvoiceButton, EditInvoiceButton, DeleteInvoiceButton } from "@/components/InvoiceModal";
import { DocumentPreviewLink } from "@/components/DocumentPreview";

// Uploaded files are stored on disk as "<inv_id>-<original name>".
function storedFileName(invId, fileName) {
  return `${invId}-${fileName}`;
}

function documentFileExists(invId, fileName) {
  if (!fileName) return false;
  return existsSync(
    path.join(process.cwd(), "public", "uploads", "invoice", storedFileName(invId, fileName))
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

function formatDate(value) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default async function InvoicesPage({ searchParams }) {
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

  const years = await getInvoiceYears(compId);
  // Defaulting to the current year hides everything for a company whose
  // data is all from a past year — only do it when the current year
  // actually has data; otherwise show everything (matches what the Year
  // dropdown displays when nothing has been explicitly chosen).
  const currentYear = new Date().getFullYear();
  const rawYear = params?.year || (years.includes(currentYear) ? String(currentYear) : "all");
  const year = rawYear === "all" ? "" : rawYear;

  const [invoices, pos, estimatesForDirectInvoice, statusLabels, session, permissions] = await Promise.all([
    listInvoices({ compId, clientId, search, progress, year, yearType }),
    getPOsForPicker(compId, clientId),
    getEstimatesForDirectInvoicePicker(compId, clientId),
    getStatusLabels("invoice"),
    getServerSession(),
    getPermissions(),
  ]);
  const progressOptions = [...INVOICE_PROGRESS_OPTIONS, ...statusLabels.map((l) => l.label_name)];
  const canAdd = session.role === "admin" || permissions.can_add;
  const canEdit = session.role === "admin" || permissions.can_edit;
  const canDelete = session.role === "admin" || permissions.can_delete;

  const totalAmount = invoices.reduce(
    (sum, inv) => (inv.lifecycle === "Raised" ? sum + (Number(inv.invoice_total) || 0) : sum),
    0
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Invoices</h1>
        <div className="flex items-center gap-2">
          <Link
            href={`/invoices/detailed?company=${compId}`}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
          >
            Detailed Invoice Report
          </Link>
          <CompanySelect companies={companies} compId={compId} />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="min-w-0 flex-1">
          <SearchBox search={search} />
        </div>
        <ClientSelect clients={clients} compId={compId} clientId={clientId} />
        <ProgressFilter options={progressOptions} selected={progress} />
        <YearFilter years={years} year={rawYear} yearType={yearType} />
        {canAdd && (
          <AddInvoiceButton
            key={`${compId}-${clientId}`}
            compId={compId}
            pos={pos}
            estimates={estimatesForDirectInvoice}
          />
        )}
      </div>

      <div className="text-sm text-gray-600 dark:text-gray-400">{invoices.length} invoices</div>

      <div className="max-h-[70vh] overflow-y-auto overflow-x-auto rounded-lg border border-gray-100 dark:border-gray-700">
        <table className="min-w-full divide-y divide-gray-100 text-sm dark:divide-gray-700">
          <thead className="sticky top-0 bg-gray-50 dark:bg-gray-900/40">
            <tr>
              <th className="px-3 py-3 text-left font-medium text-gray-600 dark:text-gray-400">Record ID</th>
              <th className="px-3 py-3 text-left font-medium text-gray-600 dark:text-gray-400">Invoice No</th>
              <th className="px-3 py-3 text-left font-medium text-gray-600 dark:text-gray-400">Invoice Date</th>
              <th className="min-w-[320px] px-3 py-3 text-left font-medium text-gray-600 dark:text-gray-400">
                Description
              </th>
              <th className="px-3 py-3 text-right font-medium text-gray-600 dark:text-gray-400">Total</th>
              <th className="px-3 py-3 text-left font-medium text-gray-600 dark:text-gray-400">Document</th>
              <th className="px-3 py-3 text-center font-medium text-gray-600 dark:text-gray-400">Status</th>
              <th className="px-3 py-3 text-center font-medium text-gray-600 dark:text-gray-400">Progress</th>
              <th className="px-3 py-3 text-left font-medium text-gray-600 dark:text-gray-400">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {invoices.map((inv) => (
              <tr key={inv.inv_id} className="hover:bg-gray-50">
                <td className="px-3 py-3 font-mono text-xs text-gray-500 dark:text-gray-400">{inv.record_id}</td>
                <td className="px-3 py-3 text-gray-700 dark:text-gray-300">{inv.invoice_no}</td>
                <td className="px-3 py-3 text-gray-700 dark:text-gray-300">{formatDate(inv.invoice_date)}</td>
                <td className="px-3 py-3 text-gray-700 dark:text-gray-300">{inv.description}</td>
                <td className="px-3 py-3 text-right text-gray-700 dark:text-gray-300">
                  {formatMoney(inv.invoice_total)}
                </td>
                <td className="px-3 py-3">
                  {inv.external_url ? (
                    <DocumentPreviewLink
                      href={inv.external_url}
                      externalUrl={inv.external_url}
                      className="text-xs text-blue-600 underline"
                    >
                      🔗 External Link
                    </DocumentPreviewLink>
                  ) : inv.doc_id && documentFileExists(inv.inv_id, inv.file_name) ? (
                    <DocumentPreviewLink
                      href={`/uploads/invoice/${storedFileName(inv.inv_id, inv.file_name)}`}
                      fileName={inv.file_name}
                      className="text-xs text-blue-600 underline"
                    >
                      📎 {inv.file_name}
                    </DocumentPreviewLink>
                  ) : inv.doc_id ? (
                    <span className="text-xs text-gray-400" title="Uploaded before file storage was set up">
                      📎 {inv.file_name} (no file)
                    </span>
                  ) : (
                    <span className="text-xs text-gray-400">No document</span>
                  )}
                </td>
                <td className="px-3 py-3 text-center">
                  <span
                    className={`inline-flex min-w-[120px] items-center justify-center whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${
                      inv.custom_status ? CUSTOM_STATUS_STYLE : LIFECYCLE_STYLES[invoiceDisplayStatus(inv)]
                    }`}
                  >
                    {invoiceDisplayStatus(inv)}
                  </span>
                  {invoiceDisplayStatus(inv) === "Submitted" && inv.submission_date && (
                    <div className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                      {inv.submission_status} · {formatDate(inv.submission_date)}
                    </div>
                  )}
                </td>
                <td className="px-3 py-3 text-center">
                  <span
                    className={`inline-flex min-w-[120px] items-center justify-center whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${progressStyle(inv)}`}
                  >
                    {progressLabel(inv, "Invoice")}
                  </span>
                  {inv.status === "Scheduled" && inv.scheduled_payment_date && (
                    <div className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                      {formatDate(inv.scheduled_payment_date)}
                    </div>
                  )}
                </td>
                <td className="px-3 py-3">
                  <div className="flex gap-2">
                    {canEdit && <EditInvoiceButton invoice={inv} statusLabels={statusLabels} />}
                    {canDelete && inv.status !== "Paid" && inv.status !== "Partial Paid" && (
                      <DeleteInvoiceButton invId={inv.inv_id} />
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {invoices.length === 0 && (
              <tr>
                <td colSpan={9} className="px-3 py-6 text-center text-gray-500 dark:text-gray-400">
                  No invoices found.
                </td>
              </tr>
            )}
          </tbody>
          {invoices.length > 0 && (
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
