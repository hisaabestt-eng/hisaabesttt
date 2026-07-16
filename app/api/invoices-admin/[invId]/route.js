import { NextResponse } from "next/server";
import { updateInvoice, deleteInvoice } from "@/lib/invoicesAdmin";
import { writeActivity } from "@/lib/activityLog";
import { getServerSession } from "@/lib/session";

export async function PUT(request, { params }) {
  const { invId } = await params;
  const body = await request.json();
  const { invoiceNo, invoiceDate, description, invoiceAmount } = body;

  if (!invoiceNo || !invoiceDate || !description || !invoiceAmount) {
    return NextResponse.json({ error: "All fields are required" }, { status: 400 });
  }

  try {
    await updateInvoice(invId, body);

    const session = await getServerSession();
    await writeActivity({
      entityType: "invoice",
      entityId: invId,
      action: "Updated",
      description: `Updated Invoice ${invoiceNo} — ${description}`,
      performedBy: session.name,
      performedByRole: session.role,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}

export async function DELETE(request, { params }) {
  const { invId } = await params;
  try {
    await deleteInvoice(invId);

    const session = await getServerSession();
    await writeActivity({
      entityType: "invoice",
      entityId: invId,
      action: "Deleted",
      description: `Deleted Invoice ${invId}`,
      performedBy: session.name,
      performedByRole: session.role,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
