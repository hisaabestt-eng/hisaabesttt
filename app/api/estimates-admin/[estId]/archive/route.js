import { NextResponse } from "next/server";
import { setEstimateArchived } from "@/lib/estimatesAdmin";
import { writeActivity } from "@/lib/activityLog";
import { getServerSession } from "@/lib/session";

export async function POST(request, { params }) {
  const { estId } = await params;
  const { archived } = await request.json();
  try {
    await setEstimateArchived(estId, Boolean(archived));

    const session = await getServerSession();
    await writeActivity({
      entityType: "estimate",
      entityId: estId,
      action: archived ? "Archived" : "Unarchived",
      description: `${archived ? "Archived" : "Unarchived"} Estimate ${estId}`,
      performedBy: session.name,
      performedByRole: session.role,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
