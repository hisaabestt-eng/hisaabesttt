import { NextResponse } from "next/server";
import { getStatusLabels, createStatusLabel } from "@/lib/settingsAdmin";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const entityType = searchParams.get("entityType");
  if (!entityType) {
    return NextResponse.json({ error: "entityType is required" }, { status: 400 });
  }
  const labels = await getStatusLabels(entityType);
  return NextResponse.json(labels);
}

export async function POST(request) {
  const { entityType, labelName } = await request.json();
  if (!entityType || !labelName || !labelName.trim()) {
    return NextResponse.json({ error: "Entity type and label name are required" }, { status: 400 });
  }
  try {
    const labelId = await createStatusLabel(entityType, labelName.trim());
    return NextResponse.json({ labelId, labelName: labelName.trim() });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
