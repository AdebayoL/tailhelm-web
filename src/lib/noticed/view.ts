import { type LocalDate, addDays } from "@/engine/time";
import { dayMonth } from "@/lib/app/dates";
import { formatDate } from "@/lib/plan/input";
import { type Evidence, THRESHOLDS } from "./rules";

/**
 * What the screens and the summary say around an observation. The
 * observation's own words come from the rules; these add where it came from,
 * the one action Noticed ever names, and why it was shown.
 */

export type NoticedRow = {
  id: string;
  dog_id: string;
  rule_family: string;
  computed_on: LocalDate;
  window_start: LocalDate;
  window_end: LocalDate;
  copy: string;
  evidence_json: { rule: string; from: LocalDate | null; records: Evidence[] };
  shown_at: string | null;
  opened_at: string | null;
  dismissed_at: string | null;
  added_to_report_at: string | null;
  added_by: string | null;
};

/** The only action Noticed ever suggests. */
export const NOTICED_ACTION = "Worth mentioning to your vet.";

/** Said once, on Trends, to a free account. It never says what a longer history would show. */
export const NOTICED_FREE_LINE = "Observations get stronger with more history.";

export const noticedSource = (dogName: string) => `From ${dogName}’s own records.`;

/** How long an observation stays on Today: until the next one could come. */
export const TODAY_DAYS = THRESHOLDS.everyDays;

/**
 * Whether the household can see an observation on its plan: every record
 * behind it inside the history the plan shows, so a free account never sees
 * one that rests on records it cannot see.
 */
export function noticedVisible(row: Pick<NoticedRow, "window_start">, from: LocalDate | null): boolean {
  return from === null || row.window_start >= from;
}

/** Whether it still belongs on Today: not dismissed, and from the last week. */
export function onToday(row: Pick<NoticedRow, "computed_on" | "dismissed_at">, today: LocalDate): boolean {
  return !row.dismissed_at && row.computed_on > addDays(today, -TODAY_DAYS);
}

/** "25 Oct", or "25 Oct 2025" from another year. */
export function noticedDate(date: LocalDate, today: LocalDate): string {
  return date.slice(0, 4) === today.slice(0, 4) ? dayMonth(date) : formatDate(date);
}

/** "Why am I seeing this?": the rule, what it reads and doesn't, and which records. */
export function whyLines(row: Pick<NoticedRow, "evidence_json" | "computed_on">, dogName: string, today: LocalDate): string[] {
  const { rule, from } = row.evidence_json;
  const read = from
    ? `It read ${dogName}’s records from ${noticedDate(from, today)} to ${noticedDate(row.computed_on, today)}.`
    : `It read all of ${dogName}’s records up to ${noticedDate(row.computed_on, today)}.`;
  return [
    rule,
    `It looks only at ${dogName}’s own records, never at other dogs, and it doesn’t predict anything. ${read}`,
    `Tailhelm shows at most one observation a week. Alerts are separate and always show.`,
  ];
}

/** The records behind it, one line each, oldest first: "4 Aug: Lab report: Potassium 5.2 mmol/L". */
export function recordLines(row: Pick<NoticedRow, "evidence_json">, today: LocalDate): { key: string; date: string; text: string }[] {
  return row.evidence_json.records.map((r, i) => ({ key: `${r.id}-${i}`, date: noticedDate(r.on, today), text: r.text }));
}
