import { NextResponse } from "next/server";
import { authenticateUser } from "@/lib/users";
import { signSession, SESSION_MAX_AGE_SECONDS } from "@/lib/session";

export async function POST(request) {
  const { username, password } = await request.json();

  if (!username || !username.trim() || !password) {
    return NextResponse.json({ error: "Username and password are required" }, { status: 400 });
  }

  const session = await authenticateUser(username, password);
  if (!session) {
    return NextResponse.json({ error: "Incorrect username or password" }, { status: 401 });
  }

  const token = signSession(session.userId);

  const res = NextResponse.json({ ok: true });
  res.cookies.set("session", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
  return res;
}
