import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { saveDocumentLink } from "@/lib/documents";
import { writeActivity } from "@/lib/activityLog";
import { getServerSession } from "@/lib/session";

export async function POST(request, { params }) {
  const { estId } = await params;
  const formData = await request.formData();
  const url = formData.get("url");

  if (!url) {
    return NextResponse.json({ error: "No link provided" }, { status: 400 });
  }

  const { rows } = await pool.query(
    `SELECT e.record_id, r.comp_id FROM estimates e JOIN records r ON r.record_id = e.record_id WHERE e.est_id = $1`,
    [estId]
  );
  if (!rows[0]) {
    return NextResponse.json({ error: "Estimate not found" }, { status: 404 });
  }

  const result = await saveDocumentLink({
    module: "Estimates",
    compId: rows[0].comp_id,
    recordId: rows[0].record_id,
    moduleId: estId,
    url,
  });

  const session = await getServerSession();
  await writeActivity({
    entityType: "estimate",
    entityId: estId,
    action: "Updated",
    description: `Attached document link to Estimate ${estId}`,
    performedBy: session.name,
    performedByRole: session.role,
  });

  return NextResponse.json(result);
}
