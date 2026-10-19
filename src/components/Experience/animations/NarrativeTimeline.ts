import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import type { ExperienceScene } from "../webgl/ExperienceScene";
import { createEditorialTransformation } from "./EditorialTransformation";
import { createUmbrellaChapter } from "./UmbrellaChapter";
import { createWaterTextReveal } from "./WaterTextReveal";

gsap.registerPlugin(ScrollTrigger);

const WATER_REVEAL_START = 0.72;
const WATER_REVEAL_DURATION = 0.4;
const EDITORIAL_HIGHLIGHT_START = 1.12;
const EDITORIAL_HIGHLIGHT_DURATION = 0.28;
const EDITORIAL_TRANSFORM_START = 1.32;
const EDITORIAL_TRANSFORM_DURATION = 0.6;
const EDITORIAL_LIGHTNING_START = 1.92;
const EDITORIAL_LIGHTNING_DURATION = 0.3;
const UMBRELLA_TRANSITION_START = 2.5;
const UMBRELLA_CROSSFADE_DURATION = 0.3;
const UMBRELLA_FINISH_DURATION = 0.32;
const WHEEL_INPUT_SCALE = 0.58;
const SCROLL_RESPONSE_MS = 115;
const MAX_SCROLL_STEP_VIEWPORTS = 0.62;
const MAX_SCROLL_LEAD_VIEWPORTS = 0.82;
const MAX_LOCKED_DELTA_VIEWPORTS = 0.3;

const getNarrativeScrollDistance = () => {
  if (matchMedia("(max-width: 720px)").matches) return 6.4;
  if (matchMedia("(pointer: coarse)").matches) return 7.4;
  return 8.8;
};

interface NarrativeElements {
  root: HTMLElement;
  copy: HTMLElement;
  transitionFlash: HTMLElement;
  eyebrow: HTMLElement;
  titleFirst: HTMLElement;
  titleSecond: HTMLElement;
  chapter: HTMLElement;
  chapterCopy: HTMLElement;
  chapterEyebrow: HTMLElement;
  chapterLines: HTMLElement[];
  chapterBody: HTMLElement;
  chapterBodyLines: HTMLElement[];
  chapterChild: HTMLElement;
}

export interface NarrativeController {
  destroy: () => void;
}

interface ScrollBounds {
  start: number;
  end: number;
}

interface ScrollGovernorController {
  destroy: () => void;
  releaseLockedInput: () => void;
}

const createScrollGovernor = (
  getBounds: () => ScrollBounds | undefined,
  getLockedY: () => number | undefined,
  onLockedInput: (event: Event) => void,
) => {
  const scrollState = { y: scrollY };
  let targetY = scrollY;
  let scrolling = false;
  let pendingLockedDelta = 0;

  const stopScrolling = () => {
    if (!scrolling) return;
    scrolling = false;
    gsap.ticker.remove(updateScroll);
  };

  function updateScroll(_time: number, deltaTime: number) {
    const lockedY = getLockedY();
    if (lockedY !== undefined) {
      targetY = lockedY;
      scrollState.y = lockedY;
      scrollTo(0, lockedY);
      stopScrolling();
      return;
    }

    const difference = targetY - scrollState.y;
    if (Math.abs(difference) <= 0.5) {
      scrollState.y = targetY;
      scrollTo(0, targetY);
      stopScrolling();
      return;
    }

    const frameTime = Math.min(34, Math.max(0, deltaTime || 16.67));
    const blend = 1 - Math.exp(-frameTime / SCROLL_RESPONSE_MS);
    scrollState.y += difference * blend;
    scrollTo(0, scrollState.y);
  }

  const startScrolling = () => {
    if (scrolling) return;
    scrolling = true;
    gsap.ticker.add(updateScroll);
  };

  const queueScroll = (delta: number, event?: Event) => {
    const lockedY = getLockedY();
    if (lockedY !== undefined) {
      if (event) onLockedInput(event);
      const maxQueuedDelta = innerHeight * MAX_LOCKED_DELTA_VIEWPORTS;
      pendingLockedDelta = Math.max(
        -maxQueuedDelta,
        Math.min(maxQueuedDelta, pendingLockedDelta + delta),
      );
      targetY = lockedY;
      scrollState.y = lockedY;
      scrollTo(0, lockedY);
      stopScrolling();
      return true;
    }

    const bounds = getBounds();
    if (!bounds || bounds.end <= bounds.start) return false;

    const currentY = scrollY;
    const movingForward = delta > 0;
    if (
      (movingForward && currentY >= bounds.end - 1) ||
      (!movingForward && currentY <= bounds.start + 1) ||
      currentY < bounds.start - 1 ||
      currentY > bounds.end + 1
    ) {
      return false;
    }

    const viewport = innerHeight;
    const maxStep = viewport * MAX_SCROLL_STEP_VIEWPORTS;
    const maxLead = viewport * MAX_SCROLL_LEAD_VIEWPORTS;
    const scaledDelta = Math.sign(delta) * Math.min(Math.abs(delta), maxStep);
    const queuedFrom = scrolling ? targetY : currentY;
    targetY = Math.min(
      bounds.end,
      Math.max(
        bounds.start,
        Math.min(currentY + maxLead, Math.max(currentY - maxLead, queuedFrom + scaledDelta)),
      ),
    );

    if (!scrolling) scrollState.y = currentY;
    startScrolling();
    return true;
  };

  const handleWheel = (event: WheelEvent) => {
    if (event.ctrlKey || Math.abs(event.deltaX) > Math.abs(event.deltaY)) return;
    const modeMultiplier =
      event.deltaMode === WheelEvent.DOM_DELTA_LINE
        ? 18
        : event.deltaMode === WheelEvent.DOM_DELTA_PAGE
          ? innerHeight
          : 1;
    if (queueScroll(event.deltaY * modeMultiplier * WHEEL_INPUT_SCALE, event)) {
      event.preventDefault();
    }
  };

  const handleKeydown = (event: KeyboardEvent) => {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    if (
      event.target instanceof HTMLInputElement ||
      event.target instanceof HTMLTextAreaElement ||
      event.target instanceof HTMLSelectElement ||
      (event.target instanceof HTMLElement && event.target.isContentEditable)
    ) {
      return;
    }

    const direction = event.shiftKey ? -1 : 1;
    const distances: Partial<Record<string, number>> = {
      ArrowDown: innerHeight * 0.14,
      ArrowUp: -innerHeight * 0.14,
      PageDown: innerHeight * 0.52,
      PageUp: -innerHeight * 0.52,
      " ": innerHeight * 0.52 * direction,
      End: innerHeight * 0.52,
      Home: -innerHeight * 0.52,
    };
    const delta = distances[event.key];
    if (delta !== undefined && queueScroll(delta, event)) event.preventDefault();
  };

  const handleTouchMove = (event: TouchEvent) => {
    const lockedY = getLockedY();
    if (lockedY === undefined) return;
    onLockedInput(event);
    event.preventDefault();
    event.stopImmediatePropagation();
    scrollTo(0, lockedY);
  };

  const handleTouchBoundary = (event: TouchEvent) => {
    onLockedInput(event);
  };

  const handleScroll = () => {
    const lockedY = getLockedY();
    if (lockedY !== undefined && Math.abs(scrollY - lockedY) > 0.5) {
      scrollTo(0, lockedY);
    }
  };

  addEventListener("wheel", handleWheel, { passive: false });
  addEventListener("keydown", handleKeydown);
  addEventListener("touchmove", handleTouchMove, { passive: false });
  addEventListener("touchstart", handleTouchBoundary, { passive: true });
  addEventListener("touchend", handleTouchBoundary, { passive: true });
  addEventListener("touchcancel", handleTouchBoundary, { passive: true });
  addEventListener("scroll", handleScroll, { passive: true });

  return {
    destroy: () => {
      stopScrolling();
      removeEventListener("wheel", handleWheel);
      removeEventListener("keydown", handleKeydown);
      removeEventListener("touchmove", handleTouchMove);
      removeEventListener("touchstart", handleTouchBoundary);
      removeEventListener("touchend", handleTouchBoundary);
      removeEventListener("touchcancel", handleTouchBoundary);
      removeEventListener("scroll", handleScroll);
    },
    releaseLockedInput: () => {
      const delta = pendingLockedDelta;
      pendingLockedDelta = 0;
      if (Math.abs(delta) <= 0.5) return;
      requestAnimationFrame(() => {
        if (getLockedY() === undefined) queueScroll(delta);
      });
    },
  };
};

export const createNarrativeTimeline = (
  elements: NarrativeElements,
  scene: ExperienceScene,
): NarrativeController => {
  const {
    root,
    copy,
    transitionFlash,
    eyebrow,
    titleFirst,
    titleSecond,
    chapter,
    chapterCopy,
    chapterEyebrow,
    chapterLines,
    chapterBody,
    chapterBodyLines,
    chapterChild,
  } = elements;
  const introState = { light: 0, environment: 0, child: 0 };
  const narrative = { progress: 0, lightning: 0.12 };
  const editorialState = { progress: 0 };
  const editorialHighlightState = { progress: 0 };
  const editorialLightningState = { progress: 0 };
  const umbrellaEntranceState = { progress: 0 };
  const umbrellaState = { progress: 0 };
  const umbrellaTextIntroState = { progress: 0 };
  const textRevealState = { progress: 0 };
  const rainState = { visibility: 1 };
  let scrollTimeline: gsap.core.Timeline | undefined;
  let scrollNormalizer: { kill: () => void } | undefined;
  let scrollGovernor: ScrollGovernorController | undefined;
  let refreshFrame: number | undefined;
  let progressBeforeRefresh: number | undefined;
  let scenePausedForEditorial = false;
  let chapterState: "held" | "overlay" | "released" | undefined;
  const waterReveal = createWaterTextReveal({
    container: chapter,
    eyebrow: chapterEyebrow,
    headingLines: chapterLines,
    bodyLines: chapterBodyLines,
  });
  const editorialTransformation = createEditorialTransformation({
    chapter,
    copy: chapterCopy,
    currentImage: chapterChild,
  });
  const umbrellaChapter = chapter.querySelector<HTMLElement>(
    "[data-umbrella-chapter]",
  );
  const umbrellaTransformation = umbrellaChapter
    ? createUmbrellaChapter(umbrellaChapter)
    : {
        setEntranceProgress: () => undefined,
        setProgress: () => undefined,
        setTextIntroProgress: () => undefined,
        destroy: () => undefined,
      };
  const editorialFinalElements = [
    ...chapter.querySelectorAll<HTMLElement>(
      "[data-editorial-final-image], [data-editorial-hidden-message]",
    ),
  ];
  const transitionBoltPaths = [
    ...transitionFlash.querySelectorAll<SVGPathElement>("path"),
  ];

  const renderIntro = () => {
    scene.setEnvironmentVisibility(introState.environment);
    scene.setChildVisibility(introState.child);
    scene.setLightning(introState.light);
  };

  const captureProgressBeforeRefresh = () => {
    const trigger = scrollTimeline?.scrollTrigger;
    if (trigger && trigger.progress > 0) {
      progressBeforeRefresh = trigger.progress;
    }
  };

  const syncChapterState = (progress: number, released = false) => {
    const nextState = released
      ? "released"
      : progress >= 0.39
        ? "overlay"
        : "held";
    if (chapterState === nextState) return;
    chapterState = nextState;
    chapter.classList.remove(
      "experience-chapter--held",
      "experience-chapter--overlay",
      "experience-chapter--released",
    );
    if (nextState === "released") {
      chapter.classList.add("experience-chapter--released");
    } else if (nextState === "overlay") {
      chapter.classList.add("experience-chapter--overlay");
    } else {
      chapter.classList.add("experience-chapter--held");
    }
  };

  const createScroll = () => {
    const mobileScroll = matchMedia(
      "(max-width: 800px), (pointer: coarse)",
    ).matches;
    syncChapterState(0);
    scrollTimeline = gsap.timeline({
      scrollTrigger: {
        trigger: root,
        start: "top top",
        end: () => `+=${innerHeight * getNarrativeScrollDistance()}`,
        pin: true,
        pinSpacing: true,
        scrub: true,
        anticipatePin: 1,
        invalidateOnRefresh: true,
        onLeave: () => {
          syncChapterState(1, true);
          if (!scenePausedForEditorial) {
            scene.pause();
            scenePausedForEditorial = true;
          }
        },
        onEnterBack: (trigger) =>
          syncChapterState(Math.min(1, trigger.progress * 2)),
        onLeaveBack: () => syncChapterState(0),
        onRefresh: (trigger) => {
          const preservedProgress = progressBeforeRefresh;
          if (preservedProgress !== undefined) {
            progressBeforeRefresh = undefined;
            const nextScroll =
              trigger.start + (trigger.end - trigger.start) * preservedProgress;
            trigger.scroll(nextScroll);
            scrollTimeline?.progress(preservedProgress);
          }
          syncChapterState(
            Math.min(1, (preservedProgress ?? trigger.progress) * 2),
            (preservedProgress ?? trigger.progress) >= 1,
          );
        },
      },
    });

    scrollTimeline
      .to(
        narrative,
        {
          progress: 1,
          duration: 1,
          ease: "none",
          onUpdate: () => {
            scene.setProgress(narrative.progress);
            syncChapterState(narrative.progress);
          },
        },
        0,
      )
      .to(copy, { opacity: 0, y: -26, duration: 0.18, ease: "power2.out" }, 0.02)
      .to(
        narrative,
        {
          lightning: 1,
          duration: 0.008,
          ease: "power1.in",
          onUpdate: () => scene.setLightning(narrative.lightning),
        },
        0.305,
      )
      .to(
        narrative,
        {
          lightning: 0.2,
          duration: 0.018,
          ease: "power2.out",
          onUpdate: () => scene.setLightning(narrative.lightning),
        },
        0.313,
      )
      .to(
        narrative,
        {
          lightning: 0.78,
          duration: 0.008,
          ease: "power1.in",
          onUpdate: () => scene.setLightning(narrative.lightning),
        },
        0.331,
      )
      .to(
        narrative,
        {
          lightning: 0.12,
          duration: 0.032,
          ease: "power3.out",
          onUpdate: () => scene.setLightning(narrative.lightning),
        },
        0.339,
      )
      .to(
        narrative,
        {
          lightning: 1,
          duration: 0.006,
          ease: "power1.in",
          onUpdate: () => scene.setLightning(narrative.lightning),
        },
        0.399,
      )
      .to(
        narrative,
        {
          lightning: 0.24,
          duration: 0.014,
          ease: "power2.out",
          onUpdate: () => scene.setLightning(narrative.lightning),
        },
        0.405,
      )
      .to(
        narrative,
        {
          lightning: 0.72,
          duration: 0.006,
          ease: "power1.in",
          onUpdate: () => scene.setLightning(narrative.lightning),
        },
        0.419,
      )
      .to(
        narrative,
        {
          lightning: 0.12,
          duration: 0.028,
          ease: "power3.out",
          onUpdate: () => scene.setLightning(narrative.lightning),
        },
        0.425,
      )
      .to(
        transitionFlash,
        {
          opacity: 0.86,
          duration: 0.016,
          ease: "power2.in",
        },
        0.393,
      )
      .to(
        transitionBoltPaths,
        {
          strokeDashoffset: 0,
          duration: 0.042,
          stagger: 0.006,
          ease: "none",
        },
        0.393,
      )
      .to(
        transitionFlash,
        {
          opacity: 0.08,
          duration: 0.022,
          ease: "power3.out",
        },
        0.405,
      )
      .to(
        transitionFlash,
        {
          opacity: 0.72,
          duration: 0.009,
          ease: "power1.in",
        },
        0.427,
      )
      .to(
        transitionFlash,
        {
          opacity: 0,
          duration: 0.034,
          ease: "power3.out",
        },
        0.436,
      )
      .to(
        narrative,
        {
          lightning: 0.42,
          duration: 0.01,
          onUpdate: () => scene.setLightning(narrative.lightning),
        },
        0.925,
      )
      .to(
        narrative,
        {
          lightning: 0.12,
          duration: 0.045,
          ease: "power2.out",
          onUpdate: () => scene.setLightning(narrative.lightning),
        },
        0.935,
      )
      .to(
        chapter,
        {
          "--chapter-warmth": 1,
          duration: 0.3,
          ease: "power2.inOut",
        },
        0.39,
      )
      .set(
        chapterChild,
        {
          opacity: 1,
        },
        0.405,
      )
      .to(
        chapterChild,
        {
          clipPath: "inset(0% 0% 0% 0%)",
          x: 0,
          scale: 1,
          duration: 0.315,
          ease: "power3.inOut",
        },
        0.405,
      )
      .to(
        textRevealState,
        {
          progress: 1,
          duration: WATER_REVEAL_DURATION,
          ease: "none",
          onUpdate: () => waterReveal.setProgress(textRevealState.progress),
        },
        WATER_REVEAL_START,
      )
      .to(
        rainState,
        {
          visibility: 0,
          duration: 0.18,
          ease: "power2.inOut",
          onUpdate: () => scene.setRainVisibility(rainState.visibility),
        },
        WATER_REVEAL_START + WATER_REVEAL_DURATION * 0.55,
      )
      .to(
        editorialHighlightState,
        {
          progress: 1,
          duration: EDITORIAL_HIGHLIGHT_DURATION,
          ease: "power2.inOut",
          onUpdate: () =>
            editorialTransformation.setHighlightProgress(
              editorialHighlightState.progress,
            ),
        },
        EDITORIAL_HIGHLIGHT_START,
      )
      .to(
        editorialState,
        {
          progress: 1,
          duration: EDITORIAL_TRANSFORM_DURATION,
          ease: "none",
          onUpdate: () => {
            editorialTransformation.setProgress(editorialState.progress, false);
            if (editorialState.progress > 0.01 && !scenePausedForEditorial) {
              scene.pause();
              scenePausedForEditorial = true;
            } else if (
              editorialState.progress <= 0.01 &&
              scenePausedForEditorial
            ) {
              scene.start();
              scenePausedForEditorial = false;
            }
          },
        },
        EDITORIAL_TRANSFORM_START,
      )
      .to(
        editorialLightningState,
        {
          progress: 1,
          duration: EDITORIAL_LIGHTNING_DURATION,
          ease: "none",
          onUpdate: () =>
            editorialTransformation.setLightningSequenceProgress(
              editorialLightningState.progress,
            ),
        },
        EDITORIAL_LIGHTNING_START,
      );

    if (umbrellaChapter) {
      scrollTimeline
        .to(
          editorialFinalElements,
          {
            opacity: 0,
            duration: UMBRELLA_CROSSFADE_DURATION,
            ease: "power2.inOut",
          },
          UMBRELLA_TRANSITION_START,
        )
        .to(
          umbrellaEntranceState,
          {
            progress: 1,
            duration: UMBRELLA_CROSSFADE_DURATION,
            ease: "power2.inOut",
            onUpdate: () =>
              umbrellaTransformation.setEntranceProgress(
                umbrellaEntranceState.progress,
              ),
          },
          UMBRELLA_TRANSITION_START,
        )
        .to(
          umbrellaTextIntroState,
          {
            progress: 1,
            duration: UMBRELLA_CROSSFADE_DURATION,
            ease: "none",
            onUpdate: () =>
              umbrellaTransformation.setTextIntroProgress(
                umbrellaTextIntroState.progress,
              ),
          },
          UMBRELLA_TRANSITION_START,
        )
        .to(
          umbrellaState,
          {
            progress: 1,
            duration: UMBRELLA_FINISH_DURATION,
            ease: "none",
            onUpdate: () =>
              umbrellaTransformation.setProgress(umbrellaState.progress),
          },
          UMBRELLA_TRANSITION_START + UMBRELLA_CROSSFADE_DURATION,
        );
    }

    const getBounds = () => {
      const trigger = scrollTimeline?.scrollTrigger;
      return trigger ? { start: trigger.start, end: trigger.end } : undefined;
    };
    if (!mobileScroll) {
      scrollGovernor = createScrollGovernor(
        getBounds,
        () => undefined,
        () => undefined,
      );
      scrollNormalizer = ScrollTrigger.normalizeScroll({
        type: "touch",
        allowNestedScroll: true,
        lockAxis: true,
        momentum: (observer) =>
          Math.min(0.55, Math.max(0.18, Math.abs(observer.velocityY) / 3200)),
      });
    }

    refreshFrame = requestAnimationFrame(() => {
      refreshFrame = undefined;
      ScrollTrigger.refresh();
    });
  };

  gsap.set([eyebrow, titleFirst, titleSecond], { opacity: 0, y: 12 });
  gsap.set(transitionFlash, { opacity: 0 });
  gsap.set(transitionBoltPaths, {
    strokeDasharray: 1,
    strokeDashoffset: 1,
  });
  gsap.set(chapterChild, {
    opacity: 0,
    clipPath: "inset(0% 0% 0% 0%)",
    x: "28vw",
    scale: 1.08,
  });
  renderIntro();
  createScroll();
  ScrollTrigger.addEventListener("refreshInit", captureProgressBeforeRefresh);

  const intro = gsap.timeline({
    defaults: { ease: "power2.inOut" },
  });

  intro
    .set(introState, { environment: 1 }, 1)
    .to(
      introState,
      { light: 1, duration: 0.055, onUpdate: renderIntro },
      1,
    )
    .to(introState, {
      light: 0,
      duration: 0.28,
      ease: "power3.out",
      onUpdate: renderIntro,
    })
    .set(introState, { environment: 0.16, onUpdate: renderIntro })
    .set(introState, { environment: 1, child: 1, onUpdate: renderIntro }, 2.45)
    .to(
      introState,
      { light: 1, duration: 0.06, onUpdate: renderIntro },
      2.45,
    )
    .to(introState, {
      light: 0.12,
      duration: 0.92,
      ease: "power3.out",
      onUpdate: renderIntro,
    })
    .to(eyebrow, { opacity: 1, y: 0, duration: 0.55 }, 3.18)
    .to(titleFirst, { opacity: 1, y: 0, duration: 0.72 }, 3.6)
    .to(titleSecond, { opacity: 1, y: 0, duration: 0.72 }, 4.35);

  return {
    destroy: () => {
      intro.kill();
      if (scenePausedForEditorial) {
        scene.start();
        scenePausedForEditorial = false;
      }
      scrollNormalizer?.kill();
      scrollGovernor?.destroy();
      if (refreshFrame !== undefined) cancelAnimationFrame(refreshFrame);
      ScrollTrigger.removeEventListener(
        "refreshInit",
        captureProgressBeforeRefresh,
      );
      scrollTimeline?.scrollTrigger?.kill();
      scrollTimeline?.kill();
      chapter.classList.remove("experience-chapter--held");
      chapter.classList.remove("experience-chapter--overlay");
      chapter.classList.remove("experience-chapter--released");
      chapter.style.removeProperty("--chapter-cover");
      waterReveal.destroy();
      editorialTransformation.destroy();
      umbrellaTransformation.destroy();
      gsap.killTweensOf([
        introState,
        narrative,
        editorialState,
        editorialHighlightState,
        editorialLightningState,
        umbrellaEntranceState,
        umbrellaState,
        umbrellaTextIntroState,
        textRevealState,
        rainState,
        copy,
        transitionFlash,
        transitionBoltPaths,
        eyebrow,
        titleFirst,
        titleSecond,
        chapter,
        chapterEyebrow,
        chapterLines,
        chapterBody,
        chapterChild,
        editorialFinalElements,
      ]);
    },
  };
};
