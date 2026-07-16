import { NextResponse } from "next/server";
import { setDefaultClientForCompany } from "@/lib/settingsAdmin";

export async function POST(request, { params }) {
  const { compId } = await params;
  const { clientId } = await request.json();
  await setDefaultClientForCompany(compId, clientId || null);
  return NextResponse.json({ ok: true });
}
