import { NextResponse } from "next/server";
import { bulkCreateRecords } from "@/lib/recordsAdmin";
import { writeActivity } from "@/lib/activityLog";
import { getServerSession } from "@/lib/session";

export async function POST(request) {
  const { compId, rows } = await request.json();
  if (!compId) {
    return NextResponse.json({ error: "Company is required" }, { status: 400 });
  }
  if (!Array.isArray(rows)) {
    return NextResponse.json({ error: "No rows to upload" }, { status: 400 });
  }

  try {
    const result = await bulkCreateRecords({ compId, rows });
    if (!result.ok) {
      return NextResponse.json({ errors: result.errors }, { status: 400 });
    }

    const session = await getServerSession();
    await writeActivity({
      entityType: "record",
      entityId: null,
      action: "Bulk Created",
      description: `Bulk uploaded ${result.created} record(s)`,
      performedBy: session.name,
      performedByRole: session.role,
    });

    return NextResponse.json({ created: result.created });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
