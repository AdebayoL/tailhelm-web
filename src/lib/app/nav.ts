/**
 * The app's four tabs and the emergency screen. Each tab answers one question
 * (Build Spec, "Product design: four moments"); the red emergency button sits
 * on every screen and reaches the emergency screen in one tap.
 */
export const TABS = [
  { href: "/today", label: "Today", question: "What do I need to do now?" },
  { href: "/trends", label: "Trends", question: "How is my dog doing over time?" },
  { href: "/care-team", label: "Care team", question: "Who else needs to know?" },
  { href: "/dog", label: "Dog", question: "What is the plan?" },
] as const;

export type Tab = (typeof TABS)[number];

export const EMERGENCY_PATH = "/emergency";

/** The tab a path belongs to, so the tab bar can mark it, or null outside the tabs. */
export function tabFor(pathname: string): Tab | null {
  return TABS.find((t) => pathname === t.href || pathname.startsWith(`${t.href}/`)) ?? null;
}
