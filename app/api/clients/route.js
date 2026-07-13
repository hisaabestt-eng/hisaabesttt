import { NextResponse } from "next/server";
import { createClient } from "@/lib/recordsAdmin";

export async function POST(request) {
  const { clientName, compId } = await request.json();
  if (!clientName || !clientName.trim()) {
    return NextResponse.json({ error: "Client name is required" }, { status: 400 });
  }
  if (!compId) {
    return NextResponse.json({ error: "Company is required" }, { status: 400 });
  }
  const clientId = await createClient(clientName.trim(), compId);
  return NextResponse.json({ clientId, clientName: clientName.trim() });
}
