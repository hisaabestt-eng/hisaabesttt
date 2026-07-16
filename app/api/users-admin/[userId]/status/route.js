import { NextResponse } from "next/server";
import { setUserActive } from "@/lib/users";

export async function POST(request, { params }) {
  const { userId } = await params;
  const { isActive } = await request.json();
  if (typeof isActive !== "boolean") {
    return NextResponse.json({ error: "isActive must be true or false" }, { status: 400 });
  }
  try {
    await setUserActive(userId, isActive);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
