import { getCompanies, getClients, getDefaultCompany } from "@/lib/records";
import { listPayments, getOutstandingInvoices } from "@/lib/paymentsAdmin";
import { CompanySelect, ClientSelect, SearchBox } from "@/components/MainFilterBar";
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

  const [companies, clients] = await Promise.all([getCompanies(), getClients()]);
  const defaultCompany = params?.company ? null : await getDefaultCompany(companies);
  const compId = params?.company || defaultCompany?.comp_id || "";
  const clientsForCompany = clients.filter((c) => c.comp_id === compId);
  const clientId = params?.client || clientsForCompany[0]?.client_id || "";

  const [payments, outstandingInvoices] = await Promise.all([
    listPayments({ compId, clientId, search }),
    getOutstandingInvoices(compId, clientId),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-gray-900">Payments</h1>
        <CompanySelect companies={companies} compId={compId} />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="min-w-0 flex-1">
          <SearchBox search={search} />
        </div>
        <ClientSelect clients={clients} compId={compId} clientId={clientId} />
        <AddPaymentButton key={`${compId}-${clientId}`} compId={compId} clientId={clientId} />
      </div>

      <div className="text-sm text-gray-600">{payments.length} payments</div>

      <div className="max-h-[70vh] overflow-y-auto overflow-x-auto rounded-lg border bg-white">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="sticky top-0 bg-gray-50">
            <tr>
              <th className="px-3 py-2 text-left font-medium text-gray-600">Payment Date</th>
              <th className="px-3 py-2 text-right font-medium text-gray-600">Amount Received</th>
              <th className="px-3 py-2 text-right font-medium text-gray-600">Balance Amount</th>
              <th className="min-w-[220px] px-3 py-2 text-left font-medium text-gray-600">
                Remarks
              </th>
              <th className="px-3 py-2 text-left font-medium text-gray-600">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {payments.map((py) => (
              <tr key={py.py_id}>
                <td className="px-3 py-2 text-gray-700">{formatDate(py.payment_date)}</td>
                <td className="px-3 py-2 text-right text-gray-700">
                  {formatMoney(py.amount_received)}
                </td>
                <td className="px-3 py-2 text-right text-gray-700">{formatMoney(py.balance)}</td>
                <td className="px-3 py-2 text-gray-700">{py.remarks || "—"}</td>
                <td className="px-3 py-2">
                  <div className="flex gap-2">
                    <EditPaymentButton payment={py} />
                    <AllocatePaymentButton payment={py} outstandingInvoices={outstandingInvoices} />
                    <DeletePaymentButton pyId={py.py_id} />
                  </div>
                </td>
              </tr>
            ))}
            {payments.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-gray-500">
                  No payments found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
