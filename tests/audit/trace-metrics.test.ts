import assert from "node:assert/strict";
import test from "node:test";
import { summarizeTrace, type TraceEvent } from "./trace-metrics.ts";

test("summarizeTrace calculates renderer frame pacing and long tasks", () => {
  const events: TraceEvent[] = [
    { name: "thread_name", pid: 1, tid: 7, args: { name: "CrRendererMain" } },
    { name: "thread_name", pid: 1, tid: 8, args: { name: "Compositor" } },
    { name: "DrawFrame", ts: 0 },
    { name: "DrawFrame", ts: 16_000 },
    { name: "DrawFrame", ts: 32_000 },
    { name: "DrawFrame", ts: 96_000 },
    { name: "RunTask", pid: 1, tid: 7, dur: 80_000 },
    { name: "RunTask", pid: 1, tid: 7, dur: 49_999 },
    { name: "RunTask", pid: 1, tid: 8, dur: 120_000 },
  ];

  const summary = summarizeTrace(events);

  assert.equal(summary.drawFrames, 4);
  assert.equal(summary.meanFps, 31.25);
  assert.equal(summary.p95FrameMs, 64);
  assert.equal(summary.framesOver50Ms, 1);
  assert.equal(summary.longTaskCount, 1);
  assert.equal(summary.longTaskTotalMs, 80);
  assert.equal(summary.longestTaskMs, 80);
});
