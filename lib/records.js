import { pool } from "./db";

export async function getCompanies() {
  const { rows } = await pool.query(
    "SELECT comp_id, company_name FROM companies WHERE status = 'Active' ORDER BY company_name"
  );
  return rows;
}

// Landing on a company with zero records (e.g. alphabetically-first but
// empty) looks broken, so default to the first company that actually has
// records, falling back to the first company overall.
export async function getDefaultCompany(companies) {
  const { rows } = await pool.query("SELECT DISTINCT comp_id FROM records");
  const companiesWithData = new Set(rows.map((r) => r.comp_id));
  return companies.find((c) => companiesWithData.has(c.comp_id)) || companies[0];
}

// clients.comp_id is not reliable seed data (always 'CMP-0001'), so we derive
// each client's real company from the records they actually appear on.
export async function getClients() {
  const { rows } = await pool.query(`
    SELECT DISTINCT cl.client_id, cl.client_name, r.comp_id
    FROM clients cl
    JOIN records r ON r.client_id = cl.client_id
    WHERE cl.status = 'Active'
    ORDER BY cl.client_name
  `);
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
      inv_stats.invoice_count,
      inv_stats.total_invoice_amount,
      inv_stats.total_allocated,
      CASE
        WHEN po.po_id IS NULL THEN 'PO Pending'
        WHEN COALESCE(inv_stats.invoice_count, 0) = 0 THEN 'Invoice Pending'
        WHEN COALESCE(inv_stats.total_allocated, 0) <= 0 THEN 'Payment Pending'
        WHEN inv_stats.total_allocated >= inv_stats.total_invoice_amount THEN 'Paid'
        ELSE 'Partial Paid'
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
        sum(COALESCE(pa_sum.allocated, 0)) AS total_allocated
      FROM invoices i
      LEFT JOIN LATERAL (
        SELECT sum(allocated_amount) AS allocated
        FROM payment_allocations pa
        WHERE pa.invoice_no = i.invoice_no
      ) pa_sum ON true
      WHERE i.po_no = po.po_no
    ) inv_stats ON true
  )
`;

export async function getRecordsOverview({ compId, clientId, search }) {
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

  // Each word must match somewhere (AND across words, OR across fields), so
  // "Podcast urgent" finds rows matching both "Podcast" and "urgent".
  const searchWords = search ? search.trim().split(/\s+/).filter(Boolean) : [];
  for (const word of searchWords) {
    params.push(`%${word}%`);
    const p = `$${params.length}`;
    conditions.push(
      `(estimate_description ILIKE ${p} OR client_name ILIKE ${p} OR est_no ILIKE ${p} OR po_no ILIKE ${p} OR status ILIKE ${p} OR tags ILIKE ${p})`
    );
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  const query = `
    ${BASE_CTE}
    SELECT * FROM base
    ${whereClause}
    ORDER BY estimate_date DESC, record_id DESC
  `;

  const { rows } = await pool.query(query, params);
  return { rows, total: rows.length };
}
