"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "@/app/_components/icon";
import { TABS, tabFor } from "@/lib/app/nav";

/** The four tabs: teal icon, label and a 2 px indicator on the keyline for the one in use. */
export function TabBar({ dogLabel = "Dog" }: { dogLabel?: string }) {
  const pathname = usePathname();
  // The vet visit is handed to a vet, so it stands alone; adding a record's detail leads back to Today instead.
  if (pathname === "/vet-visit" || pathname.startsWith("/happening-now/")) return null;
  const current = tabFor(pathname);
  return (
    <nav className="tabbar app-tabbar" aria-label="Main">
      {TABS.map((tab) => {
        const on = current?.href === tab.href;
        return (
          <Link key={tab.href} href={tab.href} className={on ? "tab on" : "tab"} aria-current={on ? "page" : undefined}>
            <Icon name={tab.icon} />
            <span className="tab-label">{tab.href === "/dog" ? dogLabel : tab.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
