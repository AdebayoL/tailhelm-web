import Link from "next/link";
import { EmergencyButton } from "./_components/emergency-button";
import { TabBar } from "./_components/tab-bar";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-1 flex-col">
      <header className="sticky top-0 z-10 border-b border-sand bg-paper pt-[env(safe-area-inset-top)]">
        <div className="mx-auto flex max-w-md items-center justify-between px-4 py-2">
          <Link href="/today" className="text-xl font-semibold text-green">
            Tailhelm
          </Link>
          <EmergencyButton />
        </div>
      </header>
      <div className="flex flex-1 flex-col">{children}</div>
      <div className="sticky bottom-0">
        <TabBar />
      </div>
    </div>
  );
}
