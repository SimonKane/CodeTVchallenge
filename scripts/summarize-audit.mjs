import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const label = process.argv[2];
if (!label) throw new Error("Usage: npm run audit:summarize -- <label>");
const root = path.resolve("audit-results", label);
const projects = (await readdir(root, { withFileTypes: true }))
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name);
const fields = [
  "lcpMs",
  "cls",
  "journeyCls",
  "meanFps",
  "p95FrameMs",
  "framesOver50Ms",
  "longTaskCount",
  "longTaskTotalMs",
  "longestTaskMs",
  "totalTransferBytes",
  "imageTransferBytes",
  "preIntroTransferBytes",
  "preIntroImageTransferBytes",
];
const median = (numbers) => {
  const sorted = [...numbers].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
};
const output = { label, projects: {} };
for (const project of projects) {
  const directory = path.join(root, project);
  const runs = (await readdir(directory, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .map(async (entry) => JSON.parse(await readFile(path.join(directory, entry.name, "metrics.json"), "utf8")));
  const metrics = await Promise.all(runs);
  output.projects[project] = {
    runs: metrics.length,
    viewport: metrics[0]?.viewport,
    browserVersion: metrics[0]?.browserVersion,
    medians: Object.fromEntries(fields.map((field) => [field, median(metrics.map((run) => run[field]))])),
    consoleErrors: [...new Set(metrics.flatMap((run) => run.consoleErrors))],
    failedRequests: [...new Set(metrics.flatMap((run) => run.failedRequests))],
    semantics: metrics[0]?.semantics,
    lcpElements: [...new Set(metrics.map((run) => run.lcpElement))],
    layoutShifts: metrics.flatMap((run) => run.layoutShifts),
  };
}
const outputPath = path.join(root, "summary.json");
await writeFile(outputPath, JSON.stringify(output, null, 2));
console.log(outputPath);
