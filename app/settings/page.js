import { getCompanies, getDefaultCompany } from "@/lib/records";
import { getAllCompanies, getAllClientsForSettings, getStatusLabels } from "@/lib/settingsAdmin";
import { getPermissions } from "@/lib/permissions";
import { listActivity } from "@/lib/activityLog";
import { listUsers } from "@/lib/users";
import { getServerSession } from "@/lib/session";
import { CompanySelect, SearchBox } from "@/components/MainFilterBar";
import { AddCompanyButton, EditCompanyButton, CompanyStatusButton } from "@/components/CompanyModal";
import { AddClientButton, ClientStatusButton } from "@/components/ClientSettingsModal";
import { EntityTypeSelect, AddStatusLabelButton, DeleteStatusLabelButton } from "@/components/StatusLabelModal";
import { PermissionsForm } from "@/components/PermissionsForm";
import { AddUserButton, UserActiveToggle, UserRoleSelect, ChangePasswordButton } from "@/components/UserModal";
import { SettingsTabs } from "@/components/SettingsTabs";
import { BulkUploadRecordsButton } from "@/components/RecordModal";
import { BulkChainUploadButton } from "@/components/BulkChainUploadButton";
import { BulkUploadButton } from "@/components/BulkUploadButton";

const TAB_KEYS = ["companies", "clients", "labels", "bulk", "permissions", "users", "activity"];

const ENTITY_TYPE_LABELS = {
  record: "Records",
  estimate: "Estimates",
  po: "Purchase Orders",
  invoice: "Invoices",
};

const ACTIVITY_ENTITY_LABELS = {
  record: "Record",
  estimate: "Estimate",
  po: "Purchase Order",
  invoice: "Invoice",
  payment: "Payment",
};

const ESTIMATE_BULK_COLUMNS = [
  { header: "Record ID", key: "recordId" },
  { header: "Estimate No", key: "estNo" },
  { header: "Estimate Date", key: "estDate" },
  { header: "Description", key: "description" },
  { header: "Amount", key: "amount" },
  { header: "Document Link", key: "docLink" },
];

const PO_BULK_COLUMNS = [
  { header: "Estimate No", key: "estNo" },
  { header: "PO No", key: "poNo" },
  { header: "PO Date", key: "poDate" },
  { header: "Description", key: "description" },
  { header: "Amount", key: "amount" },
  { header: "Document Link", key: "docLink" },
];

const INVOICE_BULK_COLUMNS = [
  { header: "PO No", key: "poNo" },
  { header: "Invoice No", key: "invoiceNo" },
  { header: "Invoice Date", key: "invoiceDate" },
  { header: "Description", key: "description" },
  { header: "Invoice Amount", key: "invoiceAmount" },
  { header: "GST %", key: "gstPct" },
  { header: "TDS %", key: "tdsPct" },
  { header: "Document Link", key: "docLink" },
];

function formatDateTime(value) {
  return new Date(value).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function StatusBadge({ status }) {
  return (
    <span
      className={`inline-block rounded-full px-2.5 py-1 text-xs font-semibold ${
        status === "Active" ? "bg-emerald-500 text-white" : "bg-gray-400 text-white"
      }`}
    >
      {status}
    </span>
  );
}

export default async function SettingsPage({ searchParams }) {
  const params = await searchParams;
  const search = params?.search || "";
  const tab = TAB_KEYS.includes(params?.tab) ? params.tab : "companies";

  const companies = await getCompanies();
  const defaultCompany = params?.company ? null : await getDefaultCompany(companies);
  const compId = params?.company || defaultCompany?.comp_id || "";
  const selectedCompany = companies.find((c) => c.comp_id === compId);

  const entityType = ["record", "estimate", "po", "invoice"].includes(params?.entityType)
    ? params.entityType
    : "record";

  const [allCompanies, clients, statusLabels, permissions, activity, users, session] = await Promise.all([
    getAllCompanies(),
    getAllClientsForSettings({ compId, search }),
    getStatusLabels(entityType),
    getPermissions(),
    listActivity(),
    listUsers(),
    getServerSession(),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Settings</h1>

      <SettingsTabs active={tab} />

      {tab === "companies" && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">Companies</h2>
            <AddCompanyButton />
          </div>

          <div className="text-sm text-gray-600 dark:text-gray-400">{allCompanies.length} companies</div>

          <div className="max-h-[60vh] overflow-y-auto overflow-x-auto rounded-lg border border-gray-100 dark:border-gray-700">
            <table className="min-w-full divide-y divide-gray-100 text-sm dark:divide-gray-700">
              <thead className="sticky top-0 bg-gray-50 dark:bg-gray-900/40">
                <tr>
                  <th className="px-3 py-3 text-left font-medium text-gray-600 dark:text-gray-400">Company Name</th>
                  <th className="px-3 py-3 text-center font-medium text-gray-600 dark:text-gray-400">Status</th>
                  <th className="px-3 py-3 text-left font-medium text-gray-600 dark:text-gray-400">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {allCompanies.map((c) => (
                  <tr key={c.comp_id} className="hover:bg-gray-50">
                    <td className="px-3 py-3 text-gray-700 dark:text-gray-300">{c.company_name}</td>
                    <td className="px-3 py-3 text-center">
                      <StatusBadge status={c.status} />
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-3">
                        <EditCompanyButton compId={c.comp_id} companyName={c.company_name} />
                        <CompanyStatusButton compId={c.comp_id} status={c.status} />
                      </div>
                    </td>
                  </tr>
                ))}
                {allCompanies.length === 0 && (
                  <tr>
                    <td colSpan={3} className="px-3 py-6 text-center text-gray-500 dark:text-gray-400">
                      No companies found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === "clients" && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
              Clients{selectedCompany ? ` for ${selectedCompany.company_name}` : ""}
            </h2>
            <CompanySelect companies={companies} compId={compId} />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="min-w-0 flex-1">
              <SearchBox search={search} />
            </div>
            <AddClientButton key={compId} compId={compId} />
          </div>

          <div className="text-sm text-gray-600 dark:text-gray-400">{clients.length} clients</div>

          <div className="max-h-[60vh] overflow-y-auto overflow-x-auto rounded-lg border border-gray-100 dark:border-gray-700">
            <table className="min-w-full divide-y divide-gray-100 text-sm dark:divide-gray-700">
              <thead className="sticky top-0 bg-gray-50 dark:bg-gray-900/40">
                <tr>
                  <th className="px-3 py-3 text-left font-medium text-gray-600 dark:text-gray-400">Client Name</th>
                  <th className="px-3 py-3 text-center font-medium text-gray-600 dark:text-gray-400">Status</th>
                  <th className="px-3 py-3 text-left font-medium text-gray-600 dark:text-gray-400">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {clients.map((cl) => (
                  <tr key={cl.client_id} className="hover:bg-gray-50">
                    <td className="px-3 py-3 text-gray-700 dark:text-gray-300">{cl.client_name}</td>
                    <td className="px-3 py-3 text-center">
                      <StatusBadge status={cl.status} />
                    </td>
                    <td className="px-3 py-3">
                      <ClientStatusButton clientId={cl.client_id} status={cl.status} />
                    </td>
                  </tr>
                ))}
                {clients.length === 0 && (
                  <tr>
                    <td colSpan={3} className="px-3 py-6 text-center text-gray-500 dark:text-gray-400">
                      No clients found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === "labels" && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
              Status Labels for {ENTITY_TYPE_LABELS[entityType]}
            </h2>
            <EntityTypeSelect entityType={entityType} />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <AddStatusLabelButton key={entityType} entityType={entityType} />
          </div>

          <div className="text-sm text-gray-600 dark:text-gray-400">{statusLabels.length} labels</div>

          <div className="max-h-[60vh] overflow-y-auto overflow-x-auto rounded-lg border border-gray-100 dark:border-gray-700">
            <table className="min-w-full divide-y divide-gray-100 text-sm dark:divide-gray-700">
              <thead className="sticky top-0 bg-gray-50 dark:bg-gray-900/40">
                <tr>
                  <th className="px-3 py-3 text-left font-medium text-gray-600 dark:text-gray-400">Label Name</th>
                  <th className="px-3 py-3 text-left font-medium text-gray-600 dark:text-gray-400">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {statusLabels.map((l) => (
                  <tr key={l.label_id} className="hover:bg-gray-50">
                    <td className="px-3 py-3 text-gray-700 dark:text-gray-300">{l.label_name}</td>
                    <td className="px-3 py-3">
                      <DeleteStatusLabelButton labelId={l.label_id} />
                    </td>
                  </tr>
                ))}
                {statusLabels.length === 0 && (
                  <tr>
                    <td colSpan={2} className="px-3 py-6 text-center text-gray-500 dark:text-gray-400">
                      No status labels found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === "bulk" && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
              Bulk Upload{selectedCompany ? ` for ${selectedCompany.company_name}` : ""}
            </h2>
            <CompanySelect companies={companies} compId={compId} />
          </div>

          <p className="text-sm text-gray-600 dark:text-gray-400">
            Upload records, estimates, purchase orders, or invoices in bulk via Excel.
          </p>

          <div className="flex flex-wrap gap-2">
            <BulkUploadRecordsButton key={`bulk-records-${compId}`} compId={compId} />
            <BulkChainUploadButton key={`bulk-chain-${compId}`} compId={compId} />
            <BulkUploadButton
              key={`bulk-est-${compId}`}
              compId={compId}
              label="Bulk Upload (Estimates Only)"
              title="Bulk Upload Estimates"
              instructions="Columns: Record ID (must already exist and have no estimate yet), Estimate No, Estimate Date, Description, Amount, Document Link (optional Drive/URL link). If any row has a mistake, nothing is saved — fix it and upload again."
              endpoint="/api/estimates-admin/bulk"
              columns={ESTIMATE_BULK_COLUMNS}
              exampleRow={["RC-0001", "EST-EXAMPLE-1", new Date(), "Sample work description", 50000, ""]}
              templateName="estimates-bulk-upload-template.xlsx"
              entityLabel="estimate"
            />
            <BulkUploadButton
              key={`bulk-po-${compId}`}
              compId={compId}
              label="Bulk Upload (POs Only)"
              title="Bulk Upload Purchase Orders"
              instructions="Columns: Estimate No (must already exist and have no PO yet), PO No, PO Date, Description, Amount, Document Link (optional Drive/URL link). If any row has a mistake, nothing is saved — fix it and upload again."
              endpoint="/api/po-admin/bulk"
              columns={PO_BULK_COLUMNS}
              exampleRow={["EST-EXAMPLE-1", "PO-EXAMPLE-1", new Date(), "Sample work description", 50000, ""]}
              templateName="po-bulk-upload-template.xlsx"
              entityLabel="purchase order"
            />
            <BulkUploadButton
              key={`bulk-inv-${compId}`}
              compId={compId}
              label="Bulk Upload (Invoices Only)"
              title="Bulk Upload Invoices"
              instructions="Columns: PO No (must already exist), Invoice No, Invoice Date, Description, Invoice Amount, GST % (optional, defaults to 18), TDS % (optional, defaults to 2), Document Link (optional Drive/URL link). Multiple rows can bill the same PO (partial billing). If any row has a mistake, nothing is saved — fix it and upload again."
              endpoint="/api/invoices-admin/bulk"
              columns={INVOICE_BULK_COLUMNS}
              exampleRow={["PO-EXAMPLE-1", "INV-EXAMPLE-1", new Date(), "Sample work description", 50000, 18, 2, ""]}
              templateName="invoices-bulk-upload-template.xlsx"
              entityLabel="invoice"
            />
          </div>
        </div>
      )}

      {tab === "permissions" && (
        <div className="flex flex-col gap-3">
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">User Permissions</h2>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Controls what the &quot;user&quot; role can do. Admin always has full access.
          </p>
          <PermissionsForm permissions={permissions} />
        </div>
      )}

      {tab === "users" && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">Users</h2>
            <AddUserButton />
          </div>

          <div className="text-sm text-gray-600 dark:text-gray-400">{users.length} users</div>

          <div className="max-h-[60vh] overflow-y-auto overflow-x-auto rounded-lg border border-gray-100 dark:border-gray-700">
            <table className="min-w-full divide-y divide-gray-100 text-sm dark:divide-gray-700">
              <thead className="sticky top-0 bg-gray-50 dark:bg-gray-900/40">
                <tr>
                  <th className="px-3 py-3 text-left font-medium text-gray-600 dark:text-gray-400">Name</th>
                  <th className="px-3 py-3 text-left font-medium text-gray-600 dark:text-gray-400">Username</th>
                  <th className="px-3 py-3 text-center font-medium text-gray-600 dark:text-gray-400">Role</th>
                  <th className="px-3 py-3 text-center font-medium text-gray-600 dark:text-gray-400">Status</th>
                  <th className="px-3 py-3 text-left font-medium text-gray-600 dark:text-gray-400">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {users.map((u) => {
                  const isSelf = u.user_id === session?.userId;
                  return (
                    <tr key={u.user_id} className="hover:bg-gray-50">
                      <td className="px-3 py-3 text-gray-700 dark:text-gray-300">{u.name}</td>
                      <td className="px-3 py-3 text-gray-700 dark:text-gray-300">{u.username}</td>
                      <td className="px-3 py-3 text-center">
                        <UserRoleSelect userId={u.user_id} role={u.role} isSelf={isSelf} />
                      </td>
                      <td className="px-3 py-3 text-center">
                        <StatusBadge status={u.is_active ? "Active" : "Inactive"} />
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-3">
                          <UserActiveToggle userId={u.user_id} isActive={u.is_active} isSelf={isSelf} />
                          <ChangePasswordButton userId={u.user_id} />
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {users.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-3 py-6 text-center text-gray-500 dark:text-gray-400">
                      No users found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === "activity" && (
        <div className="flex flex-col gap-3">
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">Activity Log</h2>

          <div className="text-sm text-gray-600 dark:text-gray-400">{activity.length} activities</div>

          <div className="max-h-[60vh] overflow-y-auto overflow-x-auto rounded-lg border border-gray-100 dark:border-gray-700">
            <table className="min-w-full divide-y divide-gray-100 text-sm dark:divide-gray-700">
              <thead className="sticky top-0 bg-gray-50 dark:bg-gray-900/40">
                <tr>
                  <th className="px-3 py-3 text-left font-medium text-gray-600 dark:text-gray-400">When</th>
                  <th className="px-3 py-3 text-left font-medium text-gray-600 dark:text-gray-400">Type</th>
                  <th className="min-w-[320px] px-3 py-3 text-left font-medium text-gray-600 dark:text-gray-400">
                    Description
                  </th>
                  <th className="px-3 py-3 text-left font-medium text-gray-600 dark:text-gray-400">By</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {activity.map((entry) => (
                  <tr key={entry.log_id} className="hover:bg-gray-50">
                    <td className="px-3 py-3 whitespace-nowrap text-gray-500 dark:text-gray-400">
                      {formatDateTime(entry.created_at)}
                    </td>
                    <td className="px-3 py-3 text-gray-700 dark:text-gray-300">
                      {ACTIVITY_ENTITY_LABELS[entry.entity_type] || entry.entity_type}
                    </td>
                    <td className="px-3 py-3 text-gray-700 dark:text-gray-300">{entry.description}</td>
                    <td className="px-3 py-3 text-gray-700 dark:text-gray-300">
                      {entry.performed_by}
                      <span className="ml-1 text-xs text-gray-400 dark:text-gray-500">
                        ({entry.performed_by_role})
                      </span>
                    </td>
                  </tr>
                ))}
                {activity.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-3 py-6 text-center text-gray-500 dark:text-gray-400">
                      No activity yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
