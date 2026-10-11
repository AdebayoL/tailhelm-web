"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "@/app/_components/icon";
import { MORE, TABS, sideItemFor } from "@/lib/app/nav";

/** The tab bar, standing up: the same four destinations in the same order, then the Dog tab's two screens. */
export function SideNav() {
  const current = sideItemFor(usePathname());
  const item = (i: (typeof TABS)[number] | (typeof MORE)[number]) => {
    const on = current === i.href;
    return (
      <Link key={i.href} href={i.href} className={on ? "nav-item on" : "nav-item"} aria-current={on ? "page" : undefined}>
        <Icon name={i.icon} />
        {i.label}
      </Link>
    );
  };
  return (
    <>
      <nav className="side-nav" aria-label="Main">
        {TABS.map(item)}
      </nav>
      <p className="side-label">More</p>
      <nav className="side-nav" aria-label="More">
        {MORE.map(item)}
      </nav>
    </>
  );
}
