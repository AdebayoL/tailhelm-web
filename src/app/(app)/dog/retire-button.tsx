"use client";

import { useState } from "react";
import { retirePlanItem } from "./plan-actions";

const link = "min-h-12 text-lg text-green underline underline-offset-4";

/** Two taps, so a reminder is never dropped by a slip of the thumb. */
export function RetireButton({ planItemId }: { planItemId: string }) {
  const [asking, setAsking] = useState(false);
  if (!asking) {
    return (
      <button type="button" onClick={() => setAsking(true)} className={`${link} self-start`}>
        Take off the plan
      </button>
    );
  }
  return (
    <form action={retirePlanItem} className="flex flex-col gap-2">
      <input type="hidden" name="plan_item_id" value={planItemId} />
      <p className="text-lg font-semibold">Reminders for this medicine will stop. Take it off the plan?</p>
      <div className="flex gap-6">
        <button type="submit" className={link}>
          Yes, take it off
        </button>
        <button type="button" onClick={() => setAsking(false)} className={link}>
          Keep it
        </button>
      </div>
    </form>
  );
}
