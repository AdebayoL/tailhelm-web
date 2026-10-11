"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "@/app/_components/icon";
import { TABS, tabFor } from "@/lib/app/nav";

/** The four tabs: teal icon, label and a 2 px indicator on the keyline for the one in use. */
export function TabBar() {
  const pathname = usePathname();
  // The vet visit is handed to a vet, so it stands alone.
  if (pathname === "/vet-visit") return null;
  const current = tabFor(pathname);
  return (
    <nav className="tabbar app-tabbar" aria-label="Main">
      {TABS.map((tab) => {
        const on = current?.href === tab.href;
        return (
          <Link key={tab.href} href={tab.href} className={on ? "tab on" : "tab"} aria-current={on ? "page" : undefined}>
            <Icon name={tab.icon} />
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
