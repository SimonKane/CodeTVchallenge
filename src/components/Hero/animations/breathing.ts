import { gsap } from "gsap";
import { HERO_CHILD_MOTION } from "../../../config/motion";

export interface BreathingController {
  animation: gsap.core.Tween;
  pause: () => void;
  resume: () => void;
  setIntensity: (intensity: number) => void;
  destroy: () => void;
}

/**
 * Creates a paused breathing loop. Its small API allows later features to
 * pause the motion or change its amplitude without rebuilding the animation.
 */
export const createBreathingAnimation = (
  child: HTMLElement,
): BreathingController => {
  const state = {
    phase: 0,
    intensity: 1,
  };
  const setY = gsap.quickSetter(child, "y", "px");
  const setScale = gsap.quickSetter(child, "scale");

  const render = () => {
    setY(
      -HERO_CHILD_MOTION.breathingVerticalDistance *
        state.phase *
        state.intensity,
    );
    setScale(
      1 +
        HERO_CHILD_MOTION.breathingScaleDelta *
          state.phase *
          state.intensity,
    );
  };

  const animation = gsap.to(state, {
    phase: 1,
    duration: HERO_CHILD_MOTION.breathingHalfCycleDuration,
    ease: "sine.inOut",
    repeat: -1,
    yoyo: true,
    paused: true,
    onUpdate: render,
  });

  return {
    animation,
    pause: () => animation.pause(),
    resume: () => animation.resume(),
    setIntensity: (intensity) => {
      state.intensity = Math.max(0, intensity);
      render();
    },
    destroy: () => {
      animation.kill();
      gsap.set(child, { clearProps: "transform" });
    },
  };
};
