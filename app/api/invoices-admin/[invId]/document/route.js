import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { saveDocument, saveDocumentLink } from "@/lib/documents";

export async function POST(request, { params }) {
  const { invId } = await params;
  const formData = await request.formData();
  const file = formData.get("file");
  const url = formData.get("url");

  if ((!file || typeof file === "string") && !url) {
    return NextResponse.json({ error: "No file or link provided" }, { status: 400 });
  }

  const { rows } = await pool.query(
    `SELECT i.record_id, r.comp_id
     FROM invoices i JOIN records r ON r.record_id = i.record_id
     WHERE i.inv_id = $1`,
    [invId]
  );
  if (!rows[0]) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }

  if (url) {
    const result = await saveDocumentLink({
      module: "Invoice",
      compId: rows[0].comp_id,
      recordId: rows[0].record_id,
      moduleId: invId,
      url,
    });
    return NextResponse.json(result);
  }

  const { fileName, publicPath } = await saveDocument({
    module: "Invoice",
    compId: rows[0].comp_id,
    recordId: rows[0].record_id,
    moduleId: invId,
    file,
  });

  return NextResponse.json({ fileName, publicPath });
}
