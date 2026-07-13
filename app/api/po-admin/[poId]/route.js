import { NextResponse } from "next/server";
import { updatePO, deletePO } from "@/lib/poAdmin";

export async function PUT(request, { params }) {
  const { poId } = await params;
  const { poNo, poDate, description, amount } = await request.json();

  if (!poNo || !poDate || !description || !amount) {
    return NextResponse.json({ error: "All fields are required" }, { status: 400 });
  }

  try {
    await updatePO(poId, { poNo, poDate, description, amount });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}

export async function DELETE(request, { params }) {
  const { poId } = await params;
  try {
    await deletePO(poId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
