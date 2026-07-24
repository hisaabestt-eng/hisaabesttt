// Records/Estimates/POs/Main page each show one row per record/estimate/PO
// even when it has several invoices underneath (partial billing) — searching
// for one specific invoice number still matches the whole row (correctly,
// since that's what "found it" means at the row level), but expanding it
// used to show every invoice in the group, not just the one searched for.
// This narrows a row's own invoice list down to just the ones the search
// term actually matched, so the breakdown shows only what was searched for
// instead of the whole group — but only when the term matches at least one
// invoice_no; if the row only matched via its description/client/etc., the
// full group still shows (there's nothing invoice-specific to narrow to).
export function narrowInvoicesToSearch(invoices, search) {
  if (!search || !invoices || invoices.length === 0) return invoices;
  const words = search.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return invoices;
  const matching = invoices.filter((inv) =>
    words.some((w) => inv.invoice_no && inv.invoice_no.toLowerCase().includes(w.toLowerCase()))
  );
  return matching.length > 0 ? matching : invoices;
}
