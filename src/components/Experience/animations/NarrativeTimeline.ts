import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import type { ExperienceScene } from "../webgl/ExperienceScene";
import { createEditorialTransformation } from "./EditorialTransformation";
import { createUmbrellaChapter } from "./UmbrellaChapter";
import { createWaterTextReveal } from "./WaterTextReveal";

gsap.registerPlugin(ScrollTrigger);

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
  const editorialPlayback = { progress: 0 };
  const umbrellaState = { progress: 0 };
  const textRevealState = { progress: 0 };
  const rainState = { visibility: 1 };
  let scrollTimeline: gsap.core.Timeline | undefined;
  let textRevealTimeline: gsap.core.Timeline | undefined;
  let editorialCatchupTween: gsap.core.Tween | undefined;
  let textRevealStarted = false;
  let textRevealComplete = false;
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

  const renderIntro = () => {
    scene.setEnvironmentVisibility(introState.environment);
    scene.setChildVisibility(introState.child);
    scene.setLightning(introState.light);
  };

  const resetTextReveal = () => {
    textRevealTimeline?.kill();
    textRevealTimeline = undefined;
    editorialCatchupTween?.kill();
    editorialCatchupTween = undefined;
    textRevealStarted = false;
    textRevealComplete = false;
    textRevealState.progress = 0;
    editorialPlayback.progress = 0;
    rainState.visibility = 1;
    waterReveal.setProgress(0);
    editorialTransformation.setProgress(0);
    scene.setRainVisibility(1);
  };

  const playTextReveal = () => {
    if (textRevealStarted) return;
    textRevealStarted = true;
    textRevealTimeline = gsap
      .timeline({
        onComplete: () => {
          textRevealComplete = true;
          editorialCatchupTween?.kill();
          editorialCatchupTween = gsap.to(editorialPlayback, {
            progress: editorialState.progress,
            duration: 0.65,
            ease: "power2.inOut",
            onUpdate: () =>
              editorialTransformation.setProgress(editorialPlayback.progress),
          });
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
        end: () => `+=${innerHeight * 12.2}`,
        pin: true,
        pinSpacing: true,
        scrub: 0.85,
        anticipatePin: 1,
        invalidateOnRefresh: true,
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
            if (narrative.progress >= 0.72) {
              playTextReveal();
            } else if (textRevealStarted) {
              resetTextReveal();
            }
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
          duration: 1.5,
          ease: "none",
          onUpdate: () => {
            if (textRevealComplete) {
              editorialCatchupTween?.kill();
              editorialCatchupTween = undefined;
              editorialPlayback.progress = editorialState.progress;
              editorialTransformation.setProgress(editorialPlayback.progress);
            }
          },
        },
        1,
      );

    if (umbrellaChapter) {
      scrollTimeline
        .to(
          editorialFinalElements,
          {
            opacity: 0,
            duration: 0.28,
            ease: "power2.inOut",
          },
          2.5,
        )
        .to(
          umbrellaState,
          {
            progress: 1,
            duration: 2.2,
            ease: "none",
            onUpdate: () =>
              umbrellaTransformation.setProgress(umbrellaState.progress),
          },
          2.5,
        );
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
      editorialCatchupTween?.kill();
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
        editorialPlayback,
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
