import { NextResponse } from "next/server";
import { getInvoiceDocument } from "@/lib/recordDetail";

export async function GET(request, { params }) {
  const { invoiceNo } = await params;
  const document = await getInvoiceDocument(invoiceNo);
  return NextResponse.json({ document });
}
