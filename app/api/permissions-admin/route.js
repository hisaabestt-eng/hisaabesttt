import { NextResponse } from "next/server";
import { getPermissions, updatePermissions } from "@/lib/permissions";

export async function GET() {
  const permissions = await getPermissions();
  return NextResponse.json(permissions);
}

export async function PUT(request) {
  const { canAdd, canEdit, canDelete } = await request.json();
  await updatePermissions({ canAdd: !!canAdd, canEdit: !!canEdit, canDelete: !!canDelete });
  return NextResponse.json({ ok: true });
}
