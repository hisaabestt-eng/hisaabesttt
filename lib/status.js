// Once an invoice is marked Submitted (see invoiceDisplayStatus), its
// pre-payment progress splits into "Payment Pending" (submitted, no active
// follow-up yet), "In Progress" (actively following up), or "Scheduled"
// (client gave a date) — before Submitted it's just "Raised Not Submitted
// Yet". Real money allocated overrides all of these to Partial Paid / Paid
// regardless of submission state.
export const STATUS_STYLES = {
  "Estimate Pending": "bg-gray-400 text-white",
  "PO Pending": "bg-amber-500 text-white",
  "Invoice Pending": "bg-orange-500 text-white",
  "Raised Not Submitted Yet": "bg-slate-400 text-white",
  "Payment Pending": "bg-cyan-500 text-white",
  "In Progress": "bg-indigo-500 text-white",
  Scheduled: "bg-purple-500 text-white",
  Rejected: "bg-rose-500 text-white",
  "Partial Paid": "bg-blue-500 text-white",
  Paid: "bg-emerald-500 text-white",
  // An archived/cancelled record, estimate, or PO is a dead end — nothing
  // further down the chain can be created for it — so the Main page's
  // status badge needs these too, not just "X Pending". Colors match
  // LIFECYCLE_STYLES' own Archived/Cancelled below for consistency.
  "Record Archived": "bg-gray-400 text-white",
  "Record Cancelled": "bg-red-500 text-white",
  "Estimate Archived": "bg-gray-400 text-white",
  "Estimate Cancelled": "bg-red-500 text-white",
  "PO Archived": "bg-gray-400 text-white",
  "PO Cancelled": "bg-red-500 text-white",
};

// A row's own lifecycle state — separate from where it sits in the
// estimate -> PO -> invoice -> payment chain. "Submitted" only applies to
// Invoices (whether it's been sent to the client), layered on top of the
// same Raised/Archived/Cancelled set via invoiceDisplayStatus below.
export const LIFECYCLE_STYLES = {
  Raised: "bg-slate-500 text-white",
  Submitted: "bg-blue-500 text-white",
  Rejected: "bg-rose-500 text-white",
  Archived: "bg-gray-400 text-white",
  Cancelled: "bg-red-500 text-white",
};

// Custom status labels (managed in Settings) are pure cosmetic tags, added
// as a standalone peer state alongside Raised/Submitted/Rejected/Archived/
// Cancelled — selecting one clears the others, so a row's `custom_status`
// and its fixed lifecycle should never both be "active" at once, but this
// is checked first everywhere for defensiveness.
export const CUSTOM_STATUS_STYLE = "bg-yellow-500 text-white";

// A row's own lifecycle state — separate from where it sits in the
// estimate -> PO -> invoice -> payment chain. "Submitted" only applies to
// Invoices (whether it's been sent to the client), layered on top of the
// same Raised/Archived/Cancelled set via invoiceDisplayStatus below.
export function invoiceDisplayStatus(inv) {
  if (inv.custom_status) return inv.custom_status;
  if (inv.lifecycle === "Rejected") return "Rejected";
  if (inv.lifecycle === "Cancelled") return "Cancelled";
  if (inv.lifecycle === "Archived") return "Archived";
  if (inv.submission_status && inv.submission_status !== "Not Submitted") return "Submitted";
  return "Raised";
}

export function lifecycleLabel(isArchived) {
  return isArchived ? "Archived" : "Raised";
}

// A record/estimate/PO's plain "Status" column badge — the custom-label
// equivalent of invoiceDisplayStatus above, for the simpler Raised/Archived
// entities that don't have Submitted/Cancelled/Rejected of their own.
export function lifecycleDisplay(row) {
  if (row.custom_status) return { label: row.custom_status, style: CUSTOM_STATUS_STYLE };
  return { label: row.lifecycle, style: LIFECYCLE_STYLES[row.lifecycle] };
}

// When a row's own lifecycle is Rejected/Archived/Cancelled, the Progress
// column should say so directly instead of showing where it sat in the
// chain (e.g. "PO Pending") when that stopped being raised.
export function progressLabel(row, entityLabel) {
  if (row.custom_status) return row.custom_status;
  if (row.lifecycle === "Rejected") return `${entityLabel} Rejected`;
  if (row.lifecycle === "Archived") return `${entityLabel} Archived`;
  if (row.lifecycle === "Cancelled") return `${entityLabel} Cancelled`;
  return row.status;
}

// The Main page shows one row per record even when it's backed by several
// invoices (partial billing) — mirrors the Status badge logic exactly: a
// group of several invoices ("N invoices" badge) shows the record's own
// PO/estimate amount (the deal size), a search/progress filter narrowed
// down to exactly one invoice shows that invoice's own amount instead
// (invoice_amount, the pre-GST/TDS base figure — invoice_total is post-tax),
// and no invoices yet also falls back to the PO/estimate amount.
export function mainRowAmount(row) {
  const invoices = row.invoices || [];
  if (invoices.length === 1) return Number(invoices[0].invoice_amount) || 0;
  return Number(row.estimate_amount) || 0;
}

export function progressStyle(row) {
  if (row.custom_status) return CUSTOM_STATUS_STYLE;
  if (row.lifecycle === "Rejected") return LIFECYCLE_STYLES.Rejected;
  if (row.lifecycle === "Archived") return LIFECYCLE_STYLES.Archived;
  if (row.lifecycle === "Cancelled") return LIFECYCLE_STYLES.Cancelled;
  return STATUS_STYLES[row.status];
}

// The exact set of strings progressLabel() can produce for each page, used
// to populate the "Progress" multi-select filter. Custom labels (managed in
// Settings) are appended separately at render time since they're dynamic.
const BASE_PROGRESS_VALUES = [
  "Raised Not Submitted Yet",
  "Payment Pending",
  "In Progress",
  "Scheduled",
  "Rejected",
  "Partial Paid",
  "Paid",
];

export const MAIN_PROGRESS_OPTIONS = [
  "PO Pending",
  "Invoice Pending",
  ...BASE_PROGRESS_VALUES,
  "Invoice Archived",
  "Invoice Cancelled",
  "Record Archived",
  "Record Cancelled",
  "Estimate Archived",
  "Estimate Cancelled",
  "PO Archived",
  "PO Cancelled",
];

export const RECORD_PROGRESS_OPTIONS = [
  "Estimate Pending",
  "PO Pending",
  "Invoice Pending",
  ...BASE_PROGRESS_VALUES,
  "Record Archived",
  "Record Cancelled",
];

export const ESTIMATE_PROGRESS_OPTIONS = [
  "PO Pending",
  "Invoice Pending",
  ...BASE_PROGRESS_VALUES,
  "Estimate Archived",
  "Estimate Cancelled",
];

export const PO_PROGRESS_OPTIONS = [
  "Invoice Pending",
  ...BASE_PROGRESS_VALUES,
  "PO Archived",
  "PO Cancelled",
];

export const INVOICE_PROGRESS_OPTIONS = [
  ...BASE_PROGRESS_VALUES,
  "Invoice Rejected",
  "Invoice Archived",
  "Invoice Cancelled",
];
