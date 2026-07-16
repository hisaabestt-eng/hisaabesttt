import { NextResponse } from "next/server";
import { setCompanyStatus } from "@/lib/settingsAdmin";

export async function POST(request, { params }) {
  const { compId } = await params;
  const { status } = await request.json();
  if (status !== "Active" && status !== "Inactive") {
    return NextResponse.json({ error: "Status must be Active or Inactive" }, { status: 400 });
  }
  try {
    await setCompanyStatus(compId, status);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
