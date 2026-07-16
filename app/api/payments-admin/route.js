import { NextResponse } from "next/server";
import { createPayment } from "@/lib/paymentsAdmin";
import { writeActivity } from "@/lib/activityLog";
import { getServerSession } from "@/lib/session";

export async function POST(request) {
  const body = await request.json();
  const { compId, clientId, paymentDate, amountReceived } = body;

  if (!compId || !clientId || !paymentDate || !amountReceived) {
    return NextResponse.json({ error: "All fields are required" }, { status: 400 });
  }

  try {
    const pyId = await createPayment(body);

    const session = await getServerSession();
    await writeActivity({
      entityType: "payment",
      entityId: pyId,
      action: "Created",
      description: `Recorded Payment of ₹${amountReceived}`,
      performedBy: session.name,
      performedByRole: session.role,
    });

    return NextResponse.json({ pyId });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
