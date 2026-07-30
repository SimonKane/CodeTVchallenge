import { gsap } from "gsap";
import {
  HERO_INTRO_MOTION,
  HERO_INTRO_VISUALS,
} from "../../../config/motion";
import { addLightningFlash, type LightningElements } from "./lightning";

export interface HeroIntroElements extends LightningElements {
  copy: HTMLElement;
  eyebrow: HTMLElement;
  titleFirst: HTMLElement;
  titleSecond: HTMLElement;
}

export const createIntroTimeline = ({
  street,
  darkness,
  flash,
  copy,
  eyebrow,
  titleFirst,
  titleSecond,
}: HeroIntroElements) => {
  const timeline = gsap.timeline({
    defaults: {
      ease: "power2.inOut",
    },
  });

  // Establish a true blackout before the first delayed timeline event.
  gsap.set(street, {
    opacity: 0,
    filter: `brightness(${HERO_INTRO_VISUALS.hiddenStreetBrightness})`,
  });
  gsap.set(darkness, {
    backgroundColor: HERO_INTRO_VISUALS.blackout,
  });
  gsap.set(flash, { opacity: 0 });
  gsap.set(copy, { opacity: 1 });
  gsap.set([eyebrow, titleFirst, titleSecond], {
    opacity: 0,
    y: HERO_INTRO_MOTION.textOffset,
  });

  // First strike: reveal only the street briefly, then return to darkness.
  addLightningFlash(
    timeline,
    { street, darkness, flash },
    {
      at: HERO_INTRO_MOTION.firstFlashAt,
      flashInDuration: HERO_INTRO_MOTION.flashInDuration,
      flashOutDuration: HERO_INTRO_MOTION.firstFlashOutDuration,
      flashOpacity: HERO_INTRO_VISUALS.firstFlashOpacity,
      peakBrightness: HERO_INTRO_VISUALS.firstFlashBrightness,
      endBrightness: HERO_INTRO_VISUALS.hiddenStreetBrightness,
      peakDarkness: HERO_INTRO_VISUALS.flashDarkness,
      endDarkness: HERO_INTRO_VISUALS.blackout,
      hideStreetAfterFlash: true,
    },
  );

  // Second strike: reveal the street again and let it settle into view.
  addLightningFlash(
    timeline,
    { street, darkness, flash },
    {
      at: HERO_INTRO_MOTION.secondFlashAt,
      flashInDuration: HERO_INTRO_MOTION.flashInDuration,
      flashOutDuration: HERO_INTRO_MOTION.secondFlashOutDuration,
      flashOpacity: HERO_INTRO_VISUALS.secondFlashOpacity,
      peakBrightness: HERO_INTRO_VISUALS.secondFlashBrightness,
      endBrightness: HERO_INTRO_VISUALS.visibleStreetBrightness,
      peakDarkness: HERO_INTRO_VISUALS.flashDarkness,
      endDarkness: HERO_INTRO_VISUALS.settledDarkness,
    },
  );

  const sceneSettledAt =
    HERO_INTRO_MOTION.secondFlashAt +
    HERO_INTRO_MOTION.flashInDuration +
    HERO_INTRO_MOTION.secondFlashOutDuration;
  const firstWordAt =
    sceneSettledAt + HERO_INTRO_MOTION.eyebrowFadeDuration;
  const secondWordAt =
    firstWordAt +
    HERO_INTRO_MOTION.wordFadeDuration +
    HERO_INTRO_MOTION.wordPause;

  // Once the scene has settled, introduce the copy in restrained stages.
  timeline
    .to(
      eyebrow,
      {
        opacity: 1,
        y: 0,
        duration: HERO_INTRO_MOTION.eyebrowFadeDuration,
        ease: "power2.out",
      },
      sceneSettledAt,
    )
    .to(
      titleFirst,
      {
        opacity: 1,
        y: 0,
        duration: HERO_INTRO_MOTION.wordFadeDuration,
        ease: "power2.out",
      },
      firstWordAt,
    )
    .to(
      titleSecond,
      {
        opacity: 1,
        y: 0,
        duration: HERO_INTRO_MOTION.wordFadeDuration,
        ease: "power2.out",
      },
      secondWordAt,
    );

  return timeline;
};
