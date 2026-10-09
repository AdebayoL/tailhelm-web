import type { Tab } from "@/lib/app/nav";
import { OwnerOnly } from "./owner-only";

/** The plain frame every tab uses until the design system lands. */
export function TabPage({ tab, children }: { tab: Tab; children?: React.ReactNode }) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-6 py-8">
      <OwnerOnly />
      <div className="flex flex-col gap-1">
        <h1 className="text-4xl font-semibold text-green">{tab.label}</h1>
        <p className="text-lg">{tab.question}</p>
      </div>
      {children}
    </main>
  );
}
