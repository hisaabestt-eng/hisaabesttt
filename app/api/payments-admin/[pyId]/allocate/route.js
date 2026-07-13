import { NextResponse } from "next/server";
import { allocatePayment } from "@/lib/paymentsAdmin";

export async function POST(request, { params }) {
  const { pyId } = await params;
  const body = await request.json();
  const { allocationDate, allocations } = body;

  if (!allocationDate) {
    return NextResponse.json({ error: "Allocation date is required" }, { status: 400 });
  }

  try {
    await allocatePayment(pyId, { allocationDate, allocations });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
