import { NextResponse } from "next/server";
import { setInvoiceArchived } from "@/lib/invoicesAdmin";

export async function POST(request, { params }) {
  const { invId } = await params;
  const { archived } = await request.json();
  try {
    await setInvoiceArchived(invId, Boolean(archived));
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
