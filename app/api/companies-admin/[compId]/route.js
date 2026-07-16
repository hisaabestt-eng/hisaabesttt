import { NextResponse } from "next/server";
import { updateCompany } from "@/lib/settingsAdmin";

export async function PUT(request, { params }) {
  const { compId } = await params;
  const { companyName } = await request.json();
  if (!companyName || !companyName.trim()) {
    return NextResponse.json({ error: "Company name is required" }, { status: 400 });
  }
  await updateCompany(compId, companyName.trim());
  return NextResponse.json({ ok: true });
}
