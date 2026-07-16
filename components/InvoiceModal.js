"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { DocumentField, EMPTY_DOC, uploadDocumentField } from "./DocumentField";
import { ConfirmDialog } from "./ConfirmDialog";
import { invoiceDisplayStatus } from "@/lib/status";

function toDateInputValue(value) {
  const d = value ? new Date(value) : new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatINR(value) {
  return Number(value || 0).toLocaleString("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  });
}

function AmountFields({
  invoiceAmount,
  setInvoiceAmount,
  gstPct,
  setGstPct,
  tdsPct,
  setTdsPct,
  disabled,
  poAmount,
  poInvoicedOthers,
  parentLabel = "PO",
}) {
  const amount = Number(invoiceAmount) || 0;
  const gstAmount = (amount * (Number(gstPct) || 0)) / 100;
  const tdsAmount = (amount * (Number(tdsPct) || 0)) / 100;
  const subtotal = amount + gstAmount;
  const total = subtotal - tdsAmount;

  const hasPOBalanceInfo = poAmount !== undefined;
  const balanceAvailable = hasPOBalanceInfo ? Number(poAmount) - Number(poInvoicedOthers || 0) : undefined;
  const exceedsPOBalance = hasPOBalanceInfo && amount > balanceAvailable + 0.01;

  return (
    <>
      {hasPOBalanceInfo && (
        <div className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-600 dark:text-gray-400">
          <div className="flex justify-between">
            <span>{parentLabel} Amount</span>
            <span>{formatINR(poAmount)}</span>
          </div>
          <div className="mt-0.5 flex justify-between">
            <span>Already invoiced (other invoices)</span>
            <span>{formatINR(poInvoicedOthers)}</span>
          </div>
          <div
            className={`mt-0.5 flex justify-between font-medium ${
              exceedsPOBalance ? "text-red-600" : "text-gray-700 dark:text-gray-300"
            }`}
          >
            <span>Balance available to invoice</span>
            <span>{formatINR(balanceAvailable)}</span>
          </div>
        </div>
      )}
      <div>
        <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">Invoice Amount</label>
        <input
          type="number"
          min="0"
          max={hasPOBalanceInfo ? balanceAvailable : undefined}
          step="0.01"
          value={invoiceAmount}
          onChange={(e) => setInvoiceAmount(e.target.value)}
          required
          disabled={disabled}
          className={`w-full rounded-md border px-2 py-1.5 text-sm disabled:bg-gray-100 disabled:text-gray-500 dark:bg-gray-700 dark:text-gray-100 dark:disabled:bg-gray-800 ${
            exceedsPOBalance ? "border-red-400" : "border-gray-300 dark:border-gray-600"
          }`}
        />
        {exceedsPOBalance && (
          <p className="mt-1 text-xs text-red-600">
            Exceeds the {parentLabel}&apos;s balance by {formatINR(amount - balanceAvailable)}.
          </p>
        )}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">GST % (e.g. 18)</label>
          <div className="flex items-center rounded-md border border-gray-300 focus-within:ring-1 focus-within:ring-gray-400">
            <input
              type="number"
              min="0"
              step="0.01"
              value={gstPct}
              onChange={(e) => setGstPct(e.target.value)}
              disabled={disabled}
              className="w-full appearance-none rounded border-0 px-2 py-1.5 text-right text-sm outline-none [-moz-appearance:textfield] disabled:bg-gray-100 disabled:text-gray-500 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            />
            <span className="pr-2 text-sm text-gray-400">%</span>
          </div>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">TDS % (e.g. 2)</label>
          <div className="flex items-center rounded-md border border-gray-300 focus-within:ring-1 focus-within:ring-gray-400">
            <input
              type="number"
              min="0"
              step="0.01"
              value={tdsPct}
              onChange={(e) => setTdsPct(e.target.value)}
              disabled={disabled}
              className="w-full appearance-none rounded border-0 px-2 py-1.5 text-right text-sm outline-none [-moz-appearance:textfield] disabled:bg-gray-100 disabled:text-gray-500 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            />
            <span className="pr-2 text-sm text-gray-400">%</span>
          </div>
        </div>
      </div>
      {disabled && (
        <p className="text-xs text-gray-400">
          A payment already exists — edit the amount on the Payments page instead.
        </p>
      )}
      <div className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm">
        <div className="flex justify-between text-gray-700 dark:text-gray-300">
          <span>Invoice Amount</span>
          <span>{formatINR(amount)}</span>
        </div>
        <div className="mt-1 flex justify-between text-gray-600 dark:text-gray-400">
          <span>Add: GST ({gstPct || 0}%)</span>
          <span>+{formatINR(gstAmount)}</span>
        </div>
        <div className="mt-1 flex justify-between border-t border-gray-200 pt-1 text-gray-700 dark:text-gray-300">
          <span>Subtotal</span>
          <span>{formatINR(subtotal)}</span>
        </div>
        <div className="mt-1 flex justify-between text-gray-600 dark:text-gray-400">
          <span>Less: TDS ({tdsPct || 0}%)</span>
          <span>-{formatINR(tdsAmount)}</span>
        </div>
        <div className="mt-1 flex justify-between border-t border-gray-200 pt-1 font-medium text-gray-900 dark:text-gray-100">
          <span>Invoice Total</span>
          <span>{formatINR(total)}</span>
        </div>
      </div>
    </>
  );
}

export function AddInvoiceButton({ pos, estimates = [] }) {
  const [open, setOpen] = useState(false);
  // Some clients skip PO and want an invoice straight off the Estimate —
  // "source" picks which picker (Purchase Order or Estimate) is in play.
  const [source, setSource] = useState(pos.length > 0 ? "po" : "estimate");
  const [poId, setPoId] = useState(pos[0]?.po_id || "");
  const [estId, setEstId] = useState(estimates[0]?.est_id || "");
  const [invoiceNo, setInvoiceNo] = useState("");
  const [invoiceDate, setInvoiceDate] = useState(toDateInputValue());
  const [description, setDescription] = useState(pos[0]?.description || "");
  const [invoiceAmount, setInvoiceAmount] = useState(pos[0]?.balance ?? pos[0]?.amount ?? "");
  const [gstPct, setGstPct] = useState("18");
  const [tdsPct, setTdsPct] = useState("2");
  const [doc, setDoc] = useState(EMPTY_DOC);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  // Two separate "are you sure" gates can fire before an invoice actually
  // saves: raising it straight off an Estimate with no PO, and reusing an
  // Invoice No that's already on a different record. Each needs its own
  // acknowledgement flag, reset whenever the thing it's about changes.
  const [confirmStep, setConfirmStep] = useState(null); // null | "noPO" | "duplicate"
  const [noPOAcknowledged, setNoPOAcknowledged] = useState(false);
  const [duplicateAcknowledged, setDuplicateAcknowledged] = useState(false);
  const router = useRouter();

  const selectedPO = pos.find((p) => p.po_id === poId);
  const selectedEstimate = estimates.find((e) => e.est_id === estId);
  const selectedParent = source === "po" ? selectedPO : selectedEstimate;
  const balanceAvailable = selectedParent ? Number(selectedParent.balance) : undefined;
  const exceedsParentBalance = selectedParent && Number(invoiceAmount) > balanceAvailable + 0.01;

  function handleInvoiceNoChange(e) {
    setInvoiceNo(e.target.value);
    setDuplicateAcknowledged(false);
  }

  function handleSourceChange(nextSource) {
    setSource(nextSource);
    setNoPOAcknowledged(false);
    if (nextSource === "po") {
      const po = pos[0];
      setPoId(po?.po_id || "");
      setDescription(po?.description || "");
      setInvoiceAmount(po?.balance ?? po?.amount ?? "");
    } else {
      const est = estimates[0];
      setEstId(est?.est_id || "");
      setDescription(est?.description || "");
      setInvoiceAmount(est?.balance ?? est?.amount ?? "");
    }
  }

  function handlePOChange(e) {
    const id = e.target.value;
    setPoId(id);
    const po = pos.find((p) => p.po_id === id);
    if (po) {
      setDescription(po.description);
      setInvoiceAmount(po.balance);
    }
  }

  function handleEstimateChange(e) {
    const id = e.target.value;
    setEstId(id);
    const est = estimates.find((e2) => e2.est_id === id);
    if (est) {
      setDescription(est.description);
      setInvoiceAmount(est.balance);
    }
  }

  // A PO's/Estimate's balance shrinks after each invoice raised against it,
  // but this component doesn't remount between opens — re-sync to the
  // current first option so the fields don't show a stale balance.
  function handleOpen() {
    if (pos.length === 0 && estimates.length === 0) {
      alert("No PO or Estimate with a balance left to invoice — add one first.");
      return;
    }
    const initialSource = pos.length > 0 ? "po" : "estimate";
    setSource(initialSource);
    setPoId(pos[0]?.po_id || "");
    setEstId(estimates[0]?.est_id || "");
    const parent = initialSource === "po" ? pos[0] : estimates[0];
    setDescription(parent?.description || "");
    setInvoiceAmount(parent?.balance ?? parent?.amount ?? "");
    setOpen(true);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    if (source === "estimate" && !noPOAcknowledged) {
      setConfirmStep("noPO");
      return;
    }

    await checkDuplicateThenSave();
  }

  async function checkDuplicateThenSave() {
    if (!duplicateAcknowledged) {
      setSaving(true);
      const checkRes = await fetch(`/api/invoices-admin/check-number?invoiceNo=${encodeURIComponent(invoiceNo)}`);
      const checkData = await checkRes.json();
      setSaving(false);
      if (checkData.exists) {
        setConfirmStep("duplicate");
        return;
      }
    }

    await saveInvoice();
  }

  async function saveInvoice() {
    setSaving(true);
    const res = await fetch("/api/invoices-admin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        poId: source === "po" ? poId : undefined,
        estId: source === "estimate" ? estId : undefined,
        invoiceNo,
        invoiceDate,
        description,
        invoiceAmount,
        gstPercentage: Number(gstPct) / 100,
        tdsPercentage: Number(tdsPct) / 100,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setSaving(false);
      setError(data.error || "Could not save invoice");
      return;
    }
    await uploadDocumentField(`/api/invoices-admin/${data.invId}/document`, doc);
    setSaving(false);
    setOpen(false);
    setInvoiceNo("");
    setNoPOAcknowledged(false);
    setDuplicateAcknowledged(false);
    setDoc(EMPTY_DOC);
    router.refresh();
  }

  function handleConfirmNoPO() {
    setConfirmStep(null);
    setNoPOAcknowledged(true);
    checkDuplicateThenSave();
  }

  function handleConfirmDuplicate() {
    setConfirmStep(null);
    setDuplicateAcknowledged(true);
    saveInvoice();
  }

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        className="rounded-full bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
      >
        + Add Invoice
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setOpen(false)}
        >
          <form
            onSubmit={handleSubmit}
            onClick={(e) => e.stopPropagation()}
            className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-lg bg-white dark:bg-gray-800 p-5 shadow-xl"
          >
            <h2 className="mb-3 text-base font-semibold text-gray-900 dark:text-gray-100">Add Invoice</h2>
            {error && <p className="mb-2 text-sm text-red-600">{error}</p>}

            <div className="flex flex-col gap-3">
              {pos.length > 0 && estimates.length > 0 && (
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">Raise invoice against</label>
                  <div className="flex gap-4 text-sm">
                    <label className="flex items-center gap-1.5">
                      <input
                        type="radio"
                        checked={source === "po"}
                        onChange={() => handleSourceChange("po")}
                      />
                      Purchase Order
                    </label>
                    <label className="flex items-center gap-1.5">
                      <input
                        type="radio"
                        checked={source === "estimate"}
                        onChange={() => handleSourceChange("estimate")}
                      />
                      Estimate directly — no PO
                    </label>
                  </div>
                </div>
              )}

              {source === "po" ? (
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">Purchase Order</label>
                  <select
                    value={poId}
                    onChange={handlePOChange}
                    required
                    className="w-full rounded-md border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 px-2 py-1.5 text-sm"
                  >
                    {pos.map((po) => (
                      <option key={po.po_id} value={po.po_id}>
                        {po.client_name} — {po.po_no} — {po.description} (balance {formatINR(po.balance)})
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">Estimate</label>
                  <select
                    value={estId}
                    onChange={handleEstimateChange}
                    required
                    className="w-full rounded-md border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 px-2 py-1.5 text-sm"
                  >
                    {estimates.map((est) => (
                      <option key={est.est_id} value={est.est_id}>
                        {est.client_name} — {est.est_no} — {est.description} (balance{" "}
                        {formatINR(est.balance)})
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-xs text-gray-400">No PO for this client&apos;s invoice — skips straight from Estimate to Invoice.</p>
                </div>
              )}

              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">Invoice No</label>
                <input
                  type="text"
                  value={invoiceNo}
                  onChange={handleInvoiceNoChange}
                  required
                  className="w-full rounded-md border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 px-2 py-1.5 text-sm"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">Invoice Date</label>
                <input
                  type="date"
                  value={invoiceDate}
                  onChange={(e) => setInvoiceDate(e.target.value)}
                  required
                  className="w-full rounded-md border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 px-2 py-1.5 text-sm"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">Description</label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  required
                  className="w-full rounded-md border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 px-2 py-1.5 text-sm"
                />
              </div>

              <AmountFields
                invoiceAmount={invoiceAmount}
                setInvoiceAmount={setInvoiceAmount}
                gstPct={gstPct}
                setGstPct={setGstPct}
                tdsPct={tdsPct}
                setTdsPct={setTdsPct}
                disabled={false}
                poAmount={selectedParent?.amount}
                poInvoicedOthers={selectedParent?.invoiced_amount}
                parentLabel={source === "po" ? "PO" : "Estimate"}
              />

              <DocumentField label="Document (optional)" doc={doc} setDoc={setDoc} />
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-md border px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-400 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving || exceedsParentBalance}
                className="rounded-full bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save"}
              </button>
            </div>
          </form>
        </div>
      )}

      <ConfirmDialog
        open={confirmStep === "noPO"}
        message="You're creating this invoice without a Purchase Order — it will go straight from the Estimate. Are you sure you want to continue?"
        onConfirm={handleConfirmNoPO}
        onCancel={() => setConfirmStep(null)}
      />
      <ConfirmDialog
        open={confirmStep === "duplicate"}
        message={`Invoice No "${invoiceNo}" has already been used before. Are you sure you want to continue?`}
        onConfirm={handleConfirmDuplicate}
        onCancel={() => setConfirmStep(null)}
      />
    </>
  );
}

export function EditInvoiceButton({ invoice, statusLabels = [] }) {
  const [open, setOpen] = useState(false);
  const [invoiceNo, setInvoiceNo] = useState(invoice.invoice_no);
  const [invoiceDate, setInvoiceDate] = useState(toDateInputValue(invoice.invoice_date));
  const [description, setDescription] = useState(invoice.description);
  const [invoiceAmount, setInvoiceAmount] = useState(invoice.invoice_amount);
  const [gstPct, setGstPct] = useState(Number(invoice.gst_percentage) * 100);
  const [tdsPct, setTdsPct] = useState(Number(invoice.tds_percentage) * 100);
  const [scheduledPaymentDate, setScheduledPaymentDate] = useState(
    invoice.scheduled_payment_date ? toDateInputValue(invoice.scheduled_payment_date) : toDateInputValue()
  );
  // "Status" collapses lifecycle (Raised/Archived/Cancelled) and submission
  // tracking into one dropdown — Submitted reveals a small inline panel for
  // the method + date, same idea as invoiceDisplayStatus in lib/status.js.
  const [statusChoice, setStatusChoice] = useState(invoiceDisplayStatus(invoice));
  const [submitMethod, setSubmitMethod] = useState(
    invoice.submission_status && invoice.submission_status !== "Not Submitted"
      ? invoice.submission_status
      : "Emailed"
  );
  const [submissionDate, setSubmissionDate] = useState(
    invoice.submission_date ? toDateInputValue(invoice.submission_date) : toDateInputValue()
  );
  // Once Submitted, payment progress is either "In Progress" (still
  // following up, no date) or "Scheduled" (client gave a date) — before
  // Submitted this doesn't apply at all, and once real money is allocated
  // the Progress badge overrides both to Partial Paid/Paid automatically.
  const [paymentProgress, setPaymentProgress] = useState(
    invoice.scheduled_payment_date ? "Scheduled" : "In Progress"
  );
  const [doc, setDoc] = useState(EMPTY_DOC);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  const isCancelled = invoice.lifecycle === "Cancelled";
  // Once real money has been allocated (Paid/Partial Paid), the amount
  // locks — Raised Not Submitted Yet, In Progress, and Scheduled are all
  // still "nothing received yet" states, so the amount stays editable through them.
  const amountLocked = invoice.status === "Paid" || invoice.status === "Partial Paid";
  // Balance is checked against whichever parent this invoice was actually
  // raised against — a PO, or (for clients who skip PO) the Estimate directly.
  const parentAmount = invoice.po_no ? invoice.po_amount : invoice.est_amount;
  const parentInvoicedOthers = invoice.po_no ? invoice.po_invoiced_others : invoice.est_invoiced_others;
  const balanceAvailable = Number(parentAmount) - Number(parentInvoicedOthers || 0);
  const exceedsPOBalance = !amountLocked && Number(invoiceAmount) > balanceAvailable + 0.01;

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSaving(true);

    const targetCancelled = statusChoice === "Cancelled";
    const targetArchived = statusChoice === "Archived";
    const targetRejected = statusChoice === "Rejected";
    const isRejected = invoice.lifecycle === "Rejected";
    const isCustomChoice = !["Raised", "Submitted", "Rejected", "Archived", "Cancelled"].includes(statusChoice);

    if (targetCancelled !== isCancelled) {
      const res = await fetch(`/api/invoices-admin/${invoice.inv_id}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cancelled: targetCancelled }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSaving(false);
        setError(data.error || "Could not update status");
        return;
      }
    }

    if (targetRejected !== isRejected) {
      const res = await fetch(`/api/invoices-admin/${invoice.inv_id}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rejected: targetRejected }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSaving(false);
        setError(data.error || "Could not update status");
        return;
      }
    }

    if (targetArchived !== invoice.is_archived) {
      const res = await fetch(`/api/invoices-admin/${invoice.inv_id}/archive`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ archived: targetArchived }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSaving(false);
        setError(data.error || "Could not update status");
        return;
      }
    }

    const res = await fetch(`/api/invoices-admin/${invoice.inv_id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        invoiceNo,
        invoiceDate,
        description,
        invoiceAmount,
        gstPercentage: Number(gstPct) / 100,
        tdsPercentage: Number(tdsPct) / 100,
        scheduledPaymentDate:
          statusChoice === "Submitted" && paymentProgress === "Scheduled" ? scheduledPaymentDate || null : null,
        submissionStatus: statusChoice === "Submitted" ? submitMethod : "Not Submitted",
        submissionDate: statusChoice === "Submitted" ? submissionDate || null : null,
        paymentRejected: statusChoice === "Submitted" && paymentProgress === "Rejected",
        customStatus: isCustomChoice ? statusChoice : null,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setSaving(false);
      setError(data.error || "Could not save changes");
      return;
    }
    await uploadDocumentField(`/api/invoices-admin/${invoice.inv_id}/document`, doc);
    setSaving(false);
    setOpen(false);
    router.refresh();
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-xs text-gray-600 underline hover:text-gray-900 dark:text-gray-100"
      >
        Edit
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setOpen(false)}
        >
          <form
            onSubmit={handleSubmit}
            onClick={(e) => e.stopPropagation()}
            className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-lg bg-white dark:bg-gray-800 p-5 shadow-xl"
          >
            <h2 className="mb-3 text-base font-semibold text-gray-900 dark:text-gray-100">Edit Invoice</h2>
            {error && <p className="mb-2 text-sm text-red-600">{error}</p>}

            <div className="flex flex-col gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">Invoice No</label>
                <input
                  type="text"
                  value={invoiceNo}
                  onChange={(e) => setInvoiceNo(e.target.value)}
                  required
                  className="w-full rounded-md border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 px-2 py-1.5 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">Invoice Date</label>
                <input
                  type="date"
                  value={invoiceDate}
                  onChange={(e) => setInvoiceDate(e.target.value)}
                  required
                  className="w-full rounded-md border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 px-2 py-1.5 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">Description</label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  required
                  className="w-full rounded-md border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 px-2 py-1.5 text-sm"
                />
              </div>

              <AmountFields
                invoiceAmount={invoiceAmount}
                setInvoiceAmount={setInvoiceAmount}
                gstPct={gstPct}
                setGstPct={setGstPct}
                tdsPct={tdsPct}
                setTdsPct={setTdsPct}
                disabled={amountLocked}
                poAmount={amountLocked ? undefined : parentAmount}
                poInvoicedOthers={amountLocked ? undefined : parentInvoicedOthers}
                parentLabel={invoice.po_no ? "PO" : "Estimate"}
              />

              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">Status</label>
                <select
                  value={statusChoice}
                  onChange={(e) => setStatusChoice(e.target.value)}
                  className="w-full rounded-md border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 px-2 py-1.5 text-sm"
                >
                  <option value="Raised">Raised</option>
                  {statusLabels.map((l) => (
                    <option key={l.label_id} value={l.label_name}>
                      {l.label_name}
                    </option>
                  ))}
                  <option value="Submitted">Submitted</option>
                  <option value="Rejected">Rejected</option>
                  <option value="Archived">Archived</option>
                  <option value="Cancelled">Cancelled</option>
                </select>
              </div>

              {statusChoice === "Submitted" && (
                <div className="rounded-md border border-gray-200 bg-gray-50 p-3">
                  <div className="mb-2">
                    <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">Submitted On</label>
                    <input
                      type="text"
                      value={submitMethod}
                      onChange={(e) => setSubmitMethod(e.target.value)}
                      placeholder="e.g. Email, Client Portal, WhatsApp"
                      className="w-full rounded-md border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 px-2 py-1.5 text-sm"
                    />
                  </div>
                  <div className="mb-2">
                    <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">
                      Submission Date
                    </label>
                    <input
                      type="date"
                      value={submissionDate}
                      onChange={(e) => setSubmissionDate(e.target.value)}
                      className="w-full rounded-md border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 px-2 py-1.5 text-sm"
                    />
                  </div>
                  {!(invoice.status === "Paid" || invoice.status === "Partial Paid") && (
                    <>
                      <div className={paymentProgress === "Scheduled" ? "mb-2" : ""}>
                        <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">
                          Payment Progress
                        </label>
                        <select
                          value={paymentProgress}
                          onChange={(e) => setPaymentProgress(e.target.value)}
                          className="w-full rounded-md border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 px-2 py-1.5 text-sm"
                        >
                          <option value="In Progress">In Progress</option>
                          <option value="Scheduled">Scheduled</option>
                          <option value="Rejected">Rejected</option>
                        </select>
                      </div>
                      {paymentProgress === "Scheduled" && (
                        <div>
                          <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">
                            Expected Payment Date
                          </label>
                          <input
                            type="date"
                            value={scheduledPaymentDate}
                            onChange={(e) => setScheduledPaymentDate(e.target.value)}
                            required
                            className="w-full rounded-md border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 px-2 py-1.5 text-sm"
                          />
                        </div>
                      )}
                      {paymentProgress === "Rejected" && (
                        <p className="text-xs text-red-600">This will mark the invoice as Rejected.</p>
                      )}
                    </>
                  )}
                </div>
              )}

              <DocumentField label="Replace Document (optional)" doc={doc} setDoc={setDoc} />
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-md border px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-400 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving || exceedsPOBalance}
                className="rounded-full bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save"}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}

export function DeleteInvoiceButton({ invId }) {
  const router = useRouter();

  async function handleDelete() {
    if (!confirm("Delete this invoice? This cannot be undone.")) return;
    const res = await fetch(`/api/invoices-admin/${invId}`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok) {
      alert(data.error || "Could not delete");
      return;
    }
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={handleDelete}
      className="text-xs text-red-600 underline hover:text-red-800"
    >
      Delete
    </button>
  );
}
