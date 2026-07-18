import { NextResponse } from "next/server";
import { poNoExists } from "@/lib/poAdmin";

export async function GET(request) {
  const poNo = request.nextUrl.searchParams.get("poNo");
  const compId = request.nextUrl.searchParams.get("compId");
  if (!poNo) {
    return NextResponse.json({ error: "poNo is required" }, { status: 400 });
  }
  const exists = await poNoExists(poNo, compId);
  return NextResponse.json({ exists });
}
