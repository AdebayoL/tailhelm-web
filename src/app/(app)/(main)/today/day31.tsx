import { Suspense } from "react";
import { type LocalDate, addDays, zonedTimeToInstant } from "@/engine/time";
import { getExportData } from "@/lib/export/queries";
import { FREE_DAYS } from "@/lib/history/window";
import { buildLedger } from "@/lib/plus/ledger";
import { DAY31_ON, type Day31Moment, day31Moment } from "@/lib/plus/offer";
import { day31Household, firstRecordOn, happeningNow, plusPayer } from "@/lib/plus/queries";
import { getPack } from "@/packs/registry";
import { Day31Actions, Day31Sheet } from "./day31-sheet";
import { Day31Head, Day31Words, LedgerLoading, LedgerTable, loadingRows } from "./day31-view";

const LABEL = "day31-title";

type Props = {
  dog: { id: string; name: string; created_at: string };
  conditionIds: string[];
  /** The daily medicines and injections on the plan, for the tiles while the figures load. */
  medicines: { name: string; mark: "pred" | "zyc" }[];
  me: string;
  names: Record<string, string>;
  timeZone: string;
  now: Date;
  today: LocalDate;
  /** Something on Today needs the owner first: a dose due or late, an injection, an alert. */
  waits: boolean;
  /** Shown from /today?preview=day-31 whatever the day, and never marked as seen. */
  preview: boolean;
};

/**
 * The day-31 moment: once, on the day the household's first record leaves a
 * free account's 30 days, the month they kept. Off until payments exist,
 * except as a preview.
 */
export async function Day31(props: Props) {
  const { dog, conditionIds, me, names, timeZone, now, today, waits, preview } = props;
  if (!preview && (!DAY31_ON || waits)) return null;
  const [plus, household, first, happening] = await Promise.all([
    plusPayer(dog.id),
    day31Household(dog.id, me),
    firstRecordOn(dog, conditionIds, timeZone, now),
    happeningNow(dog.id),
  ]);
  if (!preview && (plus || household.seen || happening)) return null;
  const moment = day31Moment(first, today) ?? (preview ? previewMoment(first, today) : null);
  if (!moment) return null;

  const ownerName = household.ownerId ? names[household.ownerId] : null;
  const right = (loading: boolean) => (
    <Day31Words moment={moment} dogName={dog.name} owner={household.owner} ownerName={ownerName} preview={preview}>
      <Day31Actions owner={household.owner} choose={null} loading={loading} />
    </Day31Words>
  );

  return (
    <Day31Sheet dogId={dog.id} labelId={LABEL} record={!preview}>
      <Day31Head labelId={LABEL} dogName={dog.name} from={moment.from} today={today} />
      <Suspense
        fallback={
          <>
            <div className="d31-left">
              <LedgerLoading from={moment.from} today={today} rows={loadingRows(props.medicines)} />
            </div>
            {right(true)}
          </>
        }
      >
        <MonthLedger dogId={dog.id} moment={moment} today={today} timeZone={timeZone} />
        {right(false)}
      </Suspense>
    </Day31Sheet>
  );
}

/** For the preview on a household that hasn't reached day 31: the last 31 days, or since the first record. */
function previewMoment(first: LocalDate | null, today: LocalDate): Day31Moment {
  const earliest = addDays(today, -FREE_DAYS);
  const from = first && first > earliest && first <= today ? first : earliest;
  return { from, outOfView: { from, to: from }, late: 0 };
}

async function MonthLedger({ dogId, moment, today, timeZone }: { dogId: string; moment: Day31Moment; today: LocalDate; timeZone: string }) {
  const data = await getExportData({ date: moment.from, instant: zonedTimeToInstant(moment.from, "00:00", timeZone).toISOString() });
  const ledger = buildLedger({ data, dogId, from: moment.from, to: today, timeZone, packFor: getPack });
  return (
    <div className="d31-left">
      <LedgerTable ledger={ledger} />
    </div>
  );
}

