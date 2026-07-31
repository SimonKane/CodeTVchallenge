import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import type { ExperienceScene } from "../webgl/ExperienceScene";
import { createEditorialTransformation } from "./EditorialTransformation";
import { createUmbrellaChapter } from "./UmbrellaChapter";
import { createWaterTextReveal } from "./WaterTextReveal";

gsap.registerPlugin(ScrollTrigger);

const REVEAL_TRIGGER_TIME = 0.72;
const BASE_TIMELINE_DURATION = 4.32;
const POST_REVEAL_SLOWDOWN = 1.15;

const slowPostRevealTime = (time: number) =>
  REVEAL_TRIGGER_TIME +
  (time - REVEAL_TRIGGER_TIME) * POST_REVEAL_SLOWDOWN;

const slowPostRevealDuration = (duration: number) =>
  duration * POST_REVEAL_SLOWDOWN;

const getNarrativeScrollDistance = () => {
  if (matchMedia("(max-width: 720px)").matches) return 5.6;
  if (matchMedia("(pointer: coarse)").matches) return 8.8;
  return 10.8;
};

const getScrollDistance = (baseDistance: number) => {
  const revealDistance =
    baseDistance * (REVEAL_TRIGGER_TIME / BASE_TIMELINE_DURATION);
  return (
    revealDistance +
    (baseDistance - revealDistance) * POST_REVEAL_SLOWDOWN
  );
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

const createScrollGovernor = (
  getBounds: () => ScrollBounds | undefined,
  getLockedY: () => number | undefined,
) => {
  const scrollState = { y: scrollY };
  let targetY = scrollY;
  let scrollTween: gsap.core.Tween | undefined;

  const queueScroll = (delta: number) => {
    const lockedY = getLockedY();
    if (lockedY !== undefined) {
      scrollTween?.kill();
      targetY = lockedY;
      scrollTo(0, lockedY);
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
    const maxStep = viewport * 1.15;
    const maxLead = viewport * 1.45;
    const scaledDelta = Math.sign(delta) * Math.min(Math.abs(delta), maxStep);
    const queuedFrom = scrollTween?.isActive() ? targetY : currentY;
    targetY = Math.min(
      bounds.end,
      Math.max(
        bounds.start,
        Math.min(currentY + maxLead, Math.max(currentY - maxLead, queuedFrom + scaledDelta)),
      ),
    );

    scrollTween?.kill();
    scrollState.y = currentY;
    const distance = Math.abs(targetY - currentY);
    scrollTween = gsap.to(scrollState, {
      y: targetY,
      duration: 0.18 + (distance / viewport) * 0.18,
      ease: "power2.out",
      overwrite: true,
      onUpdate: () => {
        const lockedY = getLockedY();
        if (lockedY !== undefined) {
          scrollTween?.kill();
          targetY = lockedY;
          scrollState.y = lockedY;
        }
        scrollTo(0, scrollState.y);
      },
    });
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
    if (queueScroll(event.deltaY * modeMultiplier)) event.preventDefault();
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
    if (delta !== undefined && queueScroll(delta)) event.preventDefault();
  };

  const handleTouchMove = (event: TouchEvent) => {
    const lockedY = getLockedY();
    if (lockedY === undefined) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    scrollTo(0, lockedY);
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
  addEventListener("scroll", handleScroll, { passive: true });

  return () => {
    scrollTween?.kill();
    removeEventListener("wheel", handleWheel);
    removeEventListener("keydown", handleKeydown);
    removeEventListener("touchmove", handleTouchMove);
    removeEventListener("scroll", handleScroll);
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
  const umbrellaState = { progress: 0 };
  const textRevealState = { progress: 0 };
  const rainState = { visibility: 1 };
  let scrollTimeline: gsap.core.Timeline | undefined;
  let textRevealTimeline: gsap.core.Timeline | undefined;
  let scrollNormalizer: { kill: () => void } | undefined;
  let destroyScrollGovernor: (() => void) | undefined;
  let textRevealStarted = false;
  let textRevealComplete = false;
  let sequenceLockY: number | undefined;
  let refreshFrame: number | undefined;
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
    : { setProgress: () => undefined, destroy: () => undefined };
  const editorialFinalElements = [
    ...chapter.querySelectorAll<HTMLElement>(
      "[data-editorial-final-image], [data-editorial-hidden-message]",
    ),
  ];
  const transitionBoltPaths = [
    ...transitionFlash.querySelectorAll<SVGPathElement>("path"),
  ];

  const unlockSequence = () => {
    sequenceLockY = undefined;
    delete chapter.dataset.sequenceLocked;
  };

  const resetTextReveal = () => {
    textRevealTimeline?.kill();
    textRevealTimeline = undefined;
    textRevealStarted = false;
    textRevealComplete = false;
    textRevealState.progress = 0;
    rainState.visibility = 1;
    waterReveal.setProgress(0);
    scene.setRainVisibility(1);
    unlockSequence();
  };

  const playTextReveal = (lockY = scrollY) => {
    if (textRevealStarted) return;
    textRevealStarted = true;
    sequenceLockY = lockY;
    chapter.dataset.sequenceLocked = "true";
    scrollTo(0, lockY);
    textRevealTimeline = gsap
      .timeline({
        onComplete: () => {
          textRevealComplete = true;
          unlockSequence();
        },
      })
      .to(textRevealState, {
        progress: 1,
        duration: 2.4,
        ease: "none",
        onUpdate: () => waterReveal.setProgress(textRevealState.progress),
      })
      .to(
        rainState,
        {
          visibility: 0,
          duration: 0.5,
          ease: "power2.inOut",
          onUpdate: () => scene.setRainVisibility(rainState.visibility),
        },
        2,
      );
  };

  const renderIntro = () => {
    scene.setEnvironmentVisibility(introState.environment);
    scene.setChildVisibility(introState.child);
    scene.setLightning(introState.light);
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
    syncChapterState(0);
    scrollTimeline = gsap.timeline({
      scrollTrigger: {
        trigger: root,
        start: "top top",
        end: () =>
          `+=${innerHeight * getScrollDistance(getNarrativeScrollDistance())}`,
        pin: true,
        pinSpacing: true,
        scrub: matchMedia("(pointer: coarse)").matches ? 0.95 : 0.78,
        anticipatePin: 1,
        invalidateOnRefresh: true,
        onUpdate: (trigger) => {
          const duration = scrollTimeline?.duration() ?? 0;
          if (!duration) return;
          const revealThreshold = REVEAL_TRIGGER_TIME / duration;
          if (trigger.progress >= revealThreshold && !textRevealStarted) {
            const lockY =
              trigger.start + (trigger.end - trigger.start) * revealThreshold;
            playTextReveal(lockY);
          } else if (
            trigger.progress < revealThreshold - 0.008 &&
            textRevealComplete
          ) {
            resetTextReveal();
          }
        },
        onLeave: () => syncChapterState(1, true),
        onEnterBack: (trigger) =>
          syncChapterState(Math.min(1, trigger.progress * 2)),
        onLeaveBack: () => syncChapterState(0),
        onRefresh: (trigger) =>
          syncChapterState(
            Math.min(1, trigger.progress * 2),
            trigger.progress >= 1,
          ),
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
        editorialState,
        {
          progress: 1,
          duration: slowPostRevealDuration(1.34),
          ease: "none",
          onUpdate: () => {
            if (textRevealComplete) {
              editorialTransformation.setProgress(editorialState.progress);
            }
          },
        },
        slowPostRevealTime(1),
      );

    if (umbrellaChapter) {
      scrollTimeline
        .to(
          editorialFinalElements,
          {
            opacity: 0,
            duration: slowPostRevealDuration(0.26),
            ease: "power2.inOut",
          },
          slowPostRevealTime(2.34),
        )
        .to(
          umbrellaState,
          {
            progress: 1,
            duration: slowPostRevealDuration(1.94),
            ease: "none",
            onUpdate: () =>
              umbrellaTransformation.setProgress(umbrellaState.progress),
          },
          slowPostRevealTime(2.38),
        );
    }

    destroyScrollGovernor = createScrollGovernor(
      () => {
        const trigger = scrollTimeline?.scrollTrigger;
        return trigger ? { start: trigger.start, end: trigger.end } : undefined;
      },
      () => sequenceLockY,
    );

    scrollNormalizer = ScrollTrigger.normalizeScroll({
      type: "touch",
      allowNestedScroll: true,
      lockAxis: true,
      momentum: (observer) =>
        Math.min(0.55, Math.max(0.18, Math.abs(observer.velocityY) / 3200)),
    });

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
    .set(introState, { environment: 0, onUpdate: renderIntro })
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
      textRevealTimeline?.kill();
      unlockSequence();
      scrollNormalizer?.kill();
      destroyScrollGovernor?.();
      if (refreshFrame !== undefined) cancelAnimationFrame(refreshFrame);
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
        umbrellaState,
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
