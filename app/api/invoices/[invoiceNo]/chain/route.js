import { NextResponse } from "next/server";
import { getInvoiceChainDetail } from "@/lib/recordDetail";

export async function GET(request, { params }) {
  const { invoiceNo } = await params;
  const detail = await getInvoiceChainDetail(invoiceNo);
  if (!detail) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(detail);
}
