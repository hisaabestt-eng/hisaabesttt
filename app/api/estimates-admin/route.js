import { NextResponse } from "next/server";
import { createEstimate } from "@/lib/estimatesAdmin";

export async function POST(request) {
  const { recordId, estNo, estDate, description, amount } = await request.json();

  if (!recordId || !estNo || !estDate || !description || !amount) {
    return NextResponse.json({ error: "All fields are required" }, { status: 400 });
  }

  try {
    const estId = await createEstimate({ recordId, estNo, estDate, description, amount });
    return NextResponse.json({ estId });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
