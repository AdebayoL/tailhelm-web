import { describe, expect, it } from "vitest";
import { parseLocal, runningIn } from "./local";

const ok = {
  id: "e0000000-0000-4000-8000-000000000001",
  dogId: "d0000000-0000-4000-8000-000000000001",
  startedAt: "2026-10-19T02:12:00.000Z",
  endedAt: null,
  passed: [],
  sentStart: false,
  sentStop: false,
};
const stopped = { ...ok, id: "e0000000-0000-4000-8000-000000000002", endedAt: "2026-10-19T02:16:12.000Z", passed: ["long"], sentStart: true };

describe("parseLocal", () => {
  it("reads back a running capture and a stopped one still waiting to be sent, in order", () => {
    expect(parseLocal(JSON.stringify([stopped, ok]))).toEqual([stopped, ok]);
  });

  it("leaves out anything it can't trust", () => {
    expect(parseLocal(null)).toEqual([]);
    expect(parseLocal("not json")).toEqual([]);
    expect(parseLocal(JSON.stringify(ok))).toEqual([]);
    expect(parseLocal(JSON.stringify([{ ...ok, id: "1" }, ok]))).toEqual([ok]);
    expect(parseLocal(JSON.stringify([{ ...ok, startedAt: "yesterday" }]))).toEqual([]);
    expect(parseLocal(JSON.stringify([{ ...ok, endedAt: 5 }]))).toEqual([]);
    expect(parseLocal(JSON.stringify([null, 3, "x"]))).toEqual([]);
  });

  it("keeps only the limit keys that are text", () => {
    expect(parseLocal(JSON.stringify([{ ...ok, passed: ["a", 2, null] }]))[0].passed).toEqual(["a"]);
  });
});

describe("runningIn", () => {
  it("finds the dog's running capture, not one that has stopped or is another dog's", () => {
    expect(runningIn([stopped, ok], ok.dogId)).toEqual(ok);
    expect(runningIn([stopped], ok.dogId)).toBeNull();
    expect(runningIn([ok], "d0000000-0000-4000-8000-000000000002")).toBeNull();
  });
});
