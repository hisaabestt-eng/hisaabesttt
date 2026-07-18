import { NextResponse } from "next/server";
import { estNoExists } from "@/lib/estimatesAdmin";

export async function GET(request) {
  const estNo = request.nextUrl.searchParams.get("estNo");
  const compId = request.nextUrl.searchParams.get("compId");
  if (!estNo) {
    return NextResponse.json({ error: "estNo is required" }, { status: 400 });
  }
  const exists = await estNoExists(estNo, compId);
  return NextResponse.json({ exists });
}
