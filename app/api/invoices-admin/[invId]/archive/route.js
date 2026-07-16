import { NextResponse } from "next/server";
import { setInvoiceArchived } from "@/lib/invoicesAdmin";
import { writeActivity } from "@/lib/activityLog";
import { getServerSession } from "@/lib/session";

export async function POST(request, { params }) {
  const { invId } = await params;
  const { archived } = await request.json();
  try {
    await setInvoiceArchived(invId, Boolean(archived));

    const session = await getServerSession();
    await writeActivity({
      entityType: "invoice",
      entityId: invId,
      action: archived ? "Archived" : "Unarchived",
      description: `${archived ? "Archived" : "Unarchived"} Invoice ${invId}`,
      performedBy: session.name,
      performedByRole: session.role,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
