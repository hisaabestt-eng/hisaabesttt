import { NextResponse } from "next/server";
import { createPO } from "@/lib/poAdmin";
import { writeActivity } from "@/lib/activityLog";
import { getServerSession } from "@/lib/session";

export async function POST(request) {
  const { estId, poNo, poDate, description, amount } = await request.json();

  if (!estId || !poNo || !poDate || !description || !amount) {
    return NextResponse.json({ error: "All fields are required" }, { status: 400 });
  }

  try {
    const poId = await createPO({ estId, poNo, poDate, description, amount });

    const session = await getServerSession();
    await writeActivity({
      entityType: "po",
      entityId: poId,
      action: "Created",
      description: `Created Purchase Order ${poNo} — ${description}`,
      performedBy: session.name,
      performedByRole: session.role,
    });

    return NextResponse.json({ poId });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
