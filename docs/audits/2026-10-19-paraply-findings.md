# Paraply audit findings

Environment: production build, Chrome for Testing 156.0.8078.4 through Playwright and Chrome DevTools Protocol, one warm-up plus three sequential measured runs per viewport. FPS is a controlled SwiftShader lab comparison, not a promise for physical devices.

## Confirmed defects and corrections

### P0 — production build failed on Astro 6.3.1

- Evidence: `npm run build` failed before rendering with `Could not resolve entry module "astro/entrypoints/prerender"` on Node 22 and 24.
- Cause: the project was locked to Astro 6.3.1, whose static prerender bundling failed in this environment. [Astro issue 16679](https://github.com/withastro/astro/issues/16679) documents this 6.3.1 prerender/noExternal failure class.
- Files: `package.json`, `package-lock.json`.
- Correction: updated Astro to 7.4.0. The unchanged page now builds successfully.
- Verification: `npm run build` completes and generates `/index.html`.

### P1 — software WebGL quality exceeded the frame budget

- Evidence: desktop baseline median was 9.11 FPS, 150 ms p95 frame time, 393 frames over 50 ms and 509 long tasks. The renderer was ANGLE/SwiftShader.
- Cause: `src/components/Experience/webgl/QualityManager.ts` detected software rendering but reused a generic low-power preset: a 1440×1100 render buffer, 1,450 CPU-updated rain particles and three fog layers.
- Correction: added an explicit software-renderer preset with 0.5 render scale, 400 rain particles, 600 word particles, one fog layer and no postprocessing. Hardware-rendered desktop quality is unchanged.
- Verification: desktop median improved to 23.15 FPS; p95 frame time fell to 83.4 ms; long tasks fell from 509 to 47 and their total duration from 51,468 to 4,421 ms.

### P1 — desktop WebGL loop ran behind later chapters

- Evidence: `requestAnimationFrame` work and WebGL long tasks continued after the DOM/canvas editorial transformation covered the opening scene.
- Cause: `src/components/Experience/animations/NarrativeTimeline.ts` paused `ExperienceScene` at editorial progress only for mobile/coarse pointers. Desktop kept rain, fog, wet-road, parallax and rendering active behind the later chapters.
- Correction: use the existing pause/resume boundary on every viewport and pause on final leave; resume when scrolling back.
- Verification: full forward traversal and fallback tests pass at all three viewports; later-chapter screenshots retain the intended composition.

### P2 — later images lacked loading hints and intrinsic dimensions

- Evidence: five later-chapter `<img>` elements had no `loading`, `fetchpriority`, `width` or `height` attributes.
- Cause: `src/components/Experience/Experience.astro` used plain eager images; `Experience.ts` also requested explicit decoding during an early idle callback.
- Correction: added intrinsic dimensions, `loading="lazy"`, `fetchpriority="low"` and retained asynchronous decoding. Explicit readiness decoding is delayed until after the authored intro.
- Verification: no blank chapter checkpoints or layout regressions. The browser still fetched the assets during the full automated journey, so no transfer-byte saving is claimed for this path.

### P2 — static fallback served multi-megabyte PNGs

- Evidence: `src/components/Hero/Hero.astro` imported `street.png` (2,201.5 KB) and `child.png` (2,234.2 KB), although matching WebP assets already existed at 170.9 KB and 151.0 KB.
- Cause: fallback imports pointed to the PNG sources.
- Correction: switched only the fallback imports to the existing WebP files and added intrinsic dimensions.
- Verification: fallback source payload fell from 4,435.7 KB to 321.9 KB (−92.7%); reduced-motion screenshots and assertions pass on desktop, tablet and mobile.

## Checked and not defective

- The DOM contains two H1 elements because the static fallback is pre-rendered, but exactly one is visible and exposed in the accessibility tree in every tested mode. No duplicate accessible hero heading was found.
- Heading order is H1 then H2; one `main` landmark is present.
- All seven `<img>` elements have `alt`; the images are decorative and sit in hidden/decorative scene containers.
- No horizontal overflow was found at 1440×1100, 768×1024 or 390×844.
- The page intentionally contains no buttons, links or menus, so there are no interactive controls to repair.
- No browser console errors or failed first-party requests occurred in the nine before or nine after runs.
- Navigation CLS is 0 at all viewports.

## Intentional metric constraints

- LCP is the second hero title span and occurs at 4.54–5.22 seconds because the authored intro reveals it at timeline time 4.35 seconds over 0.72 seconds. Changing this would alter the intended pacing, so it was measured but not automatically changed.
- The desktop journey-only CLS value of 1.0 occurs exactly when ScrollTrigger releases the full-viewport pinned canvas at the end of the sequence. A CSS attempt to reserve the overlap in advance neither changed the metric nor preserved the final composition, so it was reverted. Initial/navigation CLS remains 0; this intentional transition is reported rather than disguised.
- Astro reports one 666.6 KB minified Experience chunk before transfer compression. The complete measured non-image transfer is about 222 KB, and splitting the tightly ordered GSAP/Three.js sequence was not justified by a verified startup bottleneck in this pass. Treat route-level code splitting as a future architectural experiment, not an automatic fix.

## Manual factual/legal review — no automatic edits

- “Today, 1 in 3 children in Sweden will experience sexual violence at some point.” Verify source, population definition and date.
- “With us, you can remain anonymous.” Verify it against the actual service flow.
- “All our conversations and chats are confidential.” Verify scope, exceptions, retention and safeguarding/legal duties.
