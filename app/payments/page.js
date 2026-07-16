import { getCompanies, getClients, getDefaultCompany } from "@/lib/records";
import { listPayments, getOutstandingInvoices, getPaymentYears } from "@/lib/paymentsAdmin";
import { getServerSession } from "@/lib/session";
import { getPermissions } from "@/lib/permissions";
import { CompanySelect, ClientSelect, SearchBox, YearFilter } from "@/components/MainFilterBar";
import {
  AddPaymentButton,
  AllocatePaymentButton,
  EditPaymentButton,
  DeletePaymentButton,
} from "@/components/PaymentModal";

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

export default async function PaymentsPage({ searchParams }) {
  const params = await searchParams;
  const search = params?.search || "";
  const yearType = params?.yearType === "fy" ? "fy" : "calendar";
  const rawYear = params?.year || String(new Date().getFullYear());
  const year = rawYear === "all" ? "" : rawYear;

  const [companies, clients] = await Promise.all([getCompanies(), getClients()]);
  const defaultCompany = params?.company ? null : await getDefaultCompany(companies);
  const compId = params?.company || defaultCompany?.comp_id || "";
  const clientsForCompany = clients.filter((c) => c.comp_id === compId);
  const selectedCompanyObj = companies.find((c) => c.comp_id === compId);
  const defaultClientId = clientsForCompany.find(
    (c) => c.client_id === selectedCompanyObj?.default_client_id
  )?.client_id;
  const clientId = params?.client || defaultClientId || clientsForCompany[0]?.client_id || "";

  const [payments, outstandingInvoices, session, permissions, years] = await Promise.all([
    listPayments({ compId, clientId, search, year, yearType }),
    getOutstandingInvoices(compId, clientId),
    getServerSession(),
    getPermissions(),
    getPaymentYears(compId),
  ]);
  const canAdd = session.role === "admin" || permissions.can_add;
  const canEdit = session.role === "admin" || permissions.can_edit;
  const canDelete = session.role === "admin" || permissions.can_delete;

  const totals = payments.reduce(
    (acc, py) => {
      acc.received += Number(py.amount_received) || 0;
      acc.balance += Number(py.balance) || 0;
      return acc;
    },
    { received: 0, balance: 0 }
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Payments</h1>
        <CompanySelect companies={companies} compId={compId} />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="min-w-0 flex-1">
          <SearchBox search={search} />
        </div>
        <ClientSelect clients={clients} compId={compId} clientId={clientId} />
        <YearFilter years={years} year={rawYear} yearType={yearType} />
        {canAdd && (
          <AddPaymentButton key={`${compId}-${clientId}`} compId={compId} clientId={clientId} />
        )}
      </div>

      <div className="text-sm text-gray-600 dark:text-gray-400">{payments.length} payments</div>

      <div className="max-h-[70vh] overflow-y-auto overflow-x-auto rounded-lg border border-gray-100 dark:border-gray-700">
        <table className="min-w-full divide-y divide-gray-100 text-sm dark:divide-gray-700">
          <thead className="sticky top-0 bg-gray-50 dark:bg-gray-900/40">
            <tr>
              <th className="px-3 py-3 text-left font-medium text-gray-600 dark:text-gray-400">Payment Date</th>
              <th className="px-3 py-3 text-right font-medium text-gray-600 dark:text-gray-400">Amount Received</th>
              <th className="px-3 py-3 text-right font-medium text-gray-600 dark:text-gray-400">Balance Amount</th>
              <th className="min-w-[220px] px-3 py-3 text-left font-medium text-gray-600 dark:text-gray-400">
                Remarks
              </th>
              <th className="px-3 py-3 text-left font-medium text-gray-600 dark:text-gray-400">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {payments.map((py) => (
              <tr key={py.py_id} className="hover:bg-gray-50">
                <td className="px-3 py-3 text-gray-700 dark:text-gray-300">{formatDate(py.payment_date)}</td>
                <td className="px-3 py-3 text-right text-gray-700 dark:text-gray-300">
                  {formatMoney(py.amount_received)}
                </td>
                <td className="px-3 py-3 text-right text-gray-700 dark:text-gray-300">{formatMoney(py.balance)}</td>
                <td className="px-3 py-3 text-gray-700 dark:text-gray-300">{py.remarks || "—"}</td>
                <td className="px-3 py-3">
                  <div className="flex gap-2">
                    {canEdit && <EditPaymentButton payment={py} />}
                    {canEdit && (
                      <AllocatePaymentButton payment={py} outstandingInvoices={outstandingInvoices} />
                    )}
                    {canDelete && <DeletePaymentButton pyId={py.py_id} />}
                  </div>
                </td>
              </tr>
            ))}
            {payments.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-gray-500 dark:text-gray-400">
                  No payments found.
                </td>
              </tr>
            )}
          </tbody>
          {payments.length > 0 && (
            <tfoot className="sticky bottom-0 border-t-2 border-gray-200 bg-gray-50 font-medium dark:border-gray-700 dark:bg-gray-900/40">
              <tr>
                <td className="px-3 py-3 text-right text-gray-700 dark:text-gray-300">Total</td>
                <td className="px-3 py-3 text-right text-gray-900 dark:text-gray-100">{formatMoney(totals.received)}</td>
                <td className="px-3 py-3 text-right text-gray-900 dark:text-gray-100">{formatMoney(totals.balance)}</td>
                <td colSpan={2}></td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
