import { NextResponse } from "next/server";
import { createRecord } from "@/lib/recordsAdmin";

export async function POST(request) {
  const body = await request.json();
  const { compId, clientId, recordDate, description, amount } = body;

  if (!compId || !clientId || !recordDate || !description || !amount) {
    return NextResponse.json({ error: "All fields are required" }, { status: 400 });
  }

  const recordId = await createRecord({ compId, clientId, recordDate, description, amount });
  return NextResponse.json({ recordId });
}
