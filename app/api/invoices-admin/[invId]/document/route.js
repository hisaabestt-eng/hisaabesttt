import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { saveDocumentLink } from "@/lib/documents";
import { writeActivity } from "@/lib/activityLog";
import { getServerSession } from "@/lib/session";

export async function POST(request, { params }) {
  const { invId } = await params;
  const formData = await request.formData();
  const url = formData.get("url");

  if (!url) {
    return NextResponse.json({ error: "No link provided" }, { status: 400 });
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

  const result = await saveDocumentLink({
    module: "Invoice",
    compId: rows[0].comp_id,
    recordId: rows[0].record_id,
    moduleId: invId,
    url,
  });

  const session = await getServerSession();
  await writeActivity({
    entityType: "invoice",
    entityId: invId,
    action: "Updated",
    description: `Attached document link to Invoice ${invId}`,
    performedBy: session.name,
    performedByRole: session.role,
  });

  return NextResponse.json(result);
}
