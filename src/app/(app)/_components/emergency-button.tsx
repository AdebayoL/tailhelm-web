import Link from "next/link";
import { EMERGENCY_PATH } from "@/lib/app/nav";

/** On every screen, one tap from the emergency screen. Red is reserved for this and real alerts. */
export function EmergencyButton() {
  return (
    <Link
      href={EMERGENCY_PATH}
      className="flex min-h-12 items-center rounded-full bg-emergency px-5 text-base font-semibold text-white"
    >
      Emergency
    </Link>
  );
}
