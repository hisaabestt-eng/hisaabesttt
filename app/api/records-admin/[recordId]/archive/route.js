import { NextResponse } from "next/server";
import { setRecordArchived } from "@/lib/recordsAdmin";
import { writeActivity } from "@/lib/activityLog";
import { getServerSession } from "@/lib/session";

export async function POST(request, { params }) {
  const { recordId } = await params;
  const { archived } = await request.json();
  try {
    await setRecordArchived(recordId, Boolean(archived));

    const session = await getServerSession();
    await writeActivity({
      entityType: "record",
      entityId: recordId,
      action: archived ? "Archived" : "Unarchived",
      description: `${archived ? "Archived" : "Unarchived"} Record ${recordId}`,
      performedBy: session.name,
      performedByRole: session.role,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
