import { NextResponse } from "next/server";
import { rejectPaymentAllocation } from "@/lib/paymentsAdmin";
import { writeActivity } from "@/lib/activityLog";
import { getServerSession } from "@/lib/session";

export async function POST(request, { params }) {
  const { pyId, invoiceNo } = await params;
  try {
    await rejectPaymentAllocation(pyId, invoiceNo);

    const session = await getServerSession();
    await writeActivity({
      entityType: "payment",
      entityId: pyId,
      action: "Rejected",
      description: `Rejected Payment ${pyId}'s allocation to Invoice ${invoiceNo}`,
      performedBy: session.name,
      performedByRole: session.role,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
