import type { Metadata } from "next";
import { TABS } from "@/lib/app/nav";
import { TabPage } from "../_components/tab-page";

export const metadata: Metadata = { title: "Care team · Tailhelm" };

export default function CareTeamPage() {
  return <TabPage tab={TABS[2]} />;
}
