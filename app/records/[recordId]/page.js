import { existsSync } from "fs";
import path from "path";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getRecordById, getRecordsWithoutEstimate } from "@/lib/recordsAdmin";
import { listEstimates, getSuggestedEstNo } from "@/lib/estimatesAdmin";
import { listPOs, getEstimatesWithoutPO } from "@/lib/poAdmin";
import { listInvoices, getPOsForPicker, getEstimatesForDirectInvoicePicker } from "@/lib/invoicesAdmin";
import { getStatusLabels } from "@/lib/settingsAdmin";
import { getServerSession } from "@/lib/session";
import { getPermissions } from "@/lib/permissions";
import {
  lifecycleDisplay,
  progressLabel,
  progressStyle,
  invoiceDisplayStatus,
  LIFECYCLE_STYLES,
  CUSTOM_STATUS_STYLE,
} from "@/lib/status";
import { EditRecordButton } from "@/components/RecordModal";
import { AddEstimateButton, EditEstimateButton, DeleteEstimateButton } from "@/components/EstimateModal";
import { AddPOButton, EditPOButton, DeletePOButton } from "@/components/POModal";
import { AddInvoiceButton, EditInvoiceButton, DeleteInvoiceButton } from "@/components/InvoiceModal";
import { DocumentPreviewLink } from "@/components/DocumentPreview";

const NO_FILTER = { search: "", progress: [], year: "", yearType: "calendar" };

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

function storedFileName(id, fileName) {
  return `${id}-${fileName}`;
}

function documentFileExists(dir, id, fileName) {
  if (!fileName) return false;
  return existsSync(path.join(process.cwd(), "public", "uploads", dir, storedFileName(id, fileName)));
}

function DocumentLink({ dir, id, externalUrl, docId, fileName }) {
  if (externalUrl) {
    return (
      <DocumentPreviewLink href={externalUrl} externalUrl={externalUrl} className="text-xs text-blue-600 underline">
        🔗 External Link
      </DocumentPreviewLink>
    );
  }
  if (docId && documentFileExists(dir, id, fileName)) {
    return (
      <DocumentPreviewLink
        href={`/uploads/${dir}/${storedFileName(id, fileName)}`}
        fileName={fileName}
        className="text-xs text-blue-600 underline"
      >
        📎 {fileName}
      </DocumentPreviewLink>
    );
  }
  if (docId) {
    return (
      <span className="text-xs text-gray-400" title="Uploaded before file storage was set up">
        📎 {fileName} (no file)
      </span>
    );
  }
  return <span className="text-xs text-gray-400">No document</span>;
}

function Section({ title, children }) {
  return (
    <div className="rounded-lg border border-gray-100 p-4 dark:border-gray-700">
      <h2 className="mb-3 text-base font-semibold text-gray-900 dark:text-gray-100">{title}</h2>
      {children}
    </div>
  );
}

function Field({ label, value }) {
  return (
    <div>
      <div className="text-xs font-medium uppercase tracking-wide text-gray-400">{label}</div>
      <div className="text-sm text-gray-800 dark:text-gray-100">{value}</div>
    </div>
  );
}

function StatusBadge({ label, style }) {
  return (
    <span
      className={`inline-flex min-w-[110px] items-center justify-center whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${style}`}
    >
      {label}
    </span>
  );
}

export default async function RecordDetailPage({ params }) {
  const { recordId } = await params;
  const record = await getRecordById(recordId);
  if (!record) notFound();

  const compId = record.comp_id;
  const clientId = record.client_id;

  const [
    session,
    permissions,
    recordStatusLabels,
    estimateStatusLabels,
    poStatusLabels,
    invoiceStatusLabels,
    estimates,
    pos,
    invoices,
    recordsWithoutEstimate,
    estimatesWithoutPO,
    posForPicker,
    estimatesForDirectInvoicePicker,
    suggestedEstNo,
  ] = await Promise.all([
    getServerSession(),
    getPermissions(),
    getStatusLabels("record"),
    getStatusLabels("estimate"),
    getStatusLabels("po"),
    getStatusLabels("invoice"),
    listEstimates({ compId, clientId: "", ...NO_FILTER }),
    listPOs({ compId, clientId: "", ...NO_FILTER }),
    listInvoices({ compId, clientId: "", ...NO_FILTER }),
    getRecordsWithoutEstimate(compId, clientId),
    getEstimatesWithoutPO(compId, clientId),
    getPOsForPicker(compId, clientId),
    getEstimatesForDirectInvoicePicker(compId, clientId),
    getSuggestedEstNo(compId),
  ]);

  const canAdd = session.role === "admin" || permissions.can_add;
  const canEdit = session.role === "admin" || permissions.can_edit;
  const canDelete = session.role === "admin" || permissions.can_delete;

  const estimate = record.est_id ? estimates.find((e) => e.est_id === record.est_id) : null;
  const po = record.po_id ? pos.find((p) => p.po_id === record.po_id) : null;
  const recordInvoices = po
    ? invoices.filter((inv) => inv.po_no === po.po_no)
    : estimate
      ? invoices.filter((inv) => inv.est_id === estimate.est_id)
      : [];

  const recordPickerForEstimate = recordsWithoutEstimate.filter((r) => r.record_id === record.record_id);
  const estimatePickerForPO = estimate ? estimatesWithoutPO.filter((e) => e.est_id === estimate.est_id) : [];
  const poPickerForInvoice = po ? posForPicker.filter((p) => p.po_id === po.po_id) : [];
  const estimatePickerForDirectInvoice =
    !po && estimate ? estimatesForDirectInvoicePicker.filter((e) => e.est_id === estimate.est_id) : [];
  const canAddInvoice = poPickerForInvoice.length > 0 || estimatePickerForDirectInvoice.length > 0;

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      <Link
        href={`/records?company=${record.comp_id}&client=${record.client_id}`}
        className="text-sm text-blue-600 underline"
      >
        ← Back to Records
      </Link>

      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{record.description}</h1>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {record.client_name} · Record ID {record.record_id}
          </p>
        </div>
        <StatusBadge {...lifecycleDisplay(record)} />
      </div>

      <Section title="Record">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Field label="Date" value={formatDate(record.record_date)} />
          <Field label="Amount" value={formatMoney(record.amount)} />
          <Field
            label="Progress"
            value={<StatusBadge label={progressLabel(record, "Record")} style={progressStyle(record)} />}
          />
        </div>
        {canEdit && (
          <div className="mt-3">
            <EditRecordButton record={record} statusLabels={recordStatusLabels} />
          </div>
        )}
      </Section>

      <Section title="Estimate">
        {estimate ? (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Field label="Estimate No" value={estimate.est_no} />
              <Field label="Date" value={formatDate(estimate.estimate_date)} />
              <Field label="Amount" value={formatMoney(estimate.amount)} />
              <Field label="Status" value={<StatusBadge {...lifecycleDisplay(estimate)} />} />
              <Field
                label="Document"
                value={
                  <DocumentLink
                    dir="estimates"
                    id={estimate.est_id}
                    externalUrl={estimate.external_url}
                    docId={estimate.doc_id}
                    fileName={estimate.file_name}
                  />
                }
              />
            </div>
            <div className="mt-3 flex gap-3">
              {canEdit && <EditEstimateButton estimate={estimate} statusLabels={estimateStatusLabels} />}
              {canDelete && !estimate.po_id && <DeleteEstimateButton estId={estimate.est_id} />}
            </div>
          </>
        ) : (
          <>
            <p className="text-sm text-gray-400">No estimate yet.</p>
            {canAdd && (
              <div className="mt-3">
                <AddEstimateButton
                  compId={compId}
                  recordsWithoutEstimate={recordPickerForEstimate}
                  suggestedEstNo={suggestedEstNo}
                />
              </div>
            )}
          </>
        )}
      </Section>

      {estimate && (
        <Section title="Purchase Order">
          {po ? (
            <>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Field label="PO No" value={po.po_no} />
                <Field label="Date" value={formatDate(po.po_date)} />
                <Field label="Amount" value={formatMoney(po.amount)} />
                <Field label="Invoiced" value={formatMoney(po.invoiced_amount)} />
                <Field label="Balance to Invoice" value={formatMoney(po.invoice_balance)} />
                <Field label="Status" value={<StatusBadge {...lifecycleDisplay(po)} />} />
                <Field
                  label="Document"
                  value={
                    <DocumentLink
                      dir="purchase-order"
                      id={po.po_id}
                      externalUrl={po.external_url}
                      docId={po.doc_id}
                      fileName={po.file_name}
                    />
                  }
                />
              </div>
              <div className="mt-3 flex gap-3">
                {canEdit && <EditPOButton po={po} statusLabels={poStatusLabels} />}
                {canDelete && !po.inv_id && <DeletePOButton poId={po.po_id} />}
              </div>
            </>
          ) : (
            <>
              <p className="text-sm text-gray-400">No purchase order yet.</p>
              {canAdd && (
                <div className="mt-3">
                  <AddPOButton compId={compId} estimatesWithoutPO={estimatePickerForPO} />
                </div>
              )}
            </>
          )}
        </Section>
      )}

      {estimate && (
        <Section title="Invoices">
          {recordInvoices.length === 0 ? (
            <p className="text-sm text-gray-400">No invoice yet.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {recordInvoices.map((inv) => (
                <div key={inv.inv_id} className="rounded-md border border-gray-100 p-3 dark:border-gray-700">
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <Field label="Invoice No" value={inv.invoice_no} />
                    <Field label="Date" value={formatDate(inv.invoice_date)} />
                    <Field label="Total" value={formatMoney(inv.invoice_total)} />
                    <Field
                      label="Status"
                      value={
                        <StatusBadge
                          label={invoiceDisplayStatus(inv)}
                          style={inv.custom_status ? CUSTOM_STATUS_STYLE : LIFECYCLE_STYLES[invoiceDisplayStatus(inv)]}
                        />
                      }
                    />
                    <Field
                      label="Progress"
                      value={<StatusBadge label={progressLabel(inv, "Invoice")} style={progressStyle(inv)} />}
                    />
                    <Field
                      label="Document"
                      value={
                        <DocumentLink
                          dir="invoice"
                          id={inv.inv_id}
                          externalUrl={inv.external_url}
                          docId={inv.doc_id}
                          fileName={inv.file_name}
                        />
                      }
                    />
                  </div>
                  <div className="mt-3 flex gap-3">
                    {canEdit && <EditInvoiceButton invoice={inv} statusLabels={invoiceStatusLabels} />}
                    {canDelete && inv.status !== "Paid" && inv.status !== "Partial Paid" && (
                      <DeleteInvoiceButton invId={inv.inv_id} />
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
          {canAdd && canAddInvoice && (
            <div className="mt-3">
              <AddInvoiceButton compId={compId} pos={poPickerForInvoice} estimates={estimatePickerForDirectInvoice} />
            </div>
          )}
        </Section>
      )}
    </div>
  );
}
