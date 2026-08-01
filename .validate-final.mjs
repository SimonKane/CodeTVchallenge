import { writeFile } from "node:fs/promises";

const targets = await fetch("http://127.0.0.1:9232/json").then((response) => response.json());
const target = targets.find((entry) => entry.type === "page" && entry.url.includes("127.0.0.1:4387"));
if (!target) throw new Error("Validation page not found");
const socket = new WebSocket(target.webSocketDebuggerUrl);
let id = 0;
const pending = new Map();
const listeners = new Map();
await new Promise((resolve, reject) => {
  socket.addEventListener("open", resolve, { once: true });
  socket.addEventListener("error", reject, { once: true });
});
socket.addEventListener("message", ({ data }) => {
  const message = JSON.parse(data);
  if (message.id) {
    const request = pending.get(message.id);
    if (!request) return;
    pending.delete(message.id);
    message.error
      ? request.reject(new Error(message.error.message))
      : request.resolve(message.result);
    return;
  }
  for (const listener of listeners.get(message.method) ?? []) listener(message.params);
});
const send = (method, params = {}) => new Promise((resolve, reject) => {
  const requestId = ++id;
  pending.set(requestId, { resolve, reject });
  socket.send(JSON.stringify({ id: requestId, method, params }));
});
const on = (method, listener) => {
  const group = listeners.get(method) ?? [];
  group.push(listener);
  listeners.set(method, group);
};
const sleep = (duration) => new Promise((resolve) => setTimeout(resolve, duration));
const evaluate = async (expression) => {
  const result = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
  return result.result.value;
};
const errors = [];
on("Runtime.exceptionThrown", ({ exceptionDetails }) => errors.push(exceptionDetails.text));
on("Log.entryAdded", ({ entry }) => {
  if (entry.level === "error") errors.push(entry.text);
});
await send("Page.enable");
await send("Runtime.enable");
await send("Log.enable");

const waitForReady = async () => {
  for (let attempt = 0; attempt < 120; attempt += 1) {
    const state = await evaluate(`({ ready: document.readyState, scene: document.querySelector("[data-cinematic-scene]")?.dataset.sceneStatus })`);
    if (state.ready === "complete" && state.scene === "ready") return;
    await sleep(100);
  }
  throw new Error("Scene did not become ready");
};
const waitForUnlock = async () => {
  for (let attempt = 0; attempt < 180; attempt += 1) {
    const locked = await evaluate(`document.querySelector("[data-experience-chapter]")?.dataset.sequenceLocked === "true"`);
    if (!locked) return;
    await sleep(75);
  }
  const lockState = await evaluate(`({
    scrollY,
    locked: document.querySelector("[data-experience-chapter]")?.dataset.sequenceLocked,
    chapterClasses: document.querySelector("[data-experience-chapter]")?.className
  })`);
  throw new Error(`Sequence lock did not release: ${JSON.stringify(lockState)}`);
};
const scrollRatio = async (ratio, pause = 55) => {
  await evaluate(`window.scrollTo(0, (document.documentElement.scrollHeight - innerHeight) * ${ratio})`);
  await sleep(pause);
  await waitForUnlock();
};
const capture = async (name) => {
  const screenshot = await send("Page.captureScreenshot", { format: "png" });
  await writeFile(name, Buffer.from(screenshot.data, "base64"));
};
const state = () => evaluate(`(() => {
  const opacity = (selector) => Number.parseFloat(getComputedStyle(document.querySelector(selector)).opacity);
  const canvas = document.querySelector("[data-experience-canvas]");
  const open = document.querySelector("[data-umbrella-open]");
  const child = document.querySelector("[data-umbrella-sheltered-child]");
  return {
    scrollY,
    scrollHeight: document.documentElement.scrollHeight,
    scene: document.querySelector("[data-cinematic-scene]")?.dataset.sceneStatus,
    silenceOpacity: opacity("[data-editorial-hidden-message]"),
    silenceLetters: [...document.querySelectorAll("[data-editorial-target-letter]")].filter((node) => Number.parseFloat(getComputedStyle(node).opacity) > .5).length,
    umbrellaOpenOpacity: opacity("[data-umbrella-open]"),
    safeOpacity: opacity("[data-umbrella-safe]"),
    childReveal: getComputedStyle(child).getPropertyValue("--sheltered-child-reveal").trim(),
    layers: { child: getComputedStyle(child).zIndex, open: getComputedStyle(open).zIndex },
    canvases: [...document.querySelectorAll("canvas")].map((item) => ({ className: item.className, css: [item.clientWidth, item.clientHeight], buffer: [item.width, item.height] })),
    waterCanvases: document.querySelectorAll(".experience-water-canvas").length,
    umbrellaCanvases: document.querySelectorAll("[data-umbrella-canopy-rain]").length,
    editorialCanvases: document.querySelectorAll(".editorial-washed-canvas").length,
  };
})()`);

const results = {};
const requestedProfile = process.argv[2];
for (const profile of [
  { name: "desktop", width: 1440, height: 900, dpr: 1, mobile: false },
  { name: "mobile", width: 390, height: 844, dpr: 3, mobile: true },
].filter((profile) => !requestedProfile || profile.name === requestedProfile)) {
  await send("Emulation.setDeviceMetricsOverride", {
    width: profile.width,
    height: profile.height,
    deviceScaleFactor: profile.dpr,
    mobile: profile.mobile,
  });
  await send("Page.reload", { ignoreCache: true });
  await sleep(250);
  await waitForReady();
  await sleep(900);

  let silenceCaptured = false;
  for (let step = 0; step <= 100; step += 1) {
    await scrollRatio(step / 100, 42);
    const current = await state();
    if (!silenceCaptured && current.silenceLetters === 7 && current.umbrellaOpenOpacity < 0.1) {
      await capture(`.visual-${profile.name}-silence.png`);
      silenceCaptured = true;
    }
  }
  await sleep(900);
  await capture(`.visual-${profile.name}-umbrella.png`);
  const forward = await state();

  for (let step = 100; step >= 0; step -= 2) await scrollRatio(step / 100, 32);
  const reverse = await state();
  for (const ratio of [0.62, 0.28, 0.74, 0.41, 0.88, 0.12]) {
    await scrollRatio(ratio, 65);
  }
  const directionChanges = await state();

  await send("Page.setWebLifecycleState", { state: "frozen" });
  await sleep(350);
  await send("Page.setWebLifecycleState", { state: "active" });
  await sleep(350);
  const resumed = await state();

  await scrollRatio(0.46, 100);
  await send("Page.reload", { ignoreCache: false });
  await sleep(250);
  await waitForReady();
  await sleep(500);
  const refreshed = await state();
  results[profile.name] = { silenceCaptured, forward, reverse, directionChanges, resumed, refreshed };
}

console.log(JSON.stringify({ errors, results }, null, 2));
socket.close();
