import { NextResponse } from "next/server";
import { deleteStatusLabel } from "@/lib/settingsAdmin";

export async function DELETE(request, { params }) {
  const { labelId } = await params;
  try {
    await deleteStatusLabel(labelId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
