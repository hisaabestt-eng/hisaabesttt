import { NextResponse } from "next/server";
import { createCompany } from "@/lib/settingsAdmin";

export async function POST(request) {
  const { companyName } = await request.json();
  if (!companyName || !companyName.trim()) {
    return NextResponse.json({ error: "Company name is required" }, { status: 400 });
  }
  const compId = await createCompany({ companyName: companyName.trim() });
  return NextResponse.json({ compId, companyName: companyName.trim() });
}
