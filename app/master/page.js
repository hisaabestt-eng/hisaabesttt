import { getCompanies, getClients, getDefaultCompany } from "@/lib/records";
import { getMasterTable } from "@/lib/masterTable";
import { getStatusLabels } from "@/lib/settingsAdmin";
import { getServerSession } from "@/lib/session";
import { getPermissions } from "@/lib/permissions";
import { CompanySelect, ClientSelect } from "@/components/MainFilterBar";
import { MasterTable } from "@/components/MasterTable";

export default async function MasterTablePage({ searchParams }) {
  const params = await searchParams;

  const [companies, clients] = await Promise.all([getCompanies(), getClients()]);
  const defaultCompany = params?.company ? null : await getDefaultCompany(companies);
  const compId = params?.company || defaultCompany?.comp_id || "";
  const clientId = params?.client || "";

  const [
    rows,
    recordStatusLabels,
    estimateStatusLabels,
    poStatusLabels,
    invoiceStatusLabels,
    session,
    permissions,
  ] = await Promise.all([
    getMasterTable({ compId, clientId }),
    getStatusLabels("record"),
    getStatusLabels("estimate"),
    getStatusLabels("po"),
    getStatusLabels("invoice"),
    getServerSession(),
    getPermissions(),
  ]);

  const canEdit = session.role === "admin" || permissions.can_edit;
  const canDelete = session.role === "admin" || permissions.can_delete;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Master Table</h1>
        <CompanySelect companies={companies} compId={compId} />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <ClientSelect
          clients={[{ client_id: "", client_name: "All clients", comp_id: compId }, ...clients]}
          compId={compId}
          clientId={clientId}
        />
      </div>

      <div className="text-sm text-gray-600 dark:text-gray-400">
        {rows.length} row{rows.length === 1 ? "" : "s"} — every Record through Invoice, one row per invoice
      </div>

      <MasterTable
        rows={rows}
        recordStatusLabels={recordStatusLabels}
        estimateStatusLabels={estimateStatusLabels}
        poStatusLabels={poStatusLabels}
        invoiceStatusLabels={invoiceStatusLabels}
        canEdit={canEdit}
        canDelete={canDelete}
      />
    </div>
  );
}
