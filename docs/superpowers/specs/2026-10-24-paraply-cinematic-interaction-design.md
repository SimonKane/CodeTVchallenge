# Paraply Cinematic Interaction Design

## Goal

Turn the existing Paraply narrative into a cohesive, tactile cinematic experience without changing its subject, copy, image direction, or ethical tone. The page must feel deliberate under wheel, trackpad, keyboard, and touch; the rain must remain alive across transitions; and the umbrella itself—not a detached CTA—must be the memorable interaction.

## Creative direction

Paraply is not a portfolio or product demo. Its motion language must communicate exposure, recognition, intervention, and shelter. Cold rain and unstable light carry the opening. The editorial middle becomes quieter but never visually dead. The umbrella opening is the single release: motion converges, rain bends around the canopy, the palette warms slightly, and the copy becomes calm and readable.

The existing deep blue-black, wet asphalt, restrained red, warm lamp light, serif display type, and documentary child imagery remain. No generic gradient decoration, glass cards, floating UI chrome, novelty cursor, or unrelated effects are introduced.

## Interaction model

### Scroll

- Browser scrolling stays native: no prevented wheel/touch events and no synthetic `scrollTo()` governor.
- Raw scroll position is the source of truth, but visual progress follows it with a short time-based response rather than `scrub: true`.
- The response is slower for large wheel/trackpad impulses and faster for reversal so the page feels cinematic without becoming unresponsive.
- Scroll velocity and direction become shared signals for camera drift, rain slant, light response, and restrained typographic tension.
- Document height stays invariant within one pixel across every chapter state and viewport refresh.

### Pointer and touch

- One normalized pointer state is shared by WebGL and the umbrella rain system.
- Passive movement creates subtle parallax and local rain deflection.
- Press-and-drag creates a stronger temporary flow field in the rain; release decays smoothly.
- Touch receives equivalent behavior without blocking page scrolling: horizontal/diagonal intentional drags affect rain, while vertical gestures retain native scroll.

### Umbrella

- The visible closed umbrella is the interaction target. No visible pill/button is rendered.
- A transparent semantic button follows the umbrella silhouette, carries the accessible name, focus state, `aria-expanded`, and Enter/Space behavior.
- Hover/focus produces a restrained rim-light and small physical response on the umbrella itself.
- Click/tap/keyboard opens the authored umbrella sequence. The canopy expands from its center, catches the rain, produces edge splashes/runoff, shelters the child, and reveals the safe-place copy.
- Scroll can continue before or after activation. If the visitor never activates it, scroll progression completes the sequence without trapping them.
- Reduced motion reveals the safe state immediately after activation.

## Spatial treatment

- The existing Three.js street remains the spatial foundation.
- Camera position uses a damped visual progress signal and a small velocity-dependent forward/roll impulse; it never shakes or overshoots chapter bounds.
- Existing depth map, fog, road reflection, lightning, and child planes are retained and tuned as one scene rather than supplemented with unrelated 3D objects.
- The umbrella uses authored imagery for identity, enhanced with perspective tilt, pointer parallax, layered child depth, canopy shading, and rain collision. A fake freely rotatable 3D object is not introduced without a matching authored model.
- DOM remains responsible for readable copy and accessibility; WebGL/canvas is responsible for atmosphere, depth, and input-reactive motion.

## Rain continuity

- WebGL rain does not fade to zero before a successor layer is visible.
- A low-intensity atmospheric rain layer bridges the editorial chapter and crossfades into the canopy-collision rain.
- Only one heavy rain renderer is active at a time. Crossfade overlap is short and explicitly bounded.
- Umbrella rain batches strokes by visual style and quality tier. Pointer forces alter velocity, not DOM layout.
- When the experience is outside the viewport or fully covered, active render loops stop.

## Chapter composition

1. **Exposure:** wide street, distant child, restrained copy; pointer adds minimal depth.
2. **Recognition:** camera closes in and child turns; scroll velocity subtly increases rain angle and lens response.
3. **Voice through water:** text begins before the previous image fully resolves; no empty black interval.
4. **What is hidden:** editorial typography remains dominant, with low rain and a stable child silhouette supporting it.
5. **Silence:** red word and gesture appear with controlled negative space; rain remains present at low intensity.
6. **Intervention:** closed umbrella becomes visibly interactive; the object itself receives focus/hover feedback.
7. **Shelter:** opening redirects rain, reveals the child and warms the scene; safe-place copy enters only after the canopy has settled.

## Responsive behavior

- Desktop preserves asymmetric editorial framing and broad cinematic depth.
- Tablet retains the same staging with reduced camera amplitude and larger copy measure.
- Mobile uses fewer rain particles, DPR 1, reduced postprocessing, shorter camera travel, and a vertically stacked safe composition with body copy at least `0.95rem` except short landscape layouts.
- Important facial, hand, canopy, and headline regions remain inside the viewport at all captured checkpoints.

## Accessibility and fallback

- The invisible umbrella control is a real button with a visible silhouette-aligned focus treatment.
- The control name describes the action; the live region describes completion.
- Keyboard activation works with Enter and Space.
- Reduced motion and no-WebGL retain the same click/tap/keyboard interaction and complete content.
- Decorative imagery remains hidden from assistive technology; copy order and headings remain semantic.

## Performance contract

- No new runtime dependency is required.
- Desktop/tablet target p95 frame time no worse than the current branch on matched hardware.
- Mobile must not regress frames at or above 50 ms or total long-task time against the current branch median.
- At most one main atmospheric renderer plus the short bounded rain crossfade runs at once.
- Canvas rain must avoid one stroke call per passive raindrop.
- Rendering pauses on document visibility changes and when covered/offscreen.

## Acceptance criteria

- A 480 px wheel event is not intercepted, but visual timeline progress settles rather than snapping in the same frame.
- Fast and reverse scroll remain controllable and never skip into an empty composition.
- Max-scroll variation is at most one pixel at a fixed viewport.
- No visible standalone “Open the umbrella” button exists.
- Clicking/tapping the visible closed umbrella and pressing Enter/Space while it is focused opens it.
- Pointer/drag visibly affects rain on desktop and touch interaction works without breaking vertical scrolling.
- Rain remains visually continuous across the WebGL/editorial/umbrella handoffs.
- Every chapter boundary and intermediate interaction checkpoint is visually inspected at desktop, tablet, and mobile sizes.
- Build, unit audit, full Playwright matrix, reduced-motion, and no-WebGL tests pass after the final code change.
- Performance claims identify the renderer and never label SwiftShader as physical GPU.

