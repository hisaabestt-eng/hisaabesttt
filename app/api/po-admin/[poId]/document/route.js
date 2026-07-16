import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { saveDocumentLink } from "@/lib/documents";
import { writeActivity } from "@/lib/activityLog";
import { getServerSession } from "@/lib/session";

export async function POST(request, { params }) {
  const { poId } = await params;
  const formData = await request.formData();
  const url = formData.get("url");

  if (!url) {
    return NextResponse.json({ error: "No link provided" }, { status: 400 });
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

  const result = await saveDocumentLink({
    module: "Purchase Order",
    compId: rows[0].comp_id,
    recordId: rows[0].record_id,
    moduleId: poId,
    url,
  });

  const session = await getServerSession();
  await writeActivity({
    entityType: "po",
    entityId: poId,
    action: "Updated",
    description: `Attached document link to Purchase Order ${poId}`,
    performedBy: session.name,
    performedByRole: session.role,
  });

  return NextResponse.json(result);
}
