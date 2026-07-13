import { NextResponse } from "next/server";
import { createInvoice } from "@/lib/invoicesAdmin";

export async function POST(request) {
  const body = await request.json();
  const { poId, invoiceNo, invoiceDate, description, invoiceAmount } = body;

  if (!poId || !invoiceNo || !invoiceDate || !description || !invoiceAmount) {
    return NextResponse.json({ error: "All fields are required" }, { status: 400 });
  }

  try {
    const invId = await createInvoice(body);
    return NextResponse.json({ invId });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
