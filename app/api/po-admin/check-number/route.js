import { NextResponse } from "next/server";
import { poNoExists } from "@/lib/poAdmin";

export async function GET(request) {
  const poNo = request.nextUrl.searchParams.get("poNo");
  if (!poNo) {
    return NextResponse.json({ error: "poNo is required" }, { status: 400 });
  }
  const exists = await poNoExists(poNo);
  return NextResponse.json({ exists });
}
