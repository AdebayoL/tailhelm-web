import { type LocalDate, toLocal } from "@/engine/time";

/**
 * Happening now: one tap starts a timer for a crisis, and the only other
 * controls are the vet's numbers and "It has stopped". The timer is the
 * phone's own clock from the moment of the tap, so it keeps time with no
 * signal and while the owner is on a call. Pure, so it can be tested.
 */

/** The event kind a Happening now capture is saved as. */
export const HAPPENING_KIND = "happening_now";

/** How long the "finish this later" card stays on Today after it stops. */
export const FINISH_LATER_HOURS = 48;

/** A published time limit from the condition pack. Addison's has none, so its timer never changes. */
export type LiveThreshold = { key: string; afterMinutes: number; ownerWording: string };

const pad = (n: number) => String(n).padStart(2, "0");

/** The running clock: "0:07", "4:12", and "1:04:12" after an hour. */
export function clockText(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h}:${pad(m)}:${pad(s % 60)}` : `${m}:${pad(s % 60)}`;
}

/** How long it lasted, in words: "45 s", "4 min 12 s", "1 h 4 min". */
export function durationText(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return m > 0 ? `${h} h ${m} min` : `${h} h`;
  if (m > 0) return s % 60 > 0 ? `${m} min ${s % 60} s` : `${m} min`;
  return `${s} s`;
}

/** For a screen reader, once a minute rather than every second: "4 minutes". */
export function spokenTime(ms: number): string {
  const m = Math.floor(Math.max(0, ms) / 60000);
  if (m === 0) return "Under a minute";
  const h = Math.floor(m / 60);
  const words = (n: number, one: string) => `${n} ${one}${n === 1 ? "" : "s"}`;
  if (h === 0) return words(m, "minute");
  return m % 60 === 0 ? words(h, "hour") : `${words(h, "hour")} ${words(m % 60, "minute")}`;
}

/** The pack's limits the timer has passed, earliest first. */
export function passedThresholds(thresholds: LiveThreshold[], ms: number): LiveThreshold[] {
  return thresholds.filter((t) => ms >= t.afterMinutes * 60000).sort((a, b) => a.afterMinutes - b.afterMinutes);
}

/** "It lasted 4 min 12 s, from 03:12 to 03:16." with the date when it ran past midnight. */
export function lastedText(startedAt: string, endedAt: string, timeZone: string, formatDate: (d: LocalDate) => string): string {
  const start = toLocal(new Date(startedAt), timeZone);
  const end = toLocal(new Date(endedAt), timeZone);
  const seconds = (Date.parse(endedAt) - Date.parse(startedAt)) / 1000;
  const to = end.date === start.date ? end.time : `${end.time} on ${formatDate(end.date)}`;
  return `It lasted ${durationText(seconds)}, from ${start.time} to ${to}.`;
}

/** Whether a stopped capture still gets the "finish this later" card. */
export function needsDetail(e: { ended_at: string | null; detail_complete: boolean }, now: Date): boolean {
  if (e.ended_at === null || e.detail_complete) return false;
  return now.getTime() - Date.parse(e.ended_at) < FINISH_LATER_HOURS * 3600000;
}

/** The record's name in Past days, the summary and the export: "Happening now, 4 min 12 s". */
export function happeningLabel(e: { started_at: string; ended_at: string | null }): string {
  if (!e.ended_at) return "Happening now, still running";
  return `Happening now, ${durationText((Date.parse(e.ended_at) - Date.parse(e.started_at)) / 1000)}`;
}
