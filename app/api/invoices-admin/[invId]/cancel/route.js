import { NextResponse } from "next/server";
import { setInvoiceCancelled } from "@/lib/invoicesAdmin";
import { writeActivity } from "@/lib/activityLog";
import { getServerSession } from "@/lib/session";

export async function POST(request, { params }) {
  const { invId } = await params;
  const { cancelled } = await request.json();
  try {
    await setInvoiceCancelled(invId, Boolean(cancelled));

    const session = await getServerSession();
    await writeActivity({
      entityType: "invoice",
      entityId: invId,
      action: cancelled ? "Cancelled" : "Uncancelled",
      description: `${cancelled ? "Cancelled" : "Uncancelled"} Invoice ${invId}`,
      performedBy: session.name,
      performedByRole: session.role,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
