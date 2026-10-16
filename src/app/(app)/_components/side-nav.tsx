"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { Icon } from "@/app/_components/icon";
import { MORE, TABS, sideItemFor } from "@/lib/app/nav";

/**
 * The tab bar, standing up: the same four destinations in the same order,
 * then the Dog tab's two screens. Keys 1 to 4 open the four, as the hints
 * beside them say.
 */
export function SideNav({ dogLabel = "Dog" }: { dogLabel?: string }) {
  const current = sideItemFor(usePathname());
  const router = useRouter();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
      if (document.querySelector("[role=dialog], [role=alertdialog]")) return;
      if (!window.matchMedia("(min-width: 1024px)").matches) return;
      const tab = TABS[Number(e.key) - 1];
      if (!tab) return;
      e.preventDefault();
      router.push(tab.href);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router]);
  const item = (i: (typeof TABS)[number] | (typeof MORE)[number], key?: string) => {
    const on = current === i.href;
    return (
      <Link
        key={i.href}
        href={i.href}
        className={on ? "nav-item on" : "nav-item"}
        aria-current={on ? "page" : undefined}
        aria-keyshortcuts={key}
      >
        <Icon name={i.icon} />
        {i.href === "/dog" ? dogLabel : i.label}
      </Link>
    );
  };
  return (
    <>
      <nav className="side-nav" aria-label="Main">
        {TABS.map((t, n) => item(t, String(n + 1)))}
      </nav>
      <p className="side-label">More</p>
      <nav className="side-nav" aria-label="More">
        {MORE.map((m) => item(m))}
      </nav>
    </>
  );
}
