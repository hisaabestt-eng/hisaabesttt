import { NextResponse } from "next/server";
import { updateRecord, deleteRecord } from "@/lib/recordsAdmin";

export async function PUT(request, { params }) {
  const { recordId } = await params;
  const { recordDate, description, amount } = await request.json();

  if (!recordDate || !description || !amount) {
    return NextResponse.json({ error: "All fields are required" }, { status: 400 });
  }

  await updateRecord(recordId, { recordDate, description, amount });
  return NextResponse.json({ ok: true });
}

export async function DELETE(request, { params }) {
  const { recordId } = await params;
  try {
    await deleteRecord(recordId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
