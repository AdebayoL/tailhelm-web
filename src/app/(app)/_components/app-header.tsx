"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "@/app/_components/icon";
import { Wordmark } from "@/app/_components/mark";
import { EmergencyButton } from "./emergency-button";

/**
 * The phone header: the wordmark at the left margin and Emergency at the
 * right, in the same place on every screen. The Dog tab's own screens lead
 * with a way back to Dog; the vet visit, handed to a vet, keeps only the name.
 */
export function AppHeader() {
  const pathname = usePathname();
  const back = pathname === "/reminders" || pathname === "/vet-visit";
  return (
    <header className="hdr app-hdr">
      {back ? (
        <Link className="back" href="/dog">
          <Icon name="back" />
          Dog
        </Link>
      ) : (
        <Link className="wm" href="/today" aria-label="Tailhelm, Today">
          <Wordmark />
        </Link>
      )}
      {pathname === "/vet-visit" ? (
        <Link className="wm" href="/today" aria-label="Tailhelm, Today">
          <Wordmark size={26} textStyle={{ fontSize: 19 }} />
        </Link>
      ) : (
        <EmergencyButton />
      )}
    </header>
  );
}
