import Link from "next/link";
import { Icon } from "@/app/_components/icon";
import { toLocal } from "@/engine/time";
import { weekdayDayMonth } from "@/lib/app/dates";
import type { Capture } from "@/lib/happening/queries";
import { FINISH_LATER_HOURS, durationText, needsDetail } from "@/lib/happening/timer";
import type { Running } from "../../_components/happening-entry";

type Who = { me: string; names: Record<string, string> };

/** Who started a capture, as Today names them: null for the person signed in. */
const starter = (profile: string | null, { me, names }: Who) =>
  profile === me ? null : ((profile && names[profile]) ?? "Someone in the household");

/** The capture running for the dog, as the band and the way in take it. */
export function runningFor(captures: { running: Capture | null }, who: Who): Running {
  const { running } = captures;
  return running && { id: running.id, startedAt: running.started_at, by: starter(running.recorded_by, who) };
}

/** A "Finish this later" card for each capture that stopped in the last 48 hours without its detail, first on Today. */
export function FinishLater({
  captures,
  me,
  names,
  timeZone,
  now,
}: {
  captures: { unfinished: Capture[] };
  me: string;
  names: Record<string, string>;
  timeZone: string;
  now: Date;
}) {
  return captures.unfinished
    .filter((c) => needsDetail(c, now))
    .map((c) => {
      const start = toLocal(new Date(c.started_at), timeZone);
      const ended = Date.parse(c.ended_at ?? c.started_at);
      const until = toLocal(new Date(ended + FINISH_LATER_HOURS * 3600000), timeZone);
      const seconds = c.duration_s ?? (ended - Date.parse(c.started_at)) / 1000;
      const who = starter(c.recorded_by, { me, names });
      return (
        <section key={c.id} className="card finish-card" aria-labelledby={`fl-${c.id}`}>
          <div className="kicker">
            <span className="kick-med" id={`fl-${c.id}`}>
              <span className="med chk" aria-hidden="true">
                <Icon name="stopwatch" />
              </span>
              Finish this later
            </span>
          </div>
          <p className="tn" style={{ fontSize: 18, lineHeight: "26px", textWrap: "pretty" }}>
            Happening now, {weekdayDayMonth(start.date)} at {start.time}: it lasted {durationText(seconds)}
            {who ? `, started by ${who}` : ""}.
          </p>
          <p className="ty-sm c2" style={{ textWrap: "pretty" }}>
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
    });
}
