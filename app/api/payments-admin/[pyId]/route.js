import { NextResponse } from "next/server";
import { updatePayment, deletePayment } from "@/lib/paymentsAdmin";

export async function PUT(request, { params }) {
  const { pyId } = await params;
  const body = await request.json();
  const { paymentDate, remarks } = body;

  if (!paymentDate) {
    return NextResponse.json({ error: "Payment date is required" }, { status: 400 });
  }

  try {
    await updatePayment(pyId, { paymentDate, remarks });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}

export async function DELETE(request, { params }) {
  const { pyId } = await params;
  try {
    await deletePayment(pyId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
