import { NextResponse } from "next/server";
import { setClientStatus } from "@/lib/settingsAdmin";

export async function POST(request, { params }) {
  const { clientId } = await params;
  const { status } = await request.json();
  if (status !== "Active" && status !== "Inactive") {
    return NextResponse.json({ error: "Status must be Active or Inactive" }, { status: 400 });
  }
  try {
    await setClientStatus(clientId, status);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
