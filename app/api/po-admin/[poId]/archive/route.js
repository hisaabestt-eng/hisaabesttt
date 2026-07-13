import { NextResponse } from "next/server";
import { setPOArchived } from "@/lib/poAdmin";

export async function POST(request, { params }) {
  const { poId } = await params;
  const { archived } = await request.json();
  try {
    await setPOArchived(poId, Boolean(archived));
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
