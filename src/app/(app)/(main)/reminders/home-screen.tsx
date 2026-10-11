"use client";

import { useSyncExternalStore } from "react";
import { Icon } from "@/app/_components/icon";

const subscribe = () => () => {};
const installed = () =>
  window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;

/** Whether Tailhelm was opened from the Home Screen, which only this device can tell. */
export function HomeScreenCheck({ checkedAt }: { checkedAt: string }) {
  // On the server, and before the page is live, nothing is claimed either way.
  const onHome = useSyncExternalStore(subscribe, installed, () => null);
  if (onHome === null) return null;
  return (
    <li className="health-row">
      {onHome ? (
        <span className="health-ok">
          <Icon name="tick" />
        </span>
      ) : (
        <Icon name="info" className="c2" />
      )}
      <div>
        <p>{onHome ? "Tailhelm is on your Home Screen" : "Tailhelm is not on your Home Screen"}</p>
        <p className="prov">
          {onHome ? "It opens like an app and shows today's plan with no signal." : "Add it from your browser's Share or menu button, so it opens like an app and works with no signal."}
        </p>
      </div>
      <span className="prov d-only">Checked {checkedAt}</span>
    </li>
  );
}
