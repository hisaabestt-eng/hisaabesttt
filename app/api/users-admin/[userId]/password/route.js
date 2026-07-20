import { NextResponse } from "next/server";
import { setUserPassword } from "@/lib/users";
import { writeActivity } from "@/lib/activityLog";
import { getServerSession } from "@/lib/session";

export async function POST(request, { params }) {
  const { userId } = await params;
  const { password } = await request.json();
  if (!password || password.length < 4) {
    return NextResponse.json({ error: "Password must be at least 4 characters" }, { status: 400 });
  }
  const targetUser = await setUserPassword(userId, password);

  const session = await getServerSession();
  const target = targetUser ? `${targetUser.name} (${targetUser.username})` : userId;
  await writeActivity({
    entityType: "user",
    entityId: userId,
    action: "Password Changed",
    description: `${session.name} changed the password for ${target}`,
    performedBy: session.name,
    performedByRole: session.role,
  });

  return NextResponse.json({ ok: true });
}
