export type TraceEvent = {
  name?: string;
  cat?: string;
  ph?: string;
  pid?: number;
  tid?: number;
  ts?: number;
  dur?: number;
  args?: { name?: string };
};

export type TraceSummary = {
  drawFrames: number;
  meanFps: number;
  p95FrameMs: number;
  framesOver50Ms: number;
  longTaskCount: number;
  longTaskTotalMs: number;
  longestTaskMs: number;
};

const percentile = (values: number[], fraction: number) => {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * fraction) - 1)];
};

export function summarizeTrace(events: TraceEvent[]): TraceSummary {
  const rendererThreads = new Set(
    events
      .filter((event) => event.name === "thread_name" && /renderer.?main/i.test(event.args?.name ?? ""))
      .map((event) => `${event.pid}:${event.tid}`),
  );
  const onRendererMain = (event: TraceEvent) =>
    rendererThreads.size === 0 || rendererThreads.has(`${event.pid}:${event.tid}`);

  const frameTimestamps = events
    .filter((event) => event.name === "DrawFrame" && typeof event.ts === "number")
    .map((event) => event.ts as number)
    .sort((a, b) => a - b);
  const frameIntervals = frameTimestamps
    .slice(1)
    .map((timestamp, index) => (timestamp - frameTimestamps[index]) / 1000)
    .filter((duration) => duration > 0 && duration < 1000);
  const elapsedSeconds = frameTimestamps.length > 1
    ? (frameTimestamps.at(-1)! - frameTimestamps[0]) / 1_000_000
    : 0;
  const taskDurations = events
    .filter(
      (event) =>
        event.name === "RunTask" &&
        typeof event.dur === "number" &&
        event.dur >= 50_000 &&
        onRendererMain(event),
    )
    .map((event) => (event.dur as number) / 1000);

  return {
    drawFrames: frameTimestamps.length,
    meanFps: elapsedSeconds > 0 ? (frameTimestamps.length - 1) / elapsedSeconds : 0,
    p95FrameMs: percentile(frameIntervals, 0.95),
    framesOver50Ms: frameIntervals.filter((duration) => duration >= 50).length,
    longTaskCount: taskDurations.length,
    longTaskTotalMs: taskDurations.reduce((total, duration) => total + duration, 0),
    longestTaskMs: Math.max(0, ...taskDurations),
  };
}
