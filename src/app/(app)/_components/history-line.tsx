import { FREE_DAYS } from "@/lib/history/window";

/**
 * Said once, where a free account's history stops, and only when there is
 * something older: what happens to it, and the summary that shows the vet
 * 90 days on any plan. It never says what the older records hold.
 */
export function HistoryLine() {
  return (
    <p className="hint">
      Free accounts show the last {FREE_DAYS} days. Everything older is kept, and appears again with Tailhelm Plus.
      The{" "}
      {/* A plain link: the file downloads, so there is no page to prefetch. */}
      <a href="/dog/summary" download>
        90-day summary
      </a>{" "}
      covers the last 90 days on any plan.
    </p>
  );
}
