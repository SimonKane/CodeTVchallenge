# Paraply Technical and Visual Audit Design

## Objective

Audit the complete Paraply experience on representative desktop, tablet, and mobile viewports, identify exact causes before editing code, repair only verified defects, and demonstrate the effect with repeatable before-and-after measurements. Preserve the existing visual identity, narrative, content, and intended animation choreography.

## Scope and constraints

- Cover the single Astro experience from initial navigation through the final umbrella chapter, including its WebGL, Canvas 2D, GSAP, ScrollTrigger, CSS, and static fallback paths.
- Test desktop at 1440 x 1100, tablet at 768 x 1024, and mobile at 390 x 844. Use the same browser version, production build, viewport, device scale assumptions, and scripted journey for every before-and-after comparison.
- Keep all statistics, privacy statements, safeguarding claims, and other legal or factual assertions unchanged. Record questionable assertions for manual review only.
- Preserve composition, typography, colors, pacing, transitions, and intended effects. A performance fix may reduce invisible work or adapt implementation detail, but it must not redesign the page.
- Do not add unrelated features or broadly refactor working systems.
- Treat generated build output and raw source PNG files as non-delivery artifacts unless a verified finding requires a source-asset change.

## Audit method

### Reproducible baseline

Build and serve the production output locally. Automate one deterministic journey per viewport with Playwright: load from a clean context, wait for the scene to become ready or enter fallback, scroll through the entire narrative in controlled increments, exercise every available link, button, menu, and other interactive control, and capture screenshots at stable narrative checkpoints.

Collect browser console errors, failed requests, transferred resource sizes, image dimensions, and DOM snapshots. Repeat each performance journey three times after one warm-up run and report the median so that compilation, browser startup, and one-off shader work do not dominate the comparison.

### Chrome performance evidence

Capture Chrome DevTools Protocol performance traces during the same scripted journey. Derive:

- frame throughput and dropped/long frames during active scrolling;
- main-thread tasks at or above 50 ms, including their duration and attributable call stacks where Chrome exposes them;
- LCP and its selected element;
- CLS and the individual layout-shift sources;
- layout, style recalculation, paint, composite, scripting, GPU, and raster activity relevant to visible stutter.

FPS is reported as an observed trace statistic for the controlled local journey, not as a universal device guarantee. LCP and CLS are lab measurements, clearly labeled as such.

### Technical inspection

Trace every confirmed symptom back to its code path before editing. The review includes:

- global listeners, ScrollTrigger normalization, scroll locks, programmatic `scrollTo` calls, and cleanup paths;
- every persistent `requestAnimationFrame` loop, its pause/visibility behavior, canvas resolution, object allocation, and work performed when offscreen;
- GSAP property choices and CSS properties that trigger layout or paint instead of compositor-only work;
- WebGL quality selection, draw workload, postprocessing, texture loading, disposal, resize behavior, and mobile adaptation;
- image formats, intrinsic dimensions, decode behavior, priority, lazy/eager strategy, duplicate payloads, and whether an image participates in LCP;
- heading hierarchy, duplicate visible or accessible hero content, landmark/region semantics, language metadata, hidden content, and meaningful versus decorative image alternatives;
- overflow, clipping, text wrapping, hit targets, stacking, and orientation changes across the three viewports;
- all discoverable controls and navigation targets, including keyboard operation where applicable.

## Finding and change policy

Maintain a finding ledger containing the symptom, reproduction viewport and step, metric or screenshot evidence, exact source file and code path, root cause, severity, and proposed smallest safe repair. No production source edit is made for an item until this record identifies the cause.

Prioritize in this order:

1. broken interactions, runtime errors, inaccessible content, or unusable responsive layouts;
2. scroll stutter, long tasks, frame drops, runaway animation work, or lifecycle leaks;
3. LCP, CLS, image transfer, unnecessary layout/paint, and semantic defects;
4. minor visual inconsistencies with objective evidence.

Implement only findings that reproduce or have direct static evidence. Prefer lifecycle cleanup, work throttling, avoiding redundant writes, correct resource priority, responsive sizing, and compositor-safe properties. Keep adaptive degradation behind existing quality and reduced-motion behavior where possible.

## Verification

After each coherent fix, run the relevant build/type checks and a focused browser reproduction. At the end, repeat the complete baseline matrix under identical conditions. Compare checkpoint screenshots for unintended design changes and manually inspect the beginning, every narrative transition, the final chapter, and the fallback/reduced-motion path.

The work is complete when:

- the production build succeeds;
- the scripted journey completes at all three viewports without uncaught errors or failed first-party requests;
- verified controls and navigation targets operate as intended;
- fixed semantic and responsive defects have explicit regression checks;
- performance changes show neutral or improved median trace results, with any regression explained and rejected unless necessary for correctness;
- no statistics or legal/factual assertions were edited;
- the final report lists each confirmed problem, exact files changed, the repair, and comparable before-and-after values for FPS/frame pacing, long tasks, LCP, CLS, and transferred image bytes.

## Deliverables

- Minimal source changes for verified findings.
- Reusable Playwright/CDP audit coverage or scripts kept with the project when they provide stable regression value.
- Before-and-after screenshots and machine-readable measurements stored as audit artifacts, excluding unnecessarily large raw traces from version control.
- A concise Swedish report separating fixed defects, unchanged observations, and statistics/legal statements requiring manual review.
