import { NextResponse } from "next/server";
import { updatePO, deletePO } from "@/lib/poAdmin";
import { writeActivity } from "@/lib/activityLog";
import { getServerSession } from "@/lib/session";

export async function PUT(request, { params }) {
  const { poId } = await params;
  const { poNo, poDate, description, amount, customStatus } = await request.json();

  if (!poNo || !poDate || !description || !amount) {
    return NextResponse.json({ error: "All fields are required" }, { status: 400 });
  }

  try {
    await updatePO(poId, { poNo, poDate, description, amount, customStatus });

    const session = await getServerSession();
    await writeActivity({
      entityType: "po",
      entityId: poId,
      action: "Updated",
      description: `Updated Purchase Order ${poNo} — ${description}`,
      performedBy: session.name,
      performedByRole: session.role,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}

export async function DELETE(request, { params }) {
  const { poId } = await params;
  try {
    await deletePO(poId);

    const session = await getServerSession();
    await writeActivity({
      entityType: "po",
      entityId: poId,
      action: "Deleted",
      description: `Deleted Purchase Order ${poId}`,
      performedBy: session.name,
      performedByRole: session.role,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
