"use client";

import { useOptimistic, useState, useTransition } from "react";
import { Icon } from "@/app/_components/icon";
import { toLocal } from "@/engine/time";
import { tickSign, untickSign } from "./actions";

export type CheckRow = {
  key: string;
  label: string;
  /** "Sam, 08:05" once ticked today. */
  by: string | null;
  mine: boolean;
};

/**
 * Today's check: the signs the condition pack lists, each one tap. A tick is
 * kept straight away with who made it and when; people can untick their own.
 */
export function QuickCheck({
  conditionId,
  rows,
  myName,
  timeZone,
}: {
  conditionId: string;
  rows: CheckRow[];
  myName: string;
  timeZone: string;
}) {
  const [shown, setShown] = useOptimistic(rows, (current, { key, on }: { key: string; on: boolean }) =>
    current.map((r) =>
      r.key === key ? { ...r, by: on ? `${myName}, ${toLocal(new Date(), timeZone).time}` : null, mine: on } : r,
    ),
  );
  const [, start] = useTransition();
  const [failed, setFailed] = useState(false);

  const toggle = (row: CheckRow, on: boolean) => {
    const form = new FormData();
    form.set("dog_condition_id", conditionId);
    form.set("sign", row.key);
    start(async () => {
      setShown({ key: row.key, on });
      const result = await (on ? tickSign(form) : untickSign(form)).catch(() => ({ failed: true }));
      setFailed(!!result.failed);
    });
  };

  return (
    <>
      <div className="checks">
        {shown.map((r) => {
          const on = r.by !== null;
          // Someone else's tick is theirs to undo.
          const locked = on && !r.mine;
          return (
            <label key={r.key} className="check" style={locked ? { cursor: "default" } : undefined}>
              <input
                className="sr"
                type="checkbox"
                checked={on}
                disabled={locked}
                onChange={(e) => toggle(r, e.target.checked)}
              />
              <span className={on ? "box on" : "box"}>
                <Icon name="boxTick" className={on ? "tick-in" : undefined} />
              </span>
              <span>{r.label}</span>
              <span className="check-by">{r.by ?? ""}</span>
            </label>
          );
        })}
      </div>
      {failed && (
        <p className="err" role="alert">
          <Icon name="attention" />
          This wasn&rsquo;t saved. Try again in a minute.
        </p>
      )}
    </>
  );
}
