"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";
import { keptPageSavedAt, startOfflineSupport } from "@/lib/offline/client";
import { offlineBannerText } from "@/lib/offline/text";

function subscribe(onChange: () => void) {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
}

/** Registers the service worker and says when the phone has no signal. */
export function OfflineSupport() {
  const pathname = usePathname();
  const offline = useSyncExternalStore(
    subscribe,
    () => !navigator.onLine,
    () => false,
  );
  const [savedAt, setSavedAt] = useState<Date | null>(null);

  useEffect(() => {
    // In development the service worker would serve stale pages while editing.
    if (process.env.NODE_ENV === "production") void startOfflineSupport();
  }, []);

  useEffect(() => {
    if (!offline) return;
    let current = true;
    void keptPageSavedAt(new URL(pathname, window.location.origin).href).then((d) => {
      if (current) setSavedAt(d);
    });
    return () => {
      current = false;
    };
  }, [offline, pathname]);

  if (!offline) return null;
  return (
    <p role="status" className="bg-sand px-4 py-2 text-center text-base text-ink">
      {offlineBannerText(savedAt, new Date())}
    </p>
  );
}
