"use client";

import { useState } from "react";
import { Icon } from "@/app/_components/icon";
import { retirePlanItem } from "./plan-actions";

/** Two taps, so a reminder is never dropped by a slip of the thumb. */
export function RetireButton({ planItemId }: { planItemId: string }) {
  const [asking, setAsking] = useState(false);
  if (!asking) {
    return (
      <button type="button" onClick={() => setAsking(true)} className="btn btn-secondary">
        Take off the plan
      </button>
    );
  }
  return (
    <form action={retirePlanItem} className="stack-16">
      <input type="hidden" name="plan_item_id" value={planItemId} />
      <div className="banner banner-warn" role="alert">
        <Icon name="attention" />
        <p>
          <b>Reminders for this will stop.</b> Take it off the plan?
        </p>
      </div>
      <div className="sheet-actions">
        <button type="button" onClick={() => setAsking(false)} className="btn btn-secondary">
          Keep it
        </button>
        <button type="submit" className="btn btn-primary">
          Yes, take it off
        </button>
      </div>
    </form>
  );
}
