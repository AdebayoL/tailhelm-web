/**
 * The app's four tabs and the emergency screen. Each tab answers one question
 * (Build Spec, "Product design: four moments"); the emergency button sits on
 * every screen and reaches the emergency screen in one tap. On a desktop the
 * tabs stand up as a sidebar, with the Dog tab's two screens listed under
 * "More".
 */
export const TABS = [
  { href: "/today", label: "Today", question: "What do I need to do now?", icon: "today" },
  { href: "/trends", label: "Trends", question: "How is my dog doing over time?", icon: "trends" },
  { href: "/care-team", label: "Care team", question: "Who else needs to know?", icon: "careTeam" },
  { href: "/dog", label: "Dog", question: "What is the plan?", icon: "dog" },
] as const;

export type Tab = (typeof TABS)[number];

/** Reached from the Dog tab on a phone; listed under "More" on a desktop. */
export const MORE = [
  { href: "/vet-visit", label: "Vet visit", icon: "vetVisit" },
  { href: "/reminders", label: "Reminders", icon: "reminder" },
] as const;

export const EMERGENCY_PATH = "/emergency";

/**
 * What the Dog tab is called: the dog's own name when the household has one
 * dog, "Dogs" when it has several, and "Dog" before any dog is added.
 */
export function dogTabLabel(names: string[]): string {
  const named = names.map((n) => n.trim()).filter(Boolean);
  if (named.length === 0) return "Dog";
  return named.length === 1 ? named[0] : "Dogs";
}

const under = (pathname: string, href: string) => pathname === href || pathname.startsWith(`${href}/`);

/** The tab a path belongs to, so the tab bar can mark it, or null outside the tabs. The Dog tab's screens count as Dog. */
export function tabFor(pathname: string): Tab | null {
  if (MORE.some((m) => under(pathname, m.href))) return TABS[3];
  return TABS.find((t) => under(pathname, t.href)) ?? null;
}

/** The sidebar item a path belongs to: a tab, or one of the Dog tab's screens. */
export function sideItemFor(pathname: string): string | null {
  return [...TABS, ...MORE].find((i) => under(pathname, i.href))?.href ?? null;
}
