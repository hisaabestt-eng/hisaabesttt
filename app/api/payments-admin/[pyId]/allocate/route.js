import { NextResponse } from "next/server";
import { allocatePayment } from "@/lib/paymentsAdmin";
import { writeActivity } from "@/lib/activityLog";
import { getServerSession } from "@/lib/session";

export async function POST(request, { params }) {
  const { pyId } = await params;
  const body = await request.json();
  const { allocationDate, allocations } = body;

  if (!allocationDate) {
    return NextResponse.json({ error: "Allocation date is required" }, { status: 400 });
  }

  try {
    await allocatePayment(pyId, { allocationDate, allocations });

    const session = await getServerSession();
    const invoiceNos = (allocations || []).map((a) => a.invoiceNo).filter(Boolean).join(", ");
    await writeActivity({
      entityType: "payment",
      entityId: pyId,
      action: "Allocated",
      description: `Allocated Payment ${pyId} to invoice(s): ${invoiceNos || "—"}`,
      performedBy: session.name,
      performedByRole: session.role,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
