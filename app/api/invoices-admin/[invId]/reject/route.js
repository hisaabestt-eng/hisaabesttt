import { NextResponse } from "next/server";
import { setInvoiceRejected } from "@/lib/invoicesAdmin";
import { writeActivity } from "@/lib/activityLog";
import { getServerSession } from "@/lib/session";

export async function POST(request, { params }) {
  const { invId } = await params;
  const { rejected } = await request.json();
  try {
    await setInvoiceRejected(invId, Boolean(rejected));

    const session = await getServerSession();
    await writeActivity({
      entityType: "invoice",
      entityId: invId,
      action: rejected ? "Rejected" : "Unrejected",
      description: `${rejected ? "Rejected" : "Unrejected"} Invoice ${invId}`,
      performedBy: session.name,
      performedByRole: session.role,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
