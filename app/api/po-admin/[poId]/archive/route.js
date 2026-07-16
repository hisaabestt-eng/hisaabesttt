import { NextResponse } from "next/server";
import { setPOArchived } from "@/lib/poAdmin";
import { writeActivity } from "@/lib/activityLog";
import { getServerSession } from "@/lib/session";

export async function POST(request, { params }) {
  const { poId } = await params;
  const { archived } = await request.json();
  try {
    await setPOArchived(poId, Boolean(archived));

    const session = await getServerSession();
    await writeActivity({
      entityType: "po",
      entityId: poId,
      action: archived ? "Archived" : "Unarchived",
      description: `${archived ? "Archived" : "Unarchived"} Purchase Order ${poId}`,
      performedBy: session.name,
      performedByRole: session.role,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
