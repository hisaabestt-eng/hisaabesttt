// "Scheduled Payment" is reserved for the Payments page (detailed mode),
// not computed yet.
export const STATUS_STYLES = {
  "Estimate Pending": "bg-gray-100 text-gray-700",
  "PO Pending": "bg-amber-100 text-amber-800",
  "Invoice Pending": "bg-orange-100 text-orange-800",
  "Payment Pending": "bg-red-100 text-red-700",
  "Scheduled Payment": "bg-purple-100 text-purple-700",
  "Partial Paid": "bg-blue-100 text-blue-700",
  Paid: "bg-green-100 text-green-700",
};

// A row's own lifecycle state — separate from where it sits in the
// estimate -> PO -> invoice -> payment chain.
export const LIFECYCLE_STYLES = {
  Raised: "bg-slate-100 text-slate-700",
  Archived: "bg-gray-200 text-gray-500",
  Cancelled: "bg-red-50 text-red-500",
};

export function lifecycleLabel(isArchived) {
  return isArchived ? "Archived" : "Raised";
}

// When a row's own lifecycle is Archived/Cancelled, the Progress column
// should say so directly instead of showing where it sat in the chain
// (e.g. "PO Pending") when that stopped being raised.
export function progressLabel(row, entityLabel) {
  if (row.lifecycle === "Archived") return `${entityLabel} Archived`;
  if (row.lifecycle === "Cancelled") return `${entityLabel} Cancelled`;
  return row.status;
}

export function progressStyle(row) {
  if (row.lifecycle === "Archived") return LIFECYCLE_STYLES.Archived;
  if (row.lifecycle === "Cancelled") return LIFECYCLE_STYLES.Cancelled;
  return STATUS_STYLES[row.status];
}
