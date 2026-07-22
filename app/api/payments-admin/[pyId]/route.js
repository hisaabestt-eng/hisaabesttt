import { NextResponse } from "next/server";
import { updatePayment, deletePayment } from "@/lib/paymentsAdmin";
import { writeActivity } from "@/lib/activityLog";
import { getServerSession } from "@/lib/session";

export async function PUT(request, { params }) {
  const { pyId } = await params;
  const body = await request.json();
  const { paymentDate, remarks, amountReceived } = body;

  if (!paymentDate) {
    return NextResponse.json({ error: "Payment date is required" }, { status: 400 });
  }
  if (amountReceived === undefined || amountReceived === "" || Number(amountReceived) <= 0) {
    return NextResponse.json({ error: "Amount received must be greater than 0" }, { status: 400 });
  }

  try {
    await updatePayment(pyId, { paymentDate, remarks, amountReceived });

    const session = await getServerSession();
    await writeActivity({
      entityType: "payment",
      entityId: pyId,
      action: "Updated",
      description: `Updated Payment ${pyId}`,
      performedBy: session.name,
      performedByRole: session.role,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}

export async function DELETE(request, { params }) {
  const { pyId } = await params;
  try {
    await deletePayment(pyId);

    const session = await getServerSession();
    await writeActivity({
      entityType: "payment",
      entityId: pyId,
      action: "Deleted",
      description: `Deleted Payment ${pyId}`,
      performedBy: session.name,
      performedByRole: session.role,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
