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
import { INVOICE_PROGRESS_OPTIONS } from "@/lib/status";
import { CompanySelect, ClientSelect, SearchBox, ProgressFilter, YearFilter } from "@/components/MainFilterBar";
import { AddInvoiceButton } from "@/components/InvoiceModal";
import { InvoicesTable } from "@/components/InvoicesTable";

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

  const invoicesWithDocFlag = invoices.map((inv) => ({
    ...inv,
    storedFileName: storedFileName(inv.inv_id, inv.file_name),
    docFileExists: inv.doc_id ? documentFileExists(inv.inv_id, inv.file_name) : false,
  }));

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

      <InvoicesTable
        invoices={invoicesWithDocFlag}
        statusLabels={statusLabels}
        canEdit={canEdit}
        canDelete={canDelete}
      />
    </div>
  );
}
