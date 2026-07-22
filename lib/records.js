import { pool } from "./db";

// Includes Inactive companies too (not just Active) — CompanySelect marks
// them "(Inactive)" rather than hiding them, so a URL that already points at
// one still renders correctly and its history stays reachable.
export async function getCompanies() {
  const { rows } = await pool.query(
    "SELECT comp_id, company_name, status, is_default, default_client_id FROM companies ORDER BY (status = 'Active') DESC, company_name"
  );
  return rows;
}

// An admin can explicitly pin one company as the default (Settings); that
// wins whenever set. Otherwise fall back to the first company that actually
// has records (landing on an alphabetically-first but empty company looks
// broken), falling back further to the first company overall.
export async function getDefaultCompany(companies) {
  const explicitDefault = companies.find((c) => c.is_default);
  if (explicitDefault) return explicitDefault;

  const { rows } = await pool.query("SELECT DISTINCT comp_id FROM records");
  const companiesWithData = new Set(rows.map((r) => r.comp_id));
  return companies.find((c) => companiesWithData.has(c.comp_id)) || companies[0];
}

// Includes Inactive clients too, same reasoning as getCompanies() above, and
// clients with zero records yet — a client belongs to whatever company it
// was created under (clients.comp_id), regardless of whether any records
// exist for it.
export async function getClients() {
  const { rows } = await pool.query(
    "SELECT client_id, client_name, status, comp_id FROM clients ORDER BY client_name"
  );
  return rows;
}

// Records without an estimate yet belong on a future "Record" page, not here.
const BASE_CTE = `
  WITH base AS (
    SELECT
      r.record_id,
      c.comp_id,
      c.company_name,
      cl.client_id,
      cl.client_name,
      e.est_id,
      e.est_no,
      e.estimate_date,
      e.amount AS estimate_amount,
      e.description AS estimate_description,
      e.tags,
      po.po_id,
      po.po_no,
      CASE WHEN po.po_id IS NOT NULL THEN inv_stats.invoice_count ELSE direct_inv.invoice_count END AS invoice_count,
      CASE WHEN po.po_id IS NOT NULL THEN inv_stats.total_invoice_amount ELSE direct_inv.total_invoice_amount END AS total_invoice_amount,
      CASE WHEN po.po_id IS NOT NULL THEN inv_stats.total_allocated ELSE direct_inv.total_allocated END AS total_allocated,
      CASE WHEN po.po_id IS NOT NULL THEN inv_stats.scheduled_payment_date ELSE direct_inv.scheduled_payment_date END AS scheduled_payment_date,
      -- One record can have several invoices (partial billing against the
      -- same PO/Estimate) with different progress each — the aggregate
      -- "status" above picks one badge for the row, but this list lets the
      -- UI show every invoice's own status on expand, instead of hiding them.
      COALESCE(
        CASE WHEN po.po_id IS NOT NULL THEN inv_list.invoices ELSE direct_inv_list.invoices END,
        '[]'::json
      ) AS invoices,
      -- Lets search match an individual invoice's own status (e.g.
      -- "Scheduled") even when that's not the aggregate "status" above —
      -- a record with one Paid and one Scheduled invoice rolls up to
      -- "Partial Paid" and would otherwise never surface for "Scheduled".
      (
        SELECT string_agg(elem->>'status', ' ')
        FROM json_array_elements(
          COALESCE(CASE WHEN po.po_id IS NOT NULL THEN inv_list.invoices ELSE direct_inv_list.invoices END, '[]'::json)
        ) elem
      ) AS invoice_statuses_text,
      -- A PO-based record and a direct-invoice (no PO) record are mutually
      -- exclusive, so branch on which path this record took — an empty
      -- inv_stats/direct_inv still returns invoice_count = 0 (not NULL,
      -- since COUNT(*) over zero rows is 0), so COALESCE-picking between the
      -- two would always land on whichever is checked first.
      CASE
        WHEN po.po_id IS NULL AND COALESCE(direct_inv.invoice_count, 0) = 0 THEN 'PO Pending'
        WHEN po.po_id IS NOT NULL THEN
          CASE
            WHEN COALESCE(inv_stats.invoice_count, 0) = 0 THEN 'Invoice Pending'
            WHEN COALESCE(inv_stats.total_allocated, 0) > 0
                 AND inv_stats.total_allocated >= inv_stats.total_invoice_amount THEN 'Paid'
            WHEN COALESCE(inv_stats.total_allocated, 0) > 0 THEN 'Partial Paid'
            WHEN inv_stats.any_rejected THEN 'Rejected'
            WHEN inv_stats.any_submitted THEN
              CASE
                WHEN inv_stats.any_scheduled THEN 'Scheduled'
                WHEN inv_stats.any_payment_pending THEN 'Payment Pending'
                ELSE 'In Progress'
              END
            ELSE 'Raised Not Submitted Yet'
          END
        ELSE
          CASE
            WHEN COALESCE(direct_inv.invoice_count, 0) = 0 THEN 'Invoice Pending'
            WHEN COALESCE(direct_inv.total_allocated, 0) > 0
                 AND direct_inv.total_allocated >= direct_inv.total_invoice_amount THEN 'Paid'
            WHEN COALESCE(direct_inv.total_allocated, 0) > 0 THEN 'Partial Paid'
            WHEN direct_inv.any_rejected THEN 'Rejected'
            WHEN direct_inv.any_submitted THEN
              CASE
                WHEN direct_inv.any_scheduled THEN 'Scheduled'
                WHEN direct_inv.any_payment_pending THEN 'Payment Pending'
                ELSE 'In Progress'
              END
            ELSE 'Raised Not Submitted Yet'
          END
      END AS status
    FROM records r
    JOIN companies c ON c.comp_id = r.comp_id
    JOIN clients cl ON cl.client_id = r.client_id
    JOIN estimates e ON e.record_id = r.record_id
    LEFT JOIN purchase_orders po ON po.estimate_id = e.est_id
    LEFT JOIN LATERAL (
      SELECT
        count(*) AS invoice_count,
        sum(i.invoice_total) AS total_invoice_amount,
        sum(COALESCE(pa_sum.allocated, 0)) AS total_allocated,
        -- "Submitted"/"Scheduled" should only reflect invoices that still have
        -- money outstanding — an invoice that's already fully paid shouldn't
        -- keep flagging the record as Scheduled just because it was submitted
        -- on its way to being paid.
        bool_or(i.submission_status IS NOT NULL AND i.submission_status <> 'Not Submitted')
          FILTER (WHERE i.invoice_total > COALESCE(pa_sum.allocated, 0) AND trim(lower(i.status)) NOT LIKE '%reject%') AS any_submitted,
        bool_or(i.scheduled_payment_date IS NOT NULL)
          FILTER (WHERE i.invoice_total > COALESCE(pa_sum.allocated, 0) AND trim(lower(i.status)) NOT LIKE '%reject%') AS any_scheduled,
        bool_or(i.payment_pending)
          FILTER (WHERE i.invoice_total > COALESCE(pa_sum.allocated, 0) AND trim(lower(i.status)) NOT LIKE '%reject%') AS any_payment_pending,
        min(i.scheduled_payment_date)
          FILTER (WHERE i.invoice_total > COALESCE(pa_sum.allocated, 0) AND trim(lower(i.status)) NOT LIKE '%reject%') AS scheduled_payment_date,
        bool_or(trim(lower(i.status)) LIKE '%reject%')
          FILTER (WHERE i.invoice_total > COALESCE(pa_sum.allocated, 0)) AS any_rejected
      FROM invoices i
      LEFT JOIN LATERAL (
        SELECT sum(allocated_amount) AS allocated
        FROM payment_allocations pa
        WHERE pa.invoice_no = i.invoice_no
      ) pa_sum ON true
      WHERE i.po_no = po.po_no
    ) inv_stats ON true
    LEFT JOIN LATERAL (
      -- Invoices raised straight off the Estimate, skipping the PO step.
      SELECT
        count(*) AS invoice_count,
        sum(i.invoice_total) AS total_invoice_amount,
        sum(COALESCE(pa_sum.allocated, 0)) AS total_allocated,
        bool_or(i.submission_status IS NOT NULL AND i.submission_status <> 'Not Submitted')
          FILTER (WHERE i.invoice_total > COALESCE(pa_sum.allocated, 0) AND trim(lower(i.status)) NOT LIKE '%reject%') AS any_submitted,
        bool_or(i.scheduled_payment_date IS NOT NULL)
          FILTER (WHERE i.invoice_total > COALESCE(pa_sum.allocated, 0) AND trim(lower(i.status)) NOT LIKE '%reject%') AS any_scheduled,
        bool_or(i.payment_pending)
          FILTER (WHERE i.invoice_total > COALESCE(pa_sum.allocated, 0) AND trim(lower(i.status)) NOT LIKE '%reject%') AS any_payment_pending,
        min(i.scheduled_payment_date)
          FILTER (WHERE i.invoice_total > COALESCE(pa_sum.allocated, 0) AND trim(lower(i.status)) NOT LIKE '%reject%') AS scheduled_payment_date,
        bool_or(trim(lower(i.status)) LIKE '%reject%')
          FILTER (WHERE i.invoice_total > COALESCE(pa_sum.allocated, 0)) AS any_rejected
      FROM invoices i
      LEFT JOIN LATERAL (
        SELECT sum(allocated_amount) AS allocated
        FROM payment_allocations pa
        WHERE pa.invoice_no = i.invoice_no
      ) pa_sum ON true
      WHERE i.est_id = e.est_id
    ) direct_inv ON true
    LEFT JOIN LATERAL (
      SELECT json_agg(json_build_object(
        'inv_id', i2.inv_id,
        'invoice_no', i2.invoice_no,
        'invoice_date', i2.invoice_date,
        'invoice_amount', i2.invoice_amount,
        'invoice_total', i2.invoice_total,
        'is_archived', i2.is_archived,
        'scheduled_payment_date', i2.scheduled_payment_date,
        'status', CASE
          WHEN COALESCE(pa2.allocated, 0) > 0 AND pa2.allocated >= i2.invoice_total THEN 'Paid'
          WHEN COALESCE(pa2.allocated, 0) > 0 THEN 'Partial Paid'
          WHEN i2.submission_status IS NOT NULL AND i2.submission_status <> 'Not Submitted' THEN
            CASE
              WHEN i2.scheduled_payment_date IS NOT NULL THEN 'Scheduled'
              WHEN i2.payment_pending THEN 'Payment Pending'
              ELSE 'In Progress'
            END
          ELSE 'Raised Not Submitted Yet'
        END,
        'lifecycle', CASE
          WHEN trim(lower(i2.status)) LIKE '%reject%' THEN 'Rejected'
          WHEN trim(lower(i2.status)) LIKE '%canc%' THEN 'Cancelled'
          WHEN i2.is_archived OR trim(lower(i2.status)) LIKE '%archiv%' THEN 'Archived'
          ELSE 'Raised'
        END
      ) ORDER BY i2.invoice_date) AS invoices
      FROM invoices i2
      LEFT JOIN LATERAL (
        SELECT sum(allocated_amount) AS allocated FROM payment_allocations pa WHERE pa.invoice_no = i2.invoice_no
      ) pa2 ON true
      WHERE i2.po_no = po.po_no
    ) inv_list ON true
    LEFT JOIN LATERAL (
      -- Same per-invoice breakdown for invoices raised straight off the Estimate.
      SELECT json_agg(json_build_object(
        'inv_id', i2.inv_id,
        'invoice_no', i2.invoice_no,
        'invoice_date', i2.invoice_date,
        'invoice_amount', i2.invoice_amount,
        'invoice_total', i2.invoice_total,
        'is_archived', i2.is_archived,
        'scheduled_payment_date', i2.scheduled_payment_date,
        'status', CASE
          WHEN COALESCE(pa2.allocated, 0) > 0 AND pa2.allocated >= i2.invoice_total THEN 'Paid'
          WHEN COALESCE(pa2.allocated, 0) > 0 THEN 'Partial Paid'
          WHEN i2.submission_status IS NOT NULL AND i2.submission_status <> 'Not Submitted' THEN
            CASE
              WHEN i2.scheduled_payment_date IS NOT NULL THEN 'Scheduled'
              WHEN i2.payment_pending THEN 'Payment Pending'
              ELSE 'In Progress'
            END
          ELSE 'Raised Not Submitted Yet'
        END,
        'lifecycle', CASE
          WHEN trim(lower(i2.status)) LIKE '%reject%' THEN 'Rejected'
          WHEN trim(lower(i2.status)) LIKE '%canc%' THEN 'Cancelled'
          WHEN i2.is_archived OR trim(lower(i2.status)) LIKE '%archiv%' THEN 'Archived'
          ELSE 'Raised'
        END
      ) ORDER BY i2.invoice_date) AS invoices
      FROM invoices i2
      LEFT JOIN LATERAL (
        SELECT sum(allocated_amount) AS allocated FROM payment_allocations pa WHERE pa.invoice_no = i2.invoice_no
      ) pa2 ON true
      WHERE i2.est_id = e.est_id
    ) direct_inv_list ON true
  )
`;

export async function getRecordsOverview({ compId, clientId, search, progress, year, yearType }) {
  const conditions = [];
  const params = [];

  if (compId) {
    params.push(compId);
    conditions.push(`comp_id = $${params.length}`);
  }

  if (clientId) {
    params.push(clientId);
    conditions.push(`client_id = $${params.length}`);
  }

  // Matches either the record's own aggregate progress, or — since that
  // aggregate picks one overall state and a multi-invoice record can have
  // invoices sitting in completely different states at once — any single
  // invoice's own progress/lifecycle, so filtering by e.g. "Rejected" finds
  // this record even when its aggregate rolled up to "Partial Paid" because
  // a different invoice already got paid.
  if (progress && progress.length > 0) {
    params.push(progress);
    const p = `$${params.length}`;
    conditions.push(`(
      status = ANY(${p})
      OR EXISTS (
        SELECT 1 FROM json_array_elements(invoices) elem
        WHERE (
          CASE
            WHEN elem->>'lifecycle' = 'Rejected' THEN 'Rejected'
            WHEN elem->>'lifecycle' = 'Archived' THEN 'Invoice Archived'
            WHEN elem->>'lifecycle' = 'Cancelled' THEN 'Invoice Cancelled'
            ELSE elem->>'status'
          END
        ) = ANY(${p})
      )
    )`);
  }

  if (year) {
    if (yearType === "fy") {
      params.push(`${year}-04-01`);
      conditions.push(`estimate_date >= $${params.length}::date`);
      params.push(`${Number(year) + 1}-03-31`);
      conditions.push(`estimate_date <= $${params.length}::date`);
    } else {
      params.push(`${year}-01-01`);
      conditions.push(`estimate_date >= $${params.length}::date`);
      params.push(`${year}-12-31`);
      conditions.push(`estimate_date <= $${params.length}::date`);
    }
  }

  // Each word must match somewhere (AND across words, OR across fields), so
  // "Podcast urgent" finds rows matching both "Podcast" and "urgent".
  const searchWords = search ? search.trim().split(/\s+/).filter(Boolean) : [];
  for (const word of searchWords) {
    params.push(`%${word}%`);
    const p = `$${params.length}`;
    conditions.push(
      `(estimate_description ILIKE ${p} OR client_name ILIKE ${p} OR est_no ILIKE ${p} OR po_no ILIKE ${p} OR status ILIKE ${p} OR invoice_statuses_text ILIKE ${p} OR tags ILIKE ${p} OR estimate_amount::text ILIKE ${p})`
    );
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  const query = `
    ${BASE_CTE}
    SELECT * FROM base
    ${whereClause}
    ORDER BY estimate_date ASC, record_id ASC
  `;

  const { rows } = await pool.query(query, params);
  return { rows, total: rows.length };
}
