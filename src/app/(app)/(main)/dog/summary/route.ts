import { addDays, toLocal, zonedTimeToInstant } from "@/engine/time";
import { requireOwner } from "@/lib/auth/session";
import { getMyDog } from "@/lib/dogs/queries";
import { getExportData } from "@/lib/export/queries";
import { renderPdf } from "@/lib/summary/pdf";
import { SUMMARY_DAYS, buildSummary, summaryFileName } from "@/lib/summary/summary";
import { getTimeZone } from "@/lib/today/queries";
import { getPack } from "@/packs/registry";

/** The plain 90-day summary as a PDF to show or send the vet. Free on every plan, whatever the history line. */
export async function GET() {
  const owner = await requireOwner();
  const [dog, timeZone] = await Promise.all([getMyDog(), getTimeZone(owner.userId)]);
  if (!dog) return new Response("Add your dog first, on the Dog tab.", { status: 404 });
  const now = new Date();
  const today = toLocal(now, timeZone).date;
  // Only the period's records, so a long history never crowds out the latest.
  const from = addDays(today, -(SUMMARY_DAYS - 1));
  const data = await getExportData({ date: from, instant: zonedTimeToInstant(from, "00:00", timeZone).toISOString() });
  const summary = buildSummary({ data, dogId: dog.id, timeZone, now, packFor: getPack });
  if (!summary) return new Response("Add your dog first, on the Dog tab.", { status: 404 });
  return new Response(renderPdf(summary, now), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${summaryFileName(today)}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
