import type { Metadata } from "next";
import { TABS } from "@/lib/app/nav";
import { TabPage } from "../_components/tab-page";

export const metadata: Metadata = { title: "Today · Tailhelm" };

export default function TodayPage() {
  return <TabPage tab={TABS[0]} />;
}
