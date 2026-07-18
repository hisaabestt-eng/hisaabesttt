import { NextResponse } from "next/server";
import { invoiceNoExists } from "@/lib/invoicesAdmin";

export async function GET(request) {
  const invoiceNo = request.nextUrl.searchParams.get("invoiceNo");
  const compId = request.nextUrl.searchParams.get("compId");
  if (!invoiceNo) {
    return NextResponse.json({ error: "invoiceNo is required" }, { status: 400 });
  }
  const exists = await invoiceNoExists(invoiceNo, compId);
  return NextResponse.json({ exists });
}
