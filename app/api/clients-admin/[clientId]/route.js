import { NextResponse } from "next/server";
import { updateClient } from "@/lib/settingsAdmin";

export async function PUT(request, { params }) {
  const { clientId } = await params;
  const { clientName } = await request.json();
  if (!clientName || !clientName.trim()) {
    return NextResponse.json({ error: "Client name is required" }, { status: 400 });
  }
  await updateClient(clientId, clientName.trim());
  return NextResponse.json({ ok: true });
}
