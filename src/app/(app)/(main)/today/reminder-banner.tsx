"use client";

import { useSyncExternalStore } from "react";
import Link from "next/link";
import { Icon } from "@/app/_components/icon";
import { blockedHere } from "@/lib/push/client";
import type { HealthIssue } from "@/lib/reminders/health";

const subscribe = () => () => {};

/**
 * The amber banner on Today while a reminder layer has stopped working, with
 * the way to fix it. Notifications blocked on this phone can only be seen
 * here, so that is added on the phone itself.
 */
export function ReminderBanner({ issues }: { issues: HealthIssue[] }) {
  const blocked = useSyncExternalStore(subscribe, blockedHere, () => false);
  const lines = blocked
    ? [...issues.filter((i) => i.key !== "push").map((i) => i.text), "Notifications are blocked for Tailhelm on this phone."]
    : issues.map((i) => i.text);
  if (lines.length === 0) return null;
  return (
    <div className="banner banner-warn" role="status">
      <Icon name="attention" />
      <div className="stack-4">
        <p className="w6">Check your reminders</p>
        {lines.map((line) => (
          <p key={line}>{line}</p>
        ))}
        <Link href="/reminders" className="lnk" style={{ alignSelf: "flex-start" }}>
          Fix it in Reminders
        </Link>
      </div>
    </div>
  );
}
