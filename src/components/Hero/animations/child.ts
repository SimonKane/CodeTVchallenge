import { gsap } from "gsap";
import { HERO_CHILD_MOTION } from "../../../config/motion";
import {
  createBreathingAnimation,
  type BreathingController,
} from "./breathing";

export const addChildReveal = (
  timeline: gsap.core.Timeline,
  child: HTMLElement,
  revealAt: number,
): BreathingController => {
  const breathing = createBreathingAnimation(child);

  // Keep the child absent until the second lightning strike begins.
  gsap.set(child, {
    opacity: 0,
    y: 0,
    scale: 1,
  });

  // Fade the child into the illuminated scene, then begin its idle motion.
  timeline
    .to(
      child,
      {
        opacity: 1,
        duration: HERO_CHILD_MOTION.revealDuration,
        ease: "power2.out",
      },
      revealAt,
    )
    .call(
      () => breathing.resume(),
      undefined,
      revealAt + HERO_CHILD_MOTION.revealDuration,
    );

  return breathing;
};
