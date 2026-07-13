import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { saveDocument, saveDocumentLink } from "@/lib/documents";

export async function POST(request, { params }) {
  const { poId } = await params;
  const formData = await request.formData();
  const file = formData.get("file");
  const url = formData.get("url");

  if ((!file || typeof file === "string") && !url) {
    return NextResponse.json({ error: "No file or link provided" }, { status: 400 });
  }

  const { rows } = await pool.query(
    `SELECT po.record_id, r.comp_id
     FROM purchase_orders po JOIN records r ON r.record_id = po.record_id
     WHERE po.po_id = $1`,
    [poId]
  );
  if (!rows[0]) {
    return NextResponse.json({ error: "Purchase Order not found" }, { status: 404 });
  }

  if (url) {
    const result = await saveDocumentLink({
      module: "Purchase Order",
      compId: rows[0].comp_id,
      recordId: rows[0].record_id,
      moduleId: poId,
      url,
    });
    return NextResponse.json(result);
  }

  const { fileName, publicPath } = await saveDocument({
    module: "Purchase Order",
    compId: rows[0].comp_id,
    recordId: rows[0].record_id,
    moduleId: poId,
    file,
  });

  return NextResponse.json({ fileName, publicPath });
}
