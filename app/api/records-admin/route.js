import { NextResponse } from "next/server";
import { createRecord } from "@/lib/recordsAdmin";
import { writeActivity } from "@/lib/activityLog";
import { getServerSession } from "@/lib/session";

export async function POST(request) {
  const body = await request.json();
  const { compId, clientId, recordDate, description, amount } = body;

  if (!compId || !clientId || !recordDate || !description || !amount) {
    return NextResponse.json({ error: "All fields are required" }, { status: 400 });
  }

  const recordId = await createRecord({ compId, clientId, recordDate, description, amount });

  const session = await getServerSession();
  await writeActivity({
    entityType: "record",
    entityId: recordId,
    action: "Created",
    description: `Created Record ${recordId} — ${description}`,
    performedBy: session.name,
    performedByRole: session.role,
  });

  return NextResponse.json({ recordId });
}
