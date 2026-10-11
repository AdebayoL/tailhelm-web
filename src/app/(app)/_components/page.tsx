import { type ReactNode, Suspense } from "react";
import { getShell } from "@/lib/app/shell";
import { EmergencyButton } from "./emergency-button";
import { OfflineSupport } from "./offline-support";
import { OwnerOnly } from "./owner-only";

/**
 * One screen: its title, then its content. On a desktop the title sits in the
 * topbar with Emergency at the right; on a phone it is the first thing on the
 * page, and Emergency is in the header above it.
 */
export function Page({
  title,
  sub,
  subLarge = false,
  lead,
  aside,
  actions,
  dog = false,
  space = 32,
  children,
}: {
  title: ReactNode;
  sub?: ReactNode;
  /** The sub line at reading size on a phone too, as on Care team. */
  subLarge?: boolean;
  /** Before the title, such as the dog's avatar on the Dog tab. */
  lead?: ReactNode;
  /** After the title on a phone, such as the avatar on Today. */
  aside?: ReactNode;
  /** Beside Emergency on a desktop. */
  actions?: ReactNode;
  /** The dog's name as the title, at the dog's size on a phone. */
  dog?: boolean;
  /** The space between the title and the first card on a phone. */
  space?: 16 | 24 | 32;
  children?: ReactNode;
}) {
  const heading = (
    <div>
      <h1 className="d-title">{title}</h1>
      {sub && <p className={subLarge ? "d-sub lg" : "d-sub"}>{sub}</p>}
    </div>
  );
  return (
    <main className="page">
      <OwnerOnly />
      <header className={dog ? "topbar is-dog" : "topbar"}>
        {lead ? (
          <div className="row gap-16">
            {lead}
            {heading}
          </div>
        ) : (
          heading
        )}
        {aside}
        {actions ? (
          <div className="row gap-16 topbar-em" style={{ flexWrap: "wrap" }}>
            {actions}
            <EmergencyButton />
          </div>
        ) : (
          <EmergencyButton className="topbar-em" />
        )}
      </header>
      <PageStatus />
      <div className={space === 32 ? "d-content" : `d-content sp-${space}`}>{children}</div>
    </main>
  );
}

/** The no-signal banner: under the header on a phone, under the topbar on a desktop. */
export function PageStatus() {
  return (
    <Suspense fallback={<OfflineSupport />}>
      <Status />
    </Suspense>
  );
}

async function Status() {
  const { shared } = await getShell();
  return <OfflineSupport shared={shared} />;
}
