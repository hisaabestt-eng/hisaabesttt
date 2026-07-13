import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { saveDocument, saveDocumentLink } from "@/lib/documents";

export async function POST(request, { params }) {
  const { estId } = await params;
  const formData = await request.formData();
  const file = formData.get("file");
  const url = formData.get("url");

  if ((!file || typeof file === "string") && !url) {
    return NextResponse.json({ error: "No file or link provided" }, { status: 400 });
  }

  const { rows } = await pool.query(
    `SELECT e.record_id, r.comp_id FROM estimates e JOIN records r ON r.record_id = e.record_id WHERE e.est_id = $1`,
    [estId]
  );
  if (!rows[0]) {
    return NextResponse.json({ error: "Estimate not found" }, { status: 404 });
  }

  if (url) {
    const result = await saveDocumentLink({
      module: "Estimates",
      compId: rows[0].comp_id,
      recordId: rows[0].record_id,
      moduleId: estId,
      url,
    });
    return NextResponse.json(result);
  }

  const { fileName, publicPath } = await saveDocument({
    module: "Estimates",
    compId: rows[0].comp_id,
    recordId: rows[0].record_id,
    moduleId: estId,
    file,
  });

  return NextResponse.json({ fileName, publicPath });
}
