import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { addTag, removeTag, parseTags } from "@/lib/tags";

export async function POST(request, { params }) {
  const { estId } = await params;
  const { tag } = await request.json();

  if (!tag || !tag.trim()) {
    return NextResponse.json({ error: "Tag cannot be empty" }, { status: 400 });
  }

  const { rows } = await pool.query("SELECT tags FROM estimates WHERE est_id = $1", [estId]);
  if (!rows[0]) {
    return NextResponse.json({ error: "Estimate not found" }, { status: 404 });
  }

  const updatedTags = addTag(rows[0].tags, tag);
  await pool.query("UPDATE estimates SET tags = $1, updated_at = now() WHERE est_id = $2", [
    updatedTags,
    estId,
  ]);

  return NextResponse.json({ tags: parseTags(updatedTags) });
}

export async function DELETE(request, { params }) {
  const { estId } = await params;
  const { tag } = await request.json();

  if (!tag || !tag.trim()) {
    return NextResponse.json({ error: "Tag is required" }, { status: 400 });
  }

  const { rows } = await pool.query("SELECT tags FROM estimates WHERE est_id = $1", [estId]);
  if (!rows[0]) {
    return NextResponse.json({ error: "Estimate not found" }, { status: 404 });
  }

  const updatedTags = removeTag(rows[0].tags, tag);
  await pool.query("UPDATE estimates SET tags = $1, updated_at = now() WHERE est_id = $2", [
    updatedTags,
    estId,
  ]);

  return NextResponse.json({ tags: parseTags(updatedTags) });
}
