import { HERO_INTRO_MOTION } from "../../../config/motion";
import { addChildReveal } from "./child";
import { createIntroTimeline, type HeroIntroElements } from "./intro";

export interface HeroAnimationElements extends HeroIntroElements {
  child: HTMLElement;
}

/**
 * Hero animation entry point. Future feature timelines can be composed here
 * without coupling them to the component bootstrap.
 */
export const createHeroTimeline = (elements: HeroAnimationElements) => {
  const timeline = createIntroTimeline(elements);
  const childBreathing = addChildReveal(
    timeline,
    elements.child,
    HERO_INTRO_MOTION.secondFlashAt,
  );

  return {
    timeline,
    childBreathing,
  };
};
