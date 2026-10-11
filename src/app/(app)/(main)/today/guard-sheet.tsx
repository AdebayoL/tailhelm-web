"use client";

import { Icon } from "@/app/_components/icon";
import { Sheet } from "@/app/_components/sheet";
import { telHref } from "@/lib/dogs/input";

export type Vet = { name: string | null; phone: string | null };

/** "Call Larkfield Vets", as a secondary button, when the vet's number is known. */
export function CallVet({ vet, className = "btn btn-secondary" }: { vet: Vet; className?: string }) {
  if (!vet.phone) return null;
  return (
    <a className={className} href={telHref(vet.phone)}>
      <Icon name="call" />
      Call {vet.name ?? "your vet"}
    </a>
  );
}

/**
 * The double-dose guard. The database keeps one tick per dose, so a second
 * Given is refused and the person is told who got there first.
 */
export function GuardSheet({
  by,
  at,
  slot,
  med,
  dogName,
  vet,
  onClose,
}: {
  by: string;
  at: string;
  slot: string;
  med: { name: string; amount: string | null };
  dogName: string;
  vet: Vet;
  onClose: () => void;
}) {
  return (
    <Sheet label="Already given" onClose={onClose} alert>
      <div className="row gap-12">
        <Icon name="attention" size={28} className="c-warning" />
        <h2 className="ty-page">Already given</h2>
      </div>
      <p className="ty-lead tn sheet-lead">
        {by === "you" ? "You" : by} ticked this at {at}. It has not been recorded twice.
      </p>
      <div className="recs">
        <div className="rec">
          <span className="rec-time">{slot}</span>
          <div>
            <p className="rec-med">
              <b>{med.name}</b>
              {med.amount && ` ${med.amount}`}
            </p>
            <p className="st given">
              <Icon name="recorded" />
              Given {at} by {by}
            </p>
          </div>
        </div>
      </div>
      <p className="prov">If you think {dogName} may have had two doses, contact your vet.</p>
      <div className="sheet-actions">
        <button className="btn btn-primary" type="button" onClick={onClose}>
          Close
        </button>
        <CallVet vet={vet} />
      </div>
    </Sheet>
  );
}
