import { toLocal } from "@/engine/time";
import { requireOwner } from "@/lib/auth/session";
import { buildExportCsv, exportFileName } from "@/lib/export/csv";
import { getExportData } from "@/lib/export/queries";
import { getTimeZone } from "@/lib/today/queries";
import { getPack } from "@/packs/registry";

/** The full CSV export of everything held about the owner's dogs. Free on every plan. */
export async function GET() {
  const owner = await requireOwner();
  const [data, timeZone] = await Promise.all([getExportData(), getTimeZone(owner.userId)]);
  const csv = buildExportCsv(data, timeZone, getPack);
  const today = toLocal(new Date(), timeZone).date;
  // The byte order mark lets Excel read names and notes with accents correctly.
  return new Response(`﻿${csv}`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${exportFileName(today)}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
