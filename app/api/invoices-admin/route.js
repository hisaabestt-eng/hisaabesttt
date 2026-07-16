import { NextResponse } from "next/server";
import { createInvoice } from "@/lib/invoicesAdmin";
import { writeActivity } from "@/lib/activityLog";
import { getServerSession } from "@/lib/session";

export async function POST(request) {
  const body = await request.json();
  const { poId, estId, invoiceNo, invoiceDate, description, invoiceAmount } = body;

  if ((!poId && !estId) || !invoiceNo || !invoiceDate || !description || !invoiceAmount) {
    return NextResponse.json({ error: "All fields are required" }, { status: 400 });
  }

  try {
    const invId = await createInvoice(body);

    const session = await getServerSession();
    await writeActivity({
      entityType: "invoice",
      entityId: invId,
      action: "Created",
      description: `Created Invoice ${invoiceNo} — ${description}`,
      performedBy: session.name,
      performedByRole: session.role,
    });

    return NextResponse.json({ invId });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
