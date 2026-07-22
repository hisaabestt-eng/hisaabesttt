import { NextResponse } from "next/server";
import { updatePaymentProgress } from "@/lib/invoicesAdmin";
import { writeActivity } from "@/lib/activityLog";
import { getServerSession } from "@/lib/session";

export async function PATCH(request, { params }) {
  const { invId } = await params;
  const { scheduledPaymentDate, rejected, paymentPending } = await request.json();
  try {
    await updatePaymentProgress(invId, { scheduledPaymentDate, rejected, paymentPending });

    const session = await getServerSession();
    await writeActivity({
      entityType: "invoice",
      entityId: invId,
      action: "Updated",
      description: `Updated payment progress for Invoice ${invId}`,
      performedBy: session.name,
      performedByRole: session.role,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
