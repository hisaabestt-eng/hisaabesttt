// Once an invoice is marked Submitted (see invoiceDisplayStatus), its
// pre-payment progress splits into "In Progress" (still following up, no
// date yet) or "Scheduled" (client gave a date) — before Submitted it's
// just "Raised Not Submitted Yet". Real money allocated overrides all of
// these to Partial Paid / Paid regardless of submission state.
export const STATUS_STYLES = {
  "Estimate Pending": "bg-gray-400 text-white",
  "PO Pending": "bg-amber-500 text-white",
  "Invoice Pending": "bg-orange-500 text-white",
  "Raised Not Submitted Yet": "bg-slate-400 text-white",
  "In Progress": "bg-indigo-500 text-white",
  Scheduled: "bg-purple-500 text-white",
  Rejected: "bg-rose-500 text-white",
  "Partial Paid": "bg-blue-500 text-white",
  Paid: "bg-emerald-500 text-white",
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
