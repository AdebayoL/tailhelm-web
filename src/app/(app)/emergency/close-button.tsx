"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Icon } from "@/app/_components/icon";

/** Back to wherever Emergency was opened from, or to Today. */
export function CloseButton() {
  const router = useRouter();
  return (
    <Link
      className="btn btn-secondary btn-sm em-close"
      href="/today"
      onClick={(e) => {
        if (window.history.length > 1) {
          e.preventDefault();
          router.back();
        }
      }}
    >
      <Icon name="close" size={20} />
      Close
    </Link>
  );
}
