import { beforeEach, describe, expect, it, vi } from "vitest";
import { checkCapture, sendStart, sendStop } from "@/app/(app)/happening-now/actions";
import { readCaptures, startCapture, stopCapture } from "./local";
import { finishedAs, sendCapture, settleCaptures } from "./sync";

vi.mock("@/app/(app)/happening-now/actions", () => ({ sendStart: vi.fn(), sendStop: vi.fn(), checkCapture: vi.fn() }));

const DOG = "d0000000-0000-4000-8000-000000000001";
const THEIRS = "e0000000-0000-4000-8000-0000000000ff";
const start = vi.mocked(sendStart);
const stop = vi.mocked(sendStop);
const check = vi.mocked(checkCapture);
let online: boolean;

beforeEach(() => {
  const store = new Map<string, string>();
  online = true;
  vi.stubGlobal("window", {
    localStorage: {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    },
    dispatchEvent: () => true,
  });
  vi.stubGlobal("navigator", {
    get onLine() {
      return online;
    },
  });
  start.mockReset().mockResolvedValue({ ok: true });
  stop.mockReset().mockResolvedValue({ ok: true });
  check.mockReset();
});

describe("sendCapture", () => {
  it("sends a timer kept with no signal, start then stop, once there is one, then forgets it", async () => {
    online = false;
    const c = startCapture(DOG);
    stopCapture(c, [{ key: "long", afterMinutes: 0, ownerWording: "x" }]);
    await sendCapture();
    expect(start).not.toHaveBeenCalled();
    online = true;
    await sendCapture();
    expect(start).toHaveBeenCalledWith({ id: c.id, dogId: DOG, startedAt: c.startedAt });
    expect(stop).toHaveBeenCalledWith(expect.objectContaining({ id: c.id, passed: ["long"] }));
    expect(start.mock.invocationCallOrder[0]).toBeLessThan(stop.mock.invocationCallOrder[0]);
    expect(readCaptures()).toEqual([]);
    expect(finishedAs(c.id)).toEqual({ id: c.id, stoppedAt: null });
  });

  it("joins the timer another phone already has running, and stops that one", async () => {
    start.mockResolvedValue({ joined: { id: THEIRS, startedAt: "2026-10-19T02:10:00.000Z" } });
    const c = startCapture(DOG);
    await sendCapture();
    expect(readCaptures()).toEqual([expect.objectContaining({ id: THEIRS, startedAt: "2026-10-19T02:10:00.000Z", sentStart: true })]);
    stopCapture(readCaptures()[0], []);
    await sendCapture();
    expect(stop).toHaveBeenCalledWith(expect.objectContaining({ id: THEIRS }));
    expect(c.id).not.toBe(THEIRS);
  });

  it("keeps the time kept when another phone's stop landed first", async () => {
    stop.mockResolvedValue({ alreadyStopped: { endedAt: "2026-10-19T02:15:00.000Z" } });
    const c = startCapture(DOG);
    stopCapture(c, []);
    await sendCapture();
    expect(finishedAs(c.id)).toEqual({ id: c.id, stoppedAt: "2026-10-19T02:15:00.000Z" });
  });

  it("keeps everything when Tailhelm can't take it, and sends nothing out of order", async () => {
    start.mockResolvedValueOnce({ failed: true });
    const first = startCapture(DOG);
    stopCapture(first, []);
    const second = startCapture(DOG);
    await sendCapture();
    expect(start).toHaveBeenCalledTimes(1);
    expect(readCaptures().map((c) => c.id)).toEqual([first.id, second.id]);
    await sendCapture();
    expect(start.mock.calls.map(([c]) => c.id)).toEqual([first.id, first.id, second.id]);
    expect(readCaptures().map((c) => [c.id, c.sentStart])).toEqual([[second.id, true]]);
  });

  it("goes round again for a stop made while a start was on its way", async () => {
    let arrive: (v: { ok: true }) => void = () => {};
    start.mockReturnValueOnce(new Promise((r) => (arrive = r)));
    const c = startCapture(DOG);
    const first = sendCapture();
    stopCapture(c, []);
    const second = sendCapture();
    arrive({ ok: true });
    await first;
    await second;
    expect(stop).toHaveBeenCalledTimes(1);
    expect(readCaptures()).toEqual([]);
  });
});

describe("settleCaptures", () => {
  it("forgets a timer that another phone stopped, and keeps one still running", async () => {
    const c = startCapture(DOG);
    await sendCapture();
    check.mockResolvedValueOnce({ running: true });
    await settleCaptures();
    expect(readCaptures()).toHaveLength(1);
    check.mockResolvedValueOnce({ stoppedAt: "2026-10-19T02:15:00.000Z" });
    await settleCaptures();
    expect(readCaptures()).toEqual([]);
    expect(check).toHaveBeenCalledWith(c.id);
  });
});
