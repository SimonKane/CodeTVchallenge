import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import type { ExperienceScene } from "../webgl/ExperienceScene";

gsap.registerPlugin(ScrollTrigger);

interface NarrativeElements {
  root: HTMLElement;
  copy: HTMLElement;
  eyebrow: HTMLElement;
  titleFirst: HTMLElement;
  titleSecond: HTMLElement;
  chapter: HTMLElement;
  chapterEyebrow: HTMLElement;
  chapterLines: HTMLElement[];
  chapterBody: HTMLElement;
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
    eyebrow,
    titleFirst,
    titleSecond,
    chapter,
    chapterEyebrow,
    chapterLines,
    chapterBody,
  } = elements;
  const introState = { light: 0, environment: 0, child: 0 };
  const narrative = { progress: 0, lightning: 0.12 };
  let scrollTimeline: gsap.core.Timeline | undefined;
  let chapterTimeline: gsap.core.Timeline | undefined;

  const renderIntro = () => {
    scene.setEnvironmentVisibility(introState.environment);
    scene.setChildVisibility(introState.child);
    scene.setLightning(introState.light);
  };

  const createScroll = () => {
    scrollTimeline = gsap.timeline({
      scrollTrigger: {
        trigger: root,
        start: "top top",
        end: () => `+=${innerHeight * 3.2}`,
        pin: true,
        scrub: 0.65,
        anticipatePin: 1,
        invalidateOnRefresh: true,
      },
    });

    scrollTimeline
      .to(
        narrative,
        {
          progress: 1,
          duration: 1,
          ease: "none",
          onUpdate: () => scene.setProgress(narrative.progress),
        },
        0,
      )
      .to(copy, { opacity: 0, y: -26, duration: 0.18, ease: "power2.out" }, 0.02)
      .to(
        narrative,
        {
          lightning: 0.42,
          duration: 0.01,
          onUpdate: () => scene.setLightning(narrative.lightning),
        },
        0.94,
      )
      .to(
        narrative,
        {
          lightning: 0.12,
          duration: 0.045,
          ease: "power2.out",
          onUpdate: () => scene.setLightning(narrative.lightning),
        },
        0.95,
      );

    chapterTimeline = gsap.timeline({
      scrollTrigger: {
        trigger: chapter,
        start: "top 90%",
        toggleActions: "play none none reverse",
      },
    });
    chapterTimeline
      .to(
        chapter,
        {
          "--chapter-warmth": 1,
          duration: 1.25,
          ease: "power2.inOut",
        },
        0,
      )
      .to(
        chapterEyebrow,
        { opacity: 1, y: 0, duration: 0.55, ease: "power2.out" },
        0.18,
      )
      .to(
        chapterLines,
        {
          yPercent: 0,
          duration: 0.95,
          stagger: 0.12,
          ease: "power3.out",
        },
        0.28,
      )
      .to(
        chapterBody,
        {
          clipPath: "inset(0% 0% 0% 0%)",
          y: 0,
          duration: 0.85,
          ease: "power3.out",
        },
        0.68,
      );
  };

  gsap.set([eyebrow, titleFirst, titleSecond], { opacity: 0, y: 12 });
  gsap.set(chapterEyebrow, { opacity: 0, y: 16 });
  gsap.set(chapterLines, { yPercent: 112 });
  gsap.set(chapterBody, {
    clipPath: "inset(100% 0% 0% 0%)",
    y: 28,
  });
  renderIntro();

  const intro = gsap.timeline({
    defaults: { ease: "power2.inOut" },
    onComplete: createScroll,
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
      scrollTimeline?.scrollTrigger?.kill();
      scrollTimeline?.kill();
      chapterTimeline?.scrollTrigger?.kill();
      chapterTimeline?.kill();
      gsap.killTweensOf([
        introState,
        narrative,
        copy,
        eyebrow,
        titleFirst,
        titleSecond,
        chapter,
        chapterEyebrow,
        chapterLines,
        chapterBody,
      ]);
    },
  };
};
