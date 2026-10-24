import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import type { ExperienceScene } from "../webgl/ExperienceScene";
import { createEditorialTransformation } from "./EditorialTransformation";
import { createUmbrellaChapter } from "./UmbrellaChapter";
import { createWaterTextReveal } from "./WaterTextReveal";
import type { InteractionField } from "../motion/InteractionField";

gsap.registerPlugin(ScrollTrigger);

const WATER_REVEAL_START = 0.54;
const WATER_REVEAL_DURATION = 0.48;
const EDITORIAL_HIGHLIGHT_START = 1.12;
const EDITORIAL_HIGHLIGHT_DURATION = 0.28;
const EDITORIAL_TRANSFORM_START = 1.32;
const EDITORIAL_TRANSFORM_DURATION = 0.6;
const EDITORIAL_LIGHTNING_START = 1.92;
const EDITORIAL_LIGHTNING_DURATION = 0.3;
const UMBRELLA_TRANSITION_START = 2.5;
const UMBRELLA_CROSSFADE_DURATION = 0.65;
const UMBRELLA_TEXT_INTRO_DELAY = 0.45;
const UMBRELLA_TEXT_INTRO_DURATION = 0.55;
const UMBRELLA_FINISH_DURATION = 0.32;

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
  refresh: () => void;
  destroy: () => void;
}

export const createNarrativeTimeline = (
  elements: NarrativeElements,
  scene: ExperienceScene,
  interaction: InteractionField,
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
  let refreshFrame: number | undefined;
  let progressBeforeRefresh: number | undefined;
  let scenePausedForEditorial = false;
  let chapterState: "held" | "overlay" | "released" | undefined;
  const mobileScroll = matchMedia(
    "(max-width: 800px), (pointer: coarse)",
  ).matches;
  const waterReveal = createWaterTextReveal({
    container: chapter,
    eyebrow: chapterEyebrow,
    headingLines: chapterLines,
    bodyLines: chapterBodyLines,
  });
  waterReveal.setProgress(0);
  const editorialTransformation = createEditorialTransformation({
    chapter,
    copy: chapterCopy,
    currentImage: chapterChild,
  });
  const umbrellaChapter = chapter.querySelector<HTMLElement>(
    "[data-umbrella-chapter]",
  );
  const umbrellaTransformation = umbrellaChapter
    ? createUmbrellaChapter(umbrellaChapter, interaction)
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
    const nextState = released || progress >= 0.999
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

  const requestRefresh = () => {
    if (refreshFrame !== undefined) cancelAnimationFrame(refreshFrame);
    refreshFrame = requestAnimationFrame(() => {
      refreshFrame = undefined;
      ScrollTrigger.refresh();
    });
  };

  const createScroll = () => {
    syncChapterState(0);
    scrollTimeline = gsap.timeline({
      scrollTrigger: {
        trigger: root,
        start: "top top",
        end: () => `+=${innerHeight * getNarrativeScrollDistance()}`,
        pin: true,
        pinSpacing: true,
        scrub: mobileScroll ? 0.58 : 0.72,
        anticipatePin: 1,
        invalidateOnRefresh: true,
        onUpdate: (trigger) => {
          interaction.updateScroll(trigger.scroll(), performance.now());
        },
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
            duration: UMBRELLA_TEXT_INTRO_DURATION,
            ease: "none",
            onUpdate: () =>
              umbrellaTransformation.setTextIntroProgress(
                umbrellaTextIntroState.progress,
              ),
          },
          UMBRELLA_TRANSITION_START + UMBRELLA_TEXT_INTRO_DELAY,
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
          UMBRELLA_TRANSITION_START +
            UMBRELLA_TEXT_INTRO_DELAY +
            UMBRELLA_TEXT_INTRO_DURATION,
        );
    }

    // Allocate CSS/compositor state before the first fast scroll crosses a chapter.
    scrollTimeline.progress(1, true).progress(0, true);
    requestRefresh();
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
  addEventListener("resize", requestRefresh, { passive: true });

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
    refresh: requestRefresh,
    destroy: () => {
      intro.kill();
      if (scenePausedForEditorial) {
        scene.start();
        scenePausedForEditorial = false;
      }
      if (refreshFrame !== undefined) cancelAnimationFrame(refreshFrame);
      ScrollTrigger.removeEventListener(
        "refreshInit",
        captureProgressBeforeRefresh,
      );
      removeEventListener("resize", requestRefresh);
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
