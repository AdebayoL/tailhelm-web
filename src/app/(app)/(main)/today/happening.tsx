import Link from "next/link";
import { toLocal } from "@/engine/time";
import { weekdayDayMonth } from "@/lib/app/dates";
import type { Capture } from "@/lib/happening/queries";
import { FINISH_LATER_HOURS, durationText, needsDetail } from "@/lib/happening/timer";
import { HappeningEntry } from "../../_components/happening-entry";

/**
 * Happening now on Today: the way in, or the timer running, first on the
 * screen; then a "Finish this later" card for each capture that stopped in
 * the last 48 hours without its detail.
 */
export function HappeningOnToday({
  dogId,
  captures,
  me,
  names,
  timeZone,
  now,
}: {
  dogId: string;
  captures: { running: Capture | null; unfinished: Capture[] };
  me: string;
  names: Record<string, string>;
  timeZone: string;
  now: Date;
}) {
  const by = (profile: string | null) => (profile === me ? null : ((profile && names[profile]) ?? "Someone in the household"));
  const { running } = captures;
  return (
    <>
      <HappeningEntry
        dogId={dogId}
        timeZone={timeZone}
        running={running && { id: running.id, startedAt: running.started_at, by: by(running.recorded_by) }}
      />
      {captures.unfinished
        .filter((c) => needsDetail(c, now))
        .map((c) => {
          const start = toLocal(new Date(c.started_at), timeZone);
          const ended = Date.parse(c.ended_at ?? c.started_at);
          const until = toLocal(new Date(ended + FINISH_LATER_HOURS * 3600000), timeZone);
          const seconds = c.duration_s ?? (ended - Date.parse(c.started_at)) / 1000;
          const who = by(c.recorded_by);
          return (
            <section key={c.id} className="card stack-12 hn-finish" aria-label="Finish this later">
              <div className="stack-4">
                <h2 className="r-h">Finish this later</h2>
                <p className="tn">
                  Happening now, {weekdayDayMonth(start.date)} at {start.time}: it lasted {durationText(seconds)}
                  {who ? `, started by ${who}` : ""}.
                </p>
              </div>
              <p className="hint">
                Add what you noticed, for your vet. Every detail is optional. This card stays until{" "}
                <span className="tn nowrap">
                  {weekdayDayMonth(until.date)} at {until.time}
                </span>
                .
              </p>
              <Link className="btn btn-primary" href={`/happening-now/${c.id}`}>
                Add detail
              </Link>
            </section>
          );
        })}
    </>
  );
}
