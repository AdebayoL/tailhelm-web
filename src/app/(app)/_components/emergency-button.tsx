import Link from "next/link";
import { Icon } from "@/app/_components/icon";
import { EMERGENCY_PATH } from "@/lib/app/nav";

/** On every screen, in the same place: one tap to the emergency screen. Red is kept for this and real alerts. */
export function EmergencyButton({ className = "" }: { className?: string }) {
  return (
    <Link href={EMERGENCY_PATH} className={`btn-em-hdr ${className}`.trim()}>
      <Icon name="call" size={20} />
      Emergency
    </Link>
  );
}
