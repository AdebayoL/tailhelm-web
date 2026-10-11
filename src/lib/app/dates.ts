import type { LocalDate } from "@/engine/time";

/** Dates as the design writes them, from the owner's local date. Always UK order, never a time zone shift. */

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTHS_LONG = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DAYS_LONG = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function parts(date: LocalDate) {
  const [y, m, d] = date.split("-").map(Number);
  return { y, m, d, w: new Date(Date.UTC(y, m - 1, d)).getUTCDay() };
}

/** "20 Oct" */
export function dayMonth(date: LocalDate): string {
  const { m, d } = parts(date);
  return `${d} ${MONTHS[m - 1]}`;
}

/** "Tue 20 Oct" */
export function weekdayDayMonth(date: LocalDate): string {
  const { m, d, w } = parts(date);
  return `${DAYS[w]} ${d} ${MONTHS[m - 1]}`;
}

/** "Tue 20 Oct 2026" */
export function weekdayDate(date: LocalDate): string {
  const { y, m, d, w } = parts(date);
  return `${DAYS[w]} ${d} ${MONTHS[m - 1]} ${y}`;
}

/** "Sunday 11 October 2026" */
export function longDate(date: LocalDate): string {
  const { y, m, d, w } = parts(date);
  return `${DAYS_LONG[w]} ${d} ${MONTHS_LONG[m - 1]} ${y}`;
}

/** "March 2019" */
export function monthYear(date: LocalDate): string {
  const { y, m } = parts(date);
  return `${MONTHS_LONG[m - 1]} ${y}`;
}
