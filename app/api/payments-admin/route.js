import { NextResponse } from "next/server";
import { createPayment } from "@/lib/paymentsAdmin";

export async function POST(request) {
  const body = await request.json();
  const { compId, clientId, paymentDate, amountReceived } = body;

  if (!compId || !clientId || !paymentDate || !amountReceived) {
    return NextResponse.json({ error: "All fields are required" }, { status: 400 });
  }

  try {
    const pyId = await createPayment(body);
    return NextResponse.json({ pyId });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
