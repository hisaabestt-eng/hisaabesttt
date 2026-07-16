import { pool } from "./db";
import { nextId } from "./ids";

// No login system yet (that's a later step), so uploads aren't attributed to
// a real user — every upload is recorded as "System" until auth lands.
const UPLOADED_BY_PLACEHOLDER = "System";

// Documents are always a pasted link (e.g. Google Drive) — cloud hosting
// (Vercel) has no persistent local disk to store real uploaded files on, so
// there's no file-upload path here, only this upsert-by-module_id link save.
export async function saveDocumentLink({ module, compId, recordId, moduleId, url }) {
  const label = "External Link";

  const { rows: existing } = await pool.query(
    "SELECT doc_id FROM documents WHERE module_id = $1",
    [moduleId]
  );
  if (existing[0]) {
    await pool.query(
      `UPDATE documents SET file_name = $1, document_type = $2, uploaded_by = $3, external_url = $4, updated_at = now()
       WHERE doc_id = $5`,
      [label, "Link", UPLOADED_BY_PLACEHOLDER, url, existing[0].doc_id]
    );
  } else {
    const docId = await nextId("documents", "doc_id", "DOC-");
    await pool.query(
      `INSERT INTO documents (doc_id, module, comp_id, record_id, module_id, file_name, document_type, uploaded_by, external_url, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, now(), now())`,
      [docId, module, compId, recordId, moduleId, label, "Link", UPLOADED_BY_PLACEHOLDER, url]
    );
  }

  return { fileName: label, url };
}
