import { getCompanies, getClients, getDefaultCompany } from "@/lib/records";
import { listPayments, getOutstandingInvoices, getPaymentYears, listInvoiceSummaries } from "@/lib/paymentsAdmin";
import { getInvoiceYears } from "@/lib/invoicesAdmin";
import { getServerSession } from "@/lib/session";
import { getPermissions } from "@/lib/permissions";
import { INVOICE_PROGRESS_OPTIONS } from "@/lib/status";
import {
  CompanySelect,
  ClientSelect,
  SearchBox,
  ProgressFilter,
  YearFilter,
  ClearFiltersButton,
} from "@/components/MainFilterBar";
import { AddPaymentButton } from "@/components/PaymentModal";
import { PaymentsTable } from "@/components/PaymentsTable";
import { PaymentAllocationsTable } from "@/components/PaymentAllocationsTable";
import { PaymentsTabs } from "@/components/PaymentsTabs";

const TAB_KEYS = ["payments", "allocations"];

export default async function PaymentsPage({ searchParams }) {
  const params = await searchParams;
  const search = params?.search || "";
  const progress = params?.progress ? params.progress.split(",") : [];
  const yearType = params?.yearType === "fy" ? "fy" : "calendar";
  const tab = TAB_KEYS.includes(params?.tab) ? params.tab : "payments";

  const [companies, clients] = await Promise.all([getCompanies(), getClients()]);
  const defaultCompany = params?.company ? null : await getDefaultCompany(companies);
  const compId = params?.company || defaultCompany?.comp_id || "";
  const clientsForCompany = clients.filter((c) => c.comp_id === compId);
  const selectedCompanyObj = companies.find((c) => c.comp_id === compId);
  const defaultClientId = clientsForCompany.find(
    (c) => c.client_id === selectedCompanyObj?.default_client_id
  )?.client_id;
  const clientId = params?.client || defaultClientId || clientsForCompany[0]?.client_id || "";

  // Each tab has its own underlying data (payments vs. invoices), so its own
  // list of years with data — used for both the Year dropdown itself and the
  // "does the current year actually have data" default-year check below.
  const years = await (tab === "allocations" ? getInvoiceYears(compId) : getPaymentYears(compId));
  const currentYear = new Date().getFullYear();
  const rawYear = params?.year || (years.includes(currentYear) ? String(currentYear) : "all");
  const year = rawYear === "all" ? "" : rawYear;

  const [payments, outstandingInvoices, invoices, session, permissions] = await Promise.all([
    listPayments({ compId, clientId, search, year, yearType }),
    getOutstandingInvoices(compId, clientId),
    listInvoiceSummaries({ compId, clientId, search, progress, year, yearType }),
    getServerSession(),
    getPermissions(),
  ]);
  const canAdd = session.role === "admin" || permissions.can_add;
  const canEdit = session.role === "admin" || permissions.can_edit;
  const canDelete = session.role === "admin" || permissions.can_delete;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Payments</h1>
        <CompanySelect companies={companies} compId={compId} />
      </div>

      <PaymentsTabs active={tab} />

      <div className="flex flex-wrap items-center gap-2">
        <div className="min-w-0 flex-1">
          <SearchBox key={search} search={search} />
        </div>
        <ClientSelect clients={clients} compId={compId} clientId={clientId} />
        {tab === "allocations" && <ProgressFilter options={INVOICE_PROGRESS_OPTIONS} selected={progress} />}
        <YearFilter years={years} year={rawYear} yearType={yearType} />
        <ClearFiltersButton />
        {tab === "payments" && canAdd && (
          <AddPaymentButton key={`${compId}-${clientId}`} compId={compId} clientId={clientId} />
        )}
      </div>

      {tab === "payments" ? (
        <PaymentsTable
          payments={payments}
          outstandingInvoices={outstandingInvoices}
          canEdit={canEdit}
          canDelete={canDelete}
        />
      ) : (
        <PaymentAllocationsTable invoices={invoices} canEdit={canEdit} />
      )}
    </div>
  );
}
