import { existsSync } from "fs";
import path from "path";
import { getCompanies, getClients, getDefaultCompany } from "@/lib/records";
import { listInvoices, getPOsForPicker } from "@/lib/invoicesAdmin";
import { LIFECYCLE_STYLES, progressLabel, progressStyle } from "@/lib/status";
import { CompanySelect, ClientSelect, SearchBox } from "@/components/MainFilterBar";
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

export default async function InvoicesPage({ searchParams }) {
  const params = await searchParams;
  const search = params?.search || "";

  const [companies, clients] = await Promise.all([getCompanies(), getClients()]);
  const defaultCompany = params?.company ? null : await getDefaultCompany(companies);
  const compId = params?.company || defaultCompany?.comp_id || "";
  const clientsForCompany = clients.filter((c) => c.comp_id === compId);
  const clientId = params?.client || clientsForCompany[0]?.client_id || "";

  const [invoices, pos] = await Promise.all([
    listInvoices({ compId, clientId, search }),
    getPOsForPicker(compId, clientId),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-gray-900">Invoices</h1>
        <CompanySelect companies={companies} compId={compId} />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="min-w-0 flex-1">
          <SearchBox search={search} />
        </div>
        <ClientSelect clients={clients} compId={compId} clientId={clientId} />
        <AddInvoiceButton key={`${compId}-${clientId}`} pos={pos} />
      </div>

      <div className="text-sm text-gray-600">{invoices.length} invoices</div>

      <div className="max-h-[70vh] overflow-y-auto overflow-x-auto rounded-lg border bg-white">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="sticky top-0 bg-gray-50">
            <tr>
              <th className="px-3 py-2 text-left font-medium text-gray-600">Record ID</th>
              <th className="px-3 py-2 text-left font-medium text-gray-600">Invoice No</th>
              <th className="px-3 py-2 text-left font-medium text-gray-600">Invoice Date</th>
              <th className="min-w-[320px] px-3 py-2 text-left font-medium text-gray-600">
                Description
              </th>
              <th className="px-3 py-2 text-right font-medium text-gray-600">Total</th>
              <th className="px-3 py-2 text-left font-medium text-gray-600">Document</th>
              <th className="px-3 py-2 text-left font-medium text-gray-600">Status</th>
              <th className="px-3 py-2 text-left font-medium text-gray-600">Progress</th>
              <th className="px-3 py-2 text-left font-medium text-gray-600">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {invoices.map((inv) => (
              <tr key={inv.inv_id}>
                <td className="px-3 py-2 font-mono text-xs text-gray-500">{inv.record_id}</td>
                <td className="px-3 py-2 text-gray-700">{inv.invoice_no}</td>
                <td className="px-3 py-2 text-gray-700">{formatDate(inv.invoice_date)}</td>
                <td className="px-3 py-2 text-gray-700">{inv.description}</td>
                <td className="px-3 py-2 text-right text-gray-700">
                  {formatMoney(inv.invoice_total)}
                </td>
                <td className="px-3 py-2">
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
                <td className="px-3 py-2">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${LIFECYCLE_STYLES[inv.lifecycle]}`}
                  >
                    {inv.lifecycle}
                  </span>
                </td>
                <td className="px-3 py-2">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${progressStyle(inv)}`}
                  >
                    {progressLabel(inv, "Invoice")}
                  </span>
                </td>
                <td className="px-3 py-2">
                  <div className="flex gap-2">
                    <EditInvoiceButton invoice={inv} />
                    {inv.status === "Payment Pending" && <DeleteInvoiceButton invId={inv.inv_id} />}
                  </div>
                </td>
              </tr>
            ))}
            {invoices.length === 0 && (
              <tr>
                <td colSpan={9} className="px-3 py-6 text-center text-gray-500">
                  No invoices found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
