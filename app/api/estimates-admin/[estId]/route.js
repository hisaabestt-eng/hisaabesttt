import { NextResponse } from "next/server";
import { updateEstimate, deleteEstimate } from "@/lib/estimatesAdmin";

export async function PUT(request, { params }) {
  const { estId } = await params;
  const { estNo, estDate, description, amount } = await request.json();

  if (!estNo || !estDate || !description || !amount) {
    return NextResponse.json({ error: "All fields are required" }, { status: 400 });
  }

  try {
    await updateEstimate(estId, { estNo, estDate, description, amount });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}

export async function DELETE(request, { params }) {
  const { estId } = await params;
  try {
    await deleteEstimate(estId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
