import { NextResponse } from "next/server";
import { deleteRecord } from "@/lib/recordsAdmin";
import { deleteEstimate } from "@/lib/estimatesAdmin";
import { deletePO } from "@/lib/poAdmin";
import { deleteInvoice } from "@/lib/invoicesAdmin";
import { writeActivity } from "@/lib/activityLog";
import { getServerSession } from "@/lib/session";

// Deletes leaf-to-root (Invoice -> PO -> Estimate -> Record) for each
// selected row. Every individual delete*() already refuses to remove a
// stage that still has something downstream (e.g. deletePO throws if an
// invoice still references it) — that guard is exactly what keeps this safe
// when a PO/Estimate is shared by other, unselected invoice rows: the shared
// parent's delete attempt just fails and is skipped, leaving it intact for
// its remaining sibling(s), while this row's own invoice still gets removed.
export async function POST(request) {
  const { rows } = await request.json();
  if (!Array.isArray(rows) || rows.length === 0) {
    return NextResponse.json({ error: "No rows selected" }, { status: 400 });
  }

  const session = await getServerSession();
  let fullyDeleted = 0;
  let partiallyDeleted = 0;

  for (const row of rows) {
    let anythingDeleted = false;
    let recordDeleted = false;

    if (row.invId) {
      try {
        await deleteInvoice(row.invId);
        anythingDeleted = true;
      } catch {
        // Payment already allocated — can't touch this row at all, move on.
        continue;
      }
    }

    if (row.poId) {
      try {
        await deletePO(row.poId);
        anythingDeleted = true;
      } catch {
        // Another invoice still references this PO — leave it, skip up the chain.
      }
    }

    if (row.estId) {
      try {
        await deleteEstimate(row.estId);
        anythingDeleted = true;
      } catch {
        // PO (or a direct invoice) still exists — leave it.
      }
    }

    if (row.recordId) {
      try {
        await deleteRecord(row.recordId);
        anythingDeleted = true;
        recordDeleted = true;
      } catch {
        // Estimate still exists — leave it.
      }
    }

    if (recordDeleted) fullyDeleted++;
    else if (anythingDeleted) partiallyDeleted++;
  }

  await writeActivity({
    entityType: "record",
    entityId: "bulk",
    action: "Deleted",
    description: `Bulk-deleted ${fullyDeleted} full chain(s) and partially cleared ${partiallyDeleted} row(s) from the Master Table`,
    performedBy: session.name,
    performedByRole: session.role,
  });

  return NextResponse.json({ fullyDeleted, partiallyDeleted, total: rows.length });
}
