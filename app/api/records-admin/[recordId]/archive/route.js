import { NextResponse } from "next/server";
import { setRecordArchived } from "@/lib/recordsAdmin";

export async function POST(request, { params }) {
  const { recordId } = await params;
  const { archived } = await request.json();
  try {
    await setRecordArchived(recordId, Boolean(archived));
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
