/** Small pieces of wording shared by several screens. */

/** "Sam", "Sam and Kit", "Sam, Kit and Jo". */
export function joinNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

/** The other people in the household, by the names they chose, in a stable order. */
export function otherNames(names: Record<string, string>, me: string): string[] {
  return Object.entries(names)
    .filter(([id]) => id !== me)
    .map(([, name]) => name)
    .sort((a, b) => a.localeCompare(b));
}

/** The letter shown in a round avatar until there is a photo. */
export function initial(name: string | null | undefined): string {
  return (name ?? "").trim().charAt(0).toUpperCase() || "?";
}

/** "in 40 min", "in 8 h 45 min", "now", "due 40 min ago": how far a time is from now, in whole minutes. */
export function untilText(dueAt: Date, now: Date): string {
  const minutes = Math.round((dueAt.getTime() - now.getTime()) / 60_000);
  const span = (m: number) => {
    const h = Math.floor(m / 60);
    const rest = m % 60;
    return h === 0 ? `${rest} min` : rest === 0 ? `${h} h` : `${h} h ${rest} min`;
  };
  if (minutes > 0) return `in ${span(minutes)}`;
  if (minutes > -5) return "now";
  return `due ${span(-minutes)} ago`;
}

/** "has" after one name, "have" after "Sam and Kit". */
export function hasOrHave(names: string): "has" | "have" {
  return names.includes(" and ") ? "have" : "has";
}
