import { NextResponse } from "next/server";
import { updateRecord, deleteRecord } from "@/lib/recordsAdmin";
import { writeActivity } from "@/lib/activityLog";
import { getServerSession } from "@/lib/session";

export async function PUT(request, { params }) {
  const { recordId } = await params;
  const { recordDate, description, amount, customStatus } = await request.json();

  if (!recordDate || !description || !amount) {
    return NextResponse.json({ error: "All fields are required" }, { status: 400 });
  }

  await updateRecord(recordId, { recordDate, description, amount, customStatus });

  const session = await getServerSession();
  await writeActivity({
    entityType: "record",
    entityId: recordId,
    action: "Updated",
    description: `Updated Record ${recordId} — ${description}`,
    performedBy: session.name,
    performedByRole: session.role,
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(request, { params }) {
  const { recordId } = await params;
  try {
    await deleteRecord(recordId);

    const session = await getServerSession();
    await writeActivity({
      entityType: "record",
      entityId: recordId,
      action: "Deleted",
      description: `Deleted Record ${recordId}`,
      performedBy: session.name,
      performedByRole: session.role,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
