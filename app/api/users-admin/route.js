import { NextResponse } from "next/server";
import { listUsers, createUser } from "@/lib/users";

export async function GET() {
  const users = await listUsers();
  return NextResponse.json({ users });
}

export async function POST(request) {
  const { name, username, password, role } = await request.json();
  if (!name || !name.trim() || !username || !username.trim() || !password) {
    return NextResponse.json({ error: "Name, username and password are required" }, { status: 400 });
  }
  if (role !== "admin" && role !== "user") {
    return NextResponse.json({ error: "Role must be admin or user" }, { status: 400 });
  }
  try {
    const userId = await createUser({ name, username, password, role });
    return NextResponse.json({ userId });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
