import { NextResponse } from "next/server";
import { getRecordDetail } from "@/lib/recordDetail";

export async function GET(request, { params }) {
  const { recordId } = await params;
  const detail = await getRecordDetail(recordId);
  if (!detail) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(detail);
}
