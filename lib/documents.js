import { pool } from "./db";
import { nextId } from "./ids";
import { writeFile, mkdir, unlink } from "fs/promises";
import path from "path";

const UPLOAD_ROOT = path.join(process.cwd(), "public", "uploads");

function guessDocumentType(fileName) {
  const ext = fileName.split(".").pop()?.toLowerCase();
  if (ext === "pdf") return "PDF";
  if (["xls", "xlsx", "csv"].includes(ext)) return "Excel";
  if (["doc", "docx"].includes(ext)) return "Word";
  if (["png", "jpg", "jpeg", "gif"].includes(ext)) return "Image";
  return "Other";
}

// No login system yet (that's a later step), so uploads aren't attributed to
// a real user — every upload is recorded as "System" until auth lands.
const UPLOADED_BY_PLACEHOLDER = "System";

export async function saveDocument({ module, compId, recordId, moduleId, file }) {
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const dirRelative = module.toLowerCase().replace(/\s+/g, "-");
  const dirAbsolute = path.join(UPLOAD_ROOT, dirRelative);
  await mkdir(dirAbsolute, { recursive: true });

  const storedName = `${moduleId}-${safeName}`;
  const bytes = Buffer.from(await file.arrayBuffer());
  await writeFile(path.join(dirAbsolute, storedName), bytes);

  const publicPath = `/uploads/${dirRelative}/${storedName}`;

  const { rows: existing } = await pool.query(
    "SELECT doc_id FROM documents WHERE module_id = $1",
    [moduleId]
  );
  if (existing[0]) {
    await pool.query(
      `UPDATE documents SET file_name = $1, document_type = $2, uploaded_by = $3, external_url = NULL, updated_at = now()
       WHERE doc_id = $4`,
      [safeName, guessDocumentType(safeName), UPLOADED_BY_PLACEHOLDER, existing[0].doc_id]
    );
  } else {
    const docId = await nextId("documents", "doc_id", "DOC-");
    await pool.query(
      `INSERT INTO documents (doc_id, module, comp_id, record_id, module_id, file_name, document_type, uploaded_by, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, now(), now())`,
      [docId, module, compId, recordId, moduleId, safeName, guessDocumentType(safeName), UPLOADED_BY_PLACEHOLDER]
    );
  }

  return { fileName: safeName, publicPath };
}

// Alternative to saveDocument for a pasted link (e.g. Google Drive) instead
// of an uploaded file — same upsert-by-module_id behavior, but no disk I/O.
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
