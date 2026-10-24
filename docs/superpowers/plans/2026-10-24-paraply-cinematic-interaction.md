# Paraply Cinematic Interaction Implementation Plan

> **For agentic workers:** Execute this plan task-by-task in the current branch. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a smooth, tactile Paraply narrative where scroll drives a damped cinematic camera, rain reacts to pointer/touch, and the visible umbrella itself opens without a standalone CTA.

**Architecture:** Add one shared motion-state controller that samples native scroll and normalized pointer input. ScrollTrigger continues to own pinned narrative progress, while GSAP scrub damping and the shared motion state drive visual response. The existing WebGL scene owns depth; the umbrella canvas owns the late rain field; the handoff guarantees that one atmospheric rain layer is always visible.

**Tech Stack:** Astro 7, TypeScript, GSAP/ScrollTrigger, Three.js, Canvas 2D, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-24-paraply-cinematic-interaction-design.md`

## Global Constraints

- Work only on `codex/paraply-production-quality`.
- Preserve Paraply copy, ethical tone, existing imagery, reduced-motion support, and no-WebGL fallback.
- Do not add dependencies.
- Do not render a visible standalone umbrella button.
- Native wheel/touch input must never be prevented or rewritten.
- Do not claim physical-GPU performance unless the renderer string identifies hardware.

---

### Task 1: Shared motion state and smooth visual scroll

**Files:**
- Create: `src/components/Experience/motion/InteractionField.ts`
- Modify: `src/components/Experience/animations/NarrativeTimeline.ts`
- Modify: `src/components/Experience/Experience.ts`
- Test: `tests/audit/interaction-and-scroll.spec.ts`

**Interfaces:**
- Produces: `InteractionField`, `InteractionSnapshot`, `updateScroll()`, `attach()`, `destroy()`.
- Consumes: native `scrollY`, pointer events, viewport size, and `ScrollTrigger` progress.

- [ ] **Step 1: Add failing smooth-response assertions**

```ts
test("native input is preserved while visual progress settles", async ({ page }) => {
  await ready(page);
  const before = await page.evaluate(() => scrollY);
  await page.mouse.wheel(0, 480);
  await expect.poll(() => page.evaluate(() => scrollY - before)).toBeGreaterThanOrEqual(479);
  const samples = await page.evaluate(() => window.__paraplyMotionSamples ?? []);
  expect(samples.some((sample) => sample.visual !== sample.raw)).toBe(true);
});
```

- [ ] **Step 2: Verify the new assertion fails before implementation**

Run: `npx playwright test tests/audit/interaction-and-scroll.spec.ts --project=desktop -g "visual progress settles"`

- [ ] **Step 3: Implement a shared pointer/velocity field**

```ts
export interface InteractionSnapshot {
  pointerX: number;
  pointerY: number;
  pointerVelocityX: number;
  pointerVelocityY: number;
  dragging: boolean;
  scrollVelocity: number;
  scrollDirection: -1 | 0 | 1;
}

export class InteractionField {
  readonly snapshot: InteractionSnapshot;
  attach(): void;
  updateScroll(scrollY: number, time: number): void;
  tick(deltaSeconds: number): InteractionSnapshot;
  destroy(): void;
}
```

Pointer listeners normalize coordinates once, preserve vertical touch scrolling, and decay velocities exponentially in `tick()`.

- [ ] **Step 4: Replace hard scrub with damped visual response**

Use `scrub: 0.72` on desktop, `0.58` for coarse pointers, keep `pin` and stable spacing, and feed ScrollTrigger progress/velocity into `InteractionField`. Do not add wheel or touch interception.

- [ ] **Step 5: Run the focused scroll tests**

Run: `npx playwright test tests/audit/scroll-ux.spec.ts tests/audit/interaction-and-scroll.spec.ts --project=desktop`

Expected: native wheel distance remains 479–481 px; visual progress shows a bounded settling interval; maxScroll stays within one pixel.

### Task 2: WebGL camera, rain, and light response

**Files:**
- Modify: `src/components/Experience/webgl/ExperienceScene.ts`
- Modify: `src/components/Experience/webgl/RainSystem.ts`
- Modify: `src/components/Experience/webgl/FogSystem.ts`
- Test: `tests/audit/interaction-and-scroll.spec.ts`

**Interfaces:**
- Consumes: `InteractionSnapshot` from Task 1.
- Produces: `ExperienceScene.setInteraction(snapshot)` and input-reactive rain/camera behavior.

- [ ] **Step 1: Add a browser assertion for velocity response**

Expose development/audit-only `data-motion-energy` on the scene root. Assert that a fast wheel raises the value above `0.1` and it decays below `0.03` after settling.

- [ ] **Step 2: Add the scene interface**

```ts
setInteraction(snapshot: InteractionSnapshot) {
  this.interaction = snapshot;
}
```

Apply bounded values only: camera roll at most `0.012` radians, FOV impulse at most `1.4` degrees, pointer parallax at most `0.065` world units.

- [ ] **Step 3: Make WebGL rain respond to the field**

Add shader uniforms `uFlow`, `uPointer`, and `uInteraction`. Scroll velocity changes rain slant; pointer velocity adds a local lateral curl that decays after release. Existing particle count and quality presets remain unchanged.

- [ ] **Step 4: Preserve one-frame ordering**

Update interaction values and camera state before `rain.update`, `fog.update`, `road.update`, and `post.render` inside the existing scene tick.

- [ ] **Step 5: Verify slow, fast, reverse, and pointer behavior**

Run the desktop and mobile interaction specs and inspect the hero, close-up, water-entry, and editorial screenshots.

### Task 3: Make the authored umbrella itself interactive

**Files:**
- Modify: `src/components/Experience/Experience.astro`
- Modify: `src/components/Experience/Experience.css`
- Modify: `src/components/Experience/animations/UmbrellaChapter.ts`
- Test: `tests/audit/interaction-and-scroll.spec.ts`
- Test: `tests/audit/fallback.audit.spec.ts`
- Test: `tests/audit/webgl-fallback.spec.ts`

**Interfaces:**
- Produces: a silhouette-aligned `[data-umbrella-hit-target]` semantic button.
- Consumes: existing open/closed umbrella timeline and accessibility state.

- [ ] **Step 1: Change tests to require no visible CTA**

```ts
const target = page.locator("[data-umbrella-hit-target]");
await expect(target).toBeVisible();
await expect(target).toHaveAccessibleName("Open the umbrella");
await expect(page.getByText("Open the umbrella", { exact: true })).toBeHidden();
```

- [ ] **Step 2: Replace the pill markup**

Use an empty semantic button adjacent to the authored umbrella image:

```astro
<button
  class="umbrella-chapter__hit-target"
  data-umbrella-hit-target
  type="button"
  aria-label="Open the umbrella"
  aria-expanded="false"
  aria-controls="umbrella-safe-copy"
  tabindex="-1"
></button>
```

- [ ] **Step 3: Align interaction geometry to the closed umbrella**

Position the button over the visible closed-canopy bounds, use a canopy-shaped `clip-path`, transparent background, and a `::after` focus/hover rim. Do not display button copy.

- [ ] **Step 4: Add physical response**

Pointer movement tilts the closed umbrella by at most `4deg`; press compresses scale to `0.985`; activation runs the existing opening sequence. Reverse scrolling resets only when the narrative returns before the umbrella chapter.

- [ ] **Step 5: Verify all activation modes**

Run click, tap, Enter, Space, reduced-motion, and no-WebGL tests. Capture closed, hover/focus, pressed, opening, and open states at all viewports.

### Task 4: Interactive and continuous rain handoff

**Files:**
- Modify: `src/components/Experience/animations/UmbrellaRainCanvas.ts`
- Modify: `src/components/Experience/animations/UmbrellaChapter.ts`
- Modify: `src/components/Experience/animations/NarrativeTimeline.ts`
- Test: `tests/audit/interaction-and-scroll.spec.ts`
- Test: `tests/audit/paraply.audit.spec.ts`

**Interfaces:**
- Consumes: `InteractionSnapshot`, canopy bounds, and narrative handoff progress.
- Produces: `setInteraction(snapshot)`, `setCollisionProgress(value)`, and `setVisibility(value)`.

- [ ] **Step 1: Add rain-continuity assertions**

Sample scene-rain and umbrella-rain opacity at 5% intervals. Assert their sum stays above `0.18` from recognition through umbrella entry, except during authored lightning frames.

- [ ] **Step 2: Add the flow-field input**

```ts
setInteraction: (snapshot: InteractionSnapshot) => {
  pointerTarget.x = snapshot.pointerX * width;
  pointerTarget.y = snapshot.pointerY * height;
  pointerForce = Math.min(1, Math.hypot(snapshot.pointerVelocityX, snapshot.pointerVelocityY));
  dragging = snapshot.dragging;
}
```

Drops within a bounded radius receive a decaying lateral impulse. Dragging increases the radius and impulse but never prevents vertical page scroll.

- [ ] **Step 3: Batch passive rain drawing**

Group passive drops into four alpha buckets. Draw one path/stroke per bucket. Keep individual strokes only for splashes, crowns, and runoff.

- [ ] **Step 4: Crossfade the rain systems**

Keep WebGL rain at low intensity through the editorial handoff. Fade in the umbrella canvas before WebGL rain reaches zero. Enable canopy collisions only when the closed umbrella is visibly present.

- [ ] **Step 5: Profile and visually inspect**

Measure Canvas operations, p95 frames, ≥50 ms frames, and long tasks. Verify desktop/tablet do not regress and mobile improves or matches the current branch median.

### Task 5: Chapter composition and responsive polish

**Files:**
- Modify: `src/components/Experience/Experience.css`
- Modify: `src/components/Experience/animations/WaterTextReveal.ts`
- Modify: `src/components/Experience/animations/EditorialTransformation.ts`
- Test: `tests/audit/paraply.audit.spec.ts`

**Interfaces:**
- Consumes: existing narrative states and responsive breakpoints.
- Produces: stable, readable compositions for every checkpoint.

- [ ] **Step 1: Capture the current branch checkpoint matrix**

Capture hero, recognition, water entry/readable, editorial, silence, umbrella closed/opening/open, and final at 1440×1100, 768×1024, and 390×844.

- [ ] **Step 2: Remove blank and conflicting states**

Overlap copy transitions so one readable narrative anchor remains visible. Keep editorial rain below copy contrast limits. Ensure the safe copy starts only after canopy motion settles.

- [ ] **Step 3: Correct responsive composition**

Keep face, hand, umbrella apex/edges, headline, and final body inside the viewport. Use a minimum `0.95rem` mobile body size and a restrained localized contrast field instead of a visible card.

- [ ] **Step 4: Capture and inspect the after matrix**

Reject any frame with blank composition, accidental cropping, distorted aspect ratio, text collision, detached control affordance, or abrupt rain disappearance.

### Task 6: Final regression and measured delivery

**Files:**
- Modify: `docs/audits/2026-10-24-paraply-production-report-sv.md`
- Test: all files under `tests/audit/`

- [ ] **Step 1: Run build and unit audit**

Run: `npm run build`

Run: `npm run test:audit-unit`

- [ ] **Step 2: Run the complete Playwright matrix once**

Run: `npx playwright test`

- [ ] **Step 3: Run matched repeated performance measurements**

Run three current-branch measurements per viewport on a renderer identified in `metrics.json`. Keep SwiftShader results labeled software-only.

- [ ] **Step 4: Inspect every final screenshot**

Review all checkpoint and interaction PNGs at original resolution. Do not accept automated pass status as visual approval.

- [ ] **Step 5: Update the Swedish audit report**

Record exact files, tests, before/after metrics, renderer identity, screenshots, interaction behavior, and remaining defects. Remove stale statements about push/deploy state.

- [ ] **Step 6: Verify repository state**

Run: `git diff --check`

Run: `git status --short --branch`

Commit only source, tests, spec, plan, and concise report. Keep raw traces/screenshots ignored.

