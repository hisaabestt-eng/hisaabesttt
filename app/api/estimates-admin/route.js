import { NextResponse } from "next/server";
import { createEstimate } from "@/lib/estimatesAdmin";
import { writeActivity } from "@/lib/activityLog";
import { getServerSession } from "@/lib/session";

export async function POST(request) {
  const { recordId, estNo, estDate, description, amount } = await request.json();

  if (!recordId || !estNo || !estDate || !description || !amount) {
    return NextResponse.json({ error: "All fields are required" }, { status: 400 });
  }

  try {
    const estId = await createEstimate({ recordId, estNo, estDate, description, amount });

    const session = await getServerSession();
    await writeActivity({
      entityType: "estimate",
      entityId: estId,
      action: "Created",
      description: `Created Estimate ${estNo} — ${description}`,
      performedBy: session.name,
      performedByRole: session.role,
    });

    return NextResponse.json({ estId });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
