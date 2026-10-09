import type { Metadata } from "next";
import { TABS } from "@/lib/app/nav";
import { TabPage } from "../_components/tab-page";

export const metadata: Metadata = { title: "Trends · Tailhelm" };

export default function TrendsPage() {
  return <TabPage tab={TABS[1]} />;
}
