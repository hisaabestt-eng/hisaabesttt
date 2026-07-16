import { NextResponse } from "next/server";
import { updateEstimate, deleteEstimate } from "@/lib/estimatesAdmin";
import { writeActivity } from "@/lib/activityLog";
import { getServerSession } from "@/lib/session";

export async function PUT(request, { params }) {
  const { estId } = await params;
  const { estNo, estDate, description, amount, customStatus } = await request.json();

  if (!estNo || !estDate || !description || !amount) {
    return NextResponse.json({ error: "All fields are required" }, { status: 400 });
  }

  try {
    await updateEstimate(estId, { estNo, estDate, description, amount, customStatus });

    const session = await getServerSession();
    await writeActivity({
      entityType: "estimate",
      entityId: estId,
      action: "Updated",
      description: `Updated Estimate ${estNo} — ${description}`,
      performedBy: session.name,
      performedByRole: session.role,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}

export async function DELETE(request, { params }) {
  const { estId } = await params;
  try {
    await deleteEstimate(estId);

    const session = await getServerSession();
    await writeActivity({
      entityType: "estimate",
      entityId: estId,
      action: "Deleted",
      description: `Deleted Estimate ${estId}`,
      performedBy: session.name,
      performedByRole: session.role,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
