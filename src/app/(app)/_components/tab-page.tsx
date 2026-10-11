import type { Tab } from "@/lib/app/nav";
import { OwnerOnly } from "./owner-only";

/**
 * The frame every tab uses. Today leads with the dog instead of the tab's
 * name, so its heading is kept for screen readers only.
 */
export function TabPage({
  tab,
  quietHeading = false,
  children,
}: {
  tab: Tab;
  quietHeading?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-5 py-6">
      <OwnerOnly />
      {quietHeading ? (
        <h1 className="sr-only">{tab.label}</h1>
      ) : (
        <div className="flex flex-col gap-1 border-b border-rule pb-4">
          <h1 className="text-4xl font-bold text-green">{tab.label}</h1>
          <p className="text-lg text-muted">{tab.question}</p>
        </div>
      )}
      {children}
    </main>
  );
}
