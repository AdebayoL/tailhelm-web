"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { TABS, tabFor } from "@/lib/app/nav";

export function TabBar() {
  const current = tabFor(usePathname());
  return (
    <nav aria-label="Tabs" className="border-t border-rule bg-paper pb-[env(safe-area-inset-bottom)]">
      <ul className="mx-auto grid max-w-md grid-cols-4">
        {TABS.map((tab) => {
          const active = current?.href === tab.href;
          return (
            <li key={tab.href}>
              <Link
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-[60px] items-center justify-center px-1 text-center text-base ${
                  active ? "font-bold text-green underline decoration-2 underline-offset-[6px]" : "text-ink"
                }`}
              >
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
