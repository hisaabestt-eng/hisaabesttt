import { NextResponse } from "next/server";
import { setUserPassword } from "@/lib/users";

export async function POST(request, { params }) {
  const { userId } = await params;
  const { password } = await request.json();
  if (!password || password.length < 4) {
    return NextResponse.json({ error: "Password must be at least 4 characters" }, { status: 400 });
  }
  await setUserPassword(userId, password);
  return NextResponse.json({ ok: true });
}
