import { Suspense } from "react";
import Link from "next/link";
import { Wordmark } from "@/app/_components/mark";
import { getShell } from "@/lib/app/shell";
import { initial } from "@/lib/app/words";
import { AppHeader } from "../_components/app-header";
import { SideNav } from "../_components/side-nav";
import { SyncLine } from "../_components/sync-line";
import { TabBar } from "../_components/tab-bar";

/**
 * The frame around the four tabs. A phone gets the header, one column and the
 * tab bar; from 1024 px the tab bar stands up as the sidebar, with the dog at
 * the top and who is signed in at the foot.
 */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="app">
      <aside className="side app-side" aria-label="Tailhelm">
        <div className="side-brand">
          <Link className="wm" href="/today" aria-label="Tailhelm, Today">
            <Wordmark />
          </Link>
        </div>
        <Suspense fallback={null}>
          <SideDog />
        </Suspense>
        <SideNav />
        <div className="side-foot">
          <Suspense fallback={null}>
            <SideFoot />
          </Suspense>
        </div>
      </aside>
      <div className="app-main">
        <AppHeader />
        {children}
      </div>
      <TabBar />
    </div>
  );
}

async function SideDog() {
  const { dog } = await getShell();
  if (!dog) return null;
  return (
    <div className="side-dog">
      <span className="avatar sm" aria-hidden="true">
        {initial(dog.name)}
      </span>
      <div>
        <p className="w6">{dog.name}</p>
        {dog.condition && <p className="ty-sm c2">{dog.condition}</p>}
      </div>
    </div>
  );
}

async function SideFoot() {
  const { me, shared, at } = await getShell();
  return (
    <>
      <SyncLine shared={shared} at={at} stacked />
      <div className="row gap-12">
        <span className="avatar xs" aria-hidden="true">
          {initial(me.name)}
        </span>
        <div>
          <p className="w6">{me.name}</p>
          <p className="ty-sm c2">{me.role}</p>
        </div>
      </div>
    </>
  );
}
