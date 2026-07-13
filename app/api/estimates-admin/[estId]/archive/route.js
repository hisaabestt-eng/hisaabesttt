import { NextResponse } from "next/server";
import { setEstimateArchived } from "@/lib/estimatesAdmin";

export async function POST(request, { params }) {
  const { estId } = await params;
  const { archived } = await request.json();
  try {
    await setEstimateArchived(estId, Boolean(archived));
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
