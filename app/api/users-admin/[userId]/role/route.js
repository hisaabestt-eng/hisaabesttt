import { NextResponse } from "next/server";
import { setUserRole } from "@/lib/users";

export async function POST(request, { params }) {
  const { userId } = await params;
  const { role } = await request.json();
  if (role !== "admin" && role !== "user") {
    return NextResponse.json({ error: "Role must be admin or user" }, { status: 400 });
  }
  try {
    await setUserRole(userId, role);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
