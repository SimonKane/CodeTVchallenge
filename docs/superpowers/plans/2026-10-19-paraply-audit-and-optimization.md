# Paraply Audit and Optimization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Measure the complete Paraply experience, repair only evidence-backed defects, and publish comparable before-and-after results without changing its design or claims.

**Architecture:** A Playwright runner drives one deterministic Chrome journey at three viewports while browser observers and the Chrome DevTools Protocol collect Web Vitals, frame timing, long tasks, requests, console failures, screenshots, and a performance trace. The initial run creates a locked finding ledger; production fixes are then limited to ledger entries and the same runner verifies each change against the saved baseline.

**Tech Stack:** Astro 6, TypeScript, Playwright, Chrome DevTools Protocol, GSAP/ScrollTrigger, Three.js, Canvas 2D, CSS.

**Spec:** `docs/superpowers/specs/2026-10-19-paraply-technical-visual-audit-design.md`

## Global Constraints

- Test production output at 1440 x 1100, 768 x 1024, and 390 x 844.
- Run one warm-up plus three measured journeys per viewport and compare medians.
- Identify the exact source path and cause before changing production code.
- Preserve composition, typography, colors, pacing, transitions, and intended effects.
- Never alter statistics, privacy statements, safeguarding claims, or other legal/factual assertions automatically.
- Keep raw traces and generated screenshots out of version control; commit compact JSON/Markdown evidence only when useful.

---

### Task 1: Add the repeatable Chrome audit harness

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `.gitignore`
- Create: `playwright.config.ts`
- Create: `tests/audit/paraply.audit.spec.ts`
- Create: `tests/audit/browser-observers.ts`
- Create: `tests/audit/trace-metrics.ts`
- Create: `tests/audit/trace-metrics.test.ts`

**Interfaces:**
- Produces: `AuditMetrics`, `ViewportAudit`, and `summarizeTrace(events)` for the baseline and comparison tasks.
- Produces: `npm run audit` using installed Google Chrome and the production preview server.

- [ ] **Step 1: Add the metric contracts and a failing trace-parser test**

Define `AuditMetrics` with `lcpMs`, `cls`, `longTasks`, `frameCount`, `meanFps`, `p95FrameMs`, `framesOver50Ms`, `transferBytes`, `imageTransferBytes`, `consoleErrors`, and `failedRequests`. Add a fixture containing `DrawFrame`, `RunTask`, resource, LCP, and layout-shift events and assert exact aggregate values in `tests/audit/trace-metrics.test.ts`.

- [ ] **Step 2: Run the focused test and confirm the missing implementation failure**

Run: `npx playwright test tests/audit/trace-metrics.test.ts --project=desktop`

Expected: FAIL because `summarizeTrace` is not implemented.

- [ ] **Step 3: Implement browser observers and trace parsing**

Use `PerformanceObserver` through `page.addInitScript` for `largest-contentful-paint`, `layout-shift`, and `longtask`. Accumulate CLS only for shifts without recent input and serialize source selectors. Use a CDP session with `Tracing.start` categories `devtools.timeline,loading,blink.user_timing,disabled-by-default-devtools.timeline.frame` and `ReturnAsStream`; parse `DrawFrame` timestamps for observed frame cadence and `RunTask` durations of at least 50 ms for long tasks. Record `PerformanceResourceTiming.transferSize` and image `initiatorType` separately.

- [ ] **Step 4: Implement the deterministic narrative journey**

Configure projects named `desktop`, `tablet`, and `mobile` with the exact viewports in Global Constraints, `channel: "chrome"`, fresh browser contexts, reduced motion disabled, screenshots on failure, and a production `webServer` command of `npm run preview -- --host 127.0.0.1`. In the audit test, wait for `[data-cinematic-scene]` to reach `ready` or `fallback`, advance with fixed `mouse.wheel(0, 480)` inputs and 80 ms settling intervals until the final umbrella heading is exposed or the document bottom is reached, then save checkpoint screenshots and compact JSON results beneath `audit-results/current/<project>/`.

- [ ] **Step 5: Add functional and semantic assertions to the same journey**

Assert no uncaught page errors, no failed first-party requests, one visible and accessible `h1`, ordered heading levels, one `main`, a nonempty document title and description, decorative images with empty alternatives only inside `aria-hidden` media, meaningful images with nonempty alternatives, no viewport-width overflow beyond one CSS pixel, and no interactive element with a missing target or disabled pointer/keyboard activation. Record absence of buttons, links, or menus as an explicit observation rather than a failure.

- [ ] **Step 6: Wire dependencies, scripts, and generated artifacts**

Install `@playwright/test` as a development dependency, add `"audit": "playwright test tests/audit/paraply.audit.spec.ts"` and `"test:audit-unit": "playwright test tests/audit/trace-metrics.test.ts"`, and ignore `audit-results/`, `playwright-report/`, and `test-results/`.

- [ ] **Step 7: Run the parser and production checks**

Run: `npm run test:audit-unit`

Expected: PASS with exact fixture aggregates.

Run: `npm run build`

Expected: Astro build exits successfully.

- [ ] **Step 8: Commit the harness**

```bash
git add package.json package-lock.json .gitignore playwright.config.ts tests/audit
git commit -m "test: add repeatable Paraply performance audit"
```

### Task 2: Capture and lock the before baseline

**Files:**
- Create: `docs/audits/2026-10-19-paraply-findings.md`
- Create: `docs/audits/2026-10-19-paraply-before.json`

**Interfaces:**
- Consumes: `npm run audit` and the `ViewportAudit` JSON schema from Task 1.
- Produces: immutable baseline medians and a finding ledger that gates all product edits.

- [ ] **Step 1: Run one warm-up journey across all viewports**

Run: `npm run audit -- --repeat-each=1`

Expected: all three projects complete; warm-up results are discarded from medians.

- [ ] **Step 2: Run three measured journeys per viewport**

Run: `npm run audit -- --repeat-each=3`

Expected: nine successful measured journeys with a trace, metrics JSON, and checkpoint screenshots for each run.

- [ ] **Step 3: Inspect the Chrome traces and screenshots**

Open the median trace from each viewport in Chrome DevTools Performance, inspect every task at or above 50 ms, correlate scroll-stutter windows with main-thread/GPU/raster work, and compare screenshots at the hero, editorial transition, hidden-message sequence, problem copy, and safe-place ending. Record the initiating function and source map location when available.

- [ ] **Step 4: Inspect all relevant source paths against the trace evidence**

Review `Experience.ts`, `NarrativeTimeline.ts`, `EditorialTransformation.ts`, `UmbrellaChapter.ts`, `UmbrellaRainCanvas.ts`, `WaterTextReveal.ts`, `LightningCanvas.ts`, `ExperienceScene.ts`, every class in `webgl/`, `Experience.css`, `Experience.astro`, the Hero fallback, global styles, and all imported image assets. For each symptom, document the precise listener, animation frame, GSAP tween, canvas draw, resource request, DOM structure, or CSS declaration that causes it.

- [ ] **Step 5: Write the locked finding ledger**

For every confirmed issue add: severity, viewport, reproduction point, before metric, screenshot/trace artifact, exact file and symbol or selector, root cause, smallest safe correction, and verification assertion. Add separate sections for observations that are not defects and factual/legal claims that require human review. Do not propose copy changes for those claims.

- [ ] **Step 6: Save compact baseline medians**

Write one JSON object per viewport containing median LCP, CLS, mean FPS, p95 frame time, frames over 50 ms, long-task count and total duration, total transfer bytes, image transfer bytes, console error count, and failed-request count. Exclude raw traces from Git.

- [ ] **Step 7: Commit the evidence before product changes**

```bash
git add docs/audits/2026-10-19-paraply-findings.md docs/audits/2026-10-19-paraply-before.json
git commit -m "docs: record Paraply performance baseline"
```

### Task 3: Turn confirmed findings into regression tests

**Files:**
- Modify: `tests/audit/paraply.audit.spec.ts`
- Modify: `tests/audit/trace-metrics.test.ts`
- Modify: `docs/audits/2026-10-19-paraply-findings.md`

**Interfaces:**
- Consumes: confirmed entries in the locked finding ledger.
- Produces: one failing, deterministic assertion for every functional, semantic, lifecycle, layout, or resource defect that can be automated.

- [ ] **Step 1: Add focused assertions for every automatable finding**

Use DOM/state assertions for semantic and interaction bugs, listener/animation counters exposed only in the test build for lifecycle bugs, request/resource assertions for image bugs, and screenshot masks only for stable layout regions. Performance thresholds must be relative to the saved baseline or broad guardrails; do not encode a single-run FPS value as a pass/fail contract.

- [ ] **Step 2: Run each new assertion against the unmodified product**

Run the narrowest Playwright project and test title for each finding.

Expected: the new assertion fails for the documented reason, while existing audit-unit tests continue to pass.

- [ ] **Step 3: Mark non-automatable findings with a repeatable manual check**

For a visual timing or compositing defect that cannot be stable in automation, add the exact viewport, scroll checkpoint, trace event range, screenshot name, and visible pass condition to the ledger.

- [ ] **Step 4: Commit the regression coverage**

```bash
git add tests/audit docs/audits/2026-10-19-paraply-findings.md
git commit -m "test: capture verified Paraply regressions"
```

### Task 4: Repair verified defects in priority order

**Files:**
- Modify only production files named by confirmed finding entries.
- Modify: `docs/audits/2026-10-19-paraply-findings.md`

**Interfaces:**
- Consumes: a failing regression or repeatable manual check plus the exact root cause from Tasks 2 and 3.
- Produces: the smallest passing correction for each P0, P1, or P2 finding; P3 observations remain documented unless they have measurable user impact.

- [ ] **Step 1: Fix correctness and interaction findings individually**

For each P0/P1 entry, edit only its identified source path, rerun its focused failing assertion, and confirm keyboard, pointer, and touch behavior at the affected viewport. Do not combine unrelated fixes in one edit or commit.

- [ ] **Step 2: Fix scroll and animation workload findings individually**

Apply only the evidenced mechanism: coalesce redundant scroll writes into one frame, eliminate competing normalization/lock work, pause offscreen loops, remove per-frame allocations, cap canvas resolution, reduce invisible draw work through the existing quality preset, or replace layout/paint animation with an equivalent compositor-safe transform. Preserve progress mapping and visible timing, then compare the affected trace interval and checkpoint screenshot before accepting the fix.

- [ ] **Step 3: Fix image-loading findings individually**

Correct intrinsic dimensions, eager/lazy priority, decode timing, responsive source sizing, or source format only when its resource waterfall or LCP evidence warrants it. Keep transparent assets visually lossless and compare rendered checkpoints at native and high-density displays. Do not delete source PNGs merely because WebP derivatives are served.

- [ ] **Step 4: Fix semantic and responsive findings individually**

Correct only confirmed heading exposure, landmark labeling, alternative text, overflow, clipping, wrapping, or hit-target failures. Verify the accessibility tree as well as visual output so hidden fallback content does not create duplicate accessible hero headings.

- [ ] **Step 5: Verify cleanup and fallback paths after every lifecycle change**

Navigate away/reload where supported, toggle page visibility, resize through all breakpoints, emulate reduced motion, and force the no-WebGL fallback. Assert that observers, listeners, ScrollTriggers, animation frames, WebGL resources, and image decode callbacks are released or paused as designed.

- [ ] **Step 6: Commit each coherent verified repair**

Stage only the regression and production files for that finding and use `fix:` commits whose subject names the observed defect. Leave unrelated working-tree changes untouched.

### Task 5: Run the complete after matrix and visual regression review

**Files:**
- Create: `docs/audits/2026-10-19-paraply-after.json`
- Modify: `docs/audits/2026-10-19-paraply-findings.md`

**Interfaces:**
- Consumes: the same runner, Chrome version, viewport matrix, journey, and aggregation rules as the before baseline.
- Produces: comparable after medians and a closed/open disposition for every finding.

- [ ] **Step 1: Run all static and unit checks**

Run: `npm run test:audit-unit`

Run: `npm run build`

Expected: both exit successfully with no new warnings attributable to the changes.

- [ ] **Step 2: Run one warm-up and three measured after journeys**

Run: `npm run audit -- --repeat-each=1`

Discard the warm-up, then run: `npm run audit -- --repeat-each=3`

Expected: all measured journeys finish without uncaught errors or failed first-party requests.

- [ ] **Step 3: Compare median metrics**

For each viewport compare LCP, CLS, mean FPS, p95 frame time, frames over 50 ms, long-task count and total duration, total transfer bytes, and image transfer bytes. Reject or revise any performance change that regresses its target metric without a necessary correctness reason.

- [ ] **Step 4: Compare visual checkpoints and full narrative behavior**

Overlay matching before/after checkpoints and manually traverse the complete experience on desktop, tablet, mobile, reduced motion, and no-WebGL fallback. Accept differences only when they are the documented correction; verify typography, composition, color, animation order, and pacing remain intact.

- [ ] **Step 5: Close the ledger and save after medians**

Mark each finding fixed, intentionally unchanged, not reproducible, or flagged for manual review. Record after values beside before values and state measurement variance where it affects interpretation.

- [ ] **Step 6: Commit verification evidence**

```bash
git add docs/audits/2026-10-19-paraply-after.json docs/audits/2026-10-19-paraply-findings.md
git commit -m "docs: verify Paraply audit fixes"
```

### Task 6: Deliver the concise Swedish report

**Files:**
- Create: `docs/audits/2026-10-19-paraply-report-sv.md`
- Modify: `README.md`

**Interfaces:**
- Consumes: before/after medians and the closed finding ledger.
- Produces: the requested short report and a discoverable project link to it.

- [ ] **Step 1: Write the report**

Use four compact sections: verifierade problem och orsaker; ändringar med exact source paths; a before/after table per viewport for FPS/frame pacing, long tasks, LCP, CLS, and image bytes; and manual-review flags for statistics/legal claims. Clearly label measurements as local Chrome lab results.

- [ ] **Step 2: Add a README link without changing project claims**

Add one audit/report link to the README tools or documentation area. Do not rewrite the existing project description or any Paraply-related claim.

- [ ] **Step 3: Run final checks and inspect the diff**

Run: `npm run build`

Run: `npm run test:audit-unit`

Run: `git diff --check`

Expected: all pass; the diff contains no change to statistics or legal/factual copy.

- [ ] **Step 4: Commit the report**

```bash
git add README.md docs/audits/2026-10-19-paraply-report-sv.md
git commit -m "docs: publish Paraply audit results"
```
