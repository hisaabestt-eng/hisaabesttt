import { NextResponse } from "next/server";
import { setDefaultCompany } from "@/lib/settingsAdmin";

export async function POST(request, { params }) {
  const { compId } = await params;
  await setDefaultCompany(compId);
  return NextResponse.json({ ok: true });
}
