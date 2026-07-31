import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

interface CameraApproachElements {
  hero: HTMLElement;
  street: HTMLElement;
  childPositioner: HTMLElement;
  childAwareness: HTMLElement;
  copy: HTMLElement;
}

export interface CameraApproachController {
  destroy: () => void;
}

const CAMERA_MOTION = {
  desktopScrollDistanceInViewports: 1.8,
  mobileScrollDistanceInViewports: 1.1,
  backgroundScale: 1.09,
  childScale: 1.035,
  backgroundTravelInViewports: 0.045,
  childTravelInViewports: 0.008,
  textFadeProgress: 0.25,
  scrubSmoothing: 1,
  awarenessStart: 0.59,
  awarenessDuration: 0.18,
  awarenessRotation: -2.25,
  awarenessLift: -1,
} as const;

/**
 * Creates the scroll-controlled camera approach after the intro has finished.
 * The child wrapper moves independently while breathing continues on its image.
 */
export const createCameraApproach = ({
  hero,
  street,
  childPositioner,
  childAwareness,
  copy,
}: CameraApproachElements): CameraApproachController => {
  const media = gsap.matchMedia();

  media.add("(prefers-reduced-motion: no-preference)", () => {
    const timeline = gsap.timeline({
      scrollTrigger: {
        trigger: hero,
        start: "top top",
        end: () =>
          `+=${
            window.innerHeight *
            (matchMedia("(max-width: 720px)").matches
              ? CAMERA_MOTION.mobileScrollDistanceInViewports
              : CAMERA_MOTION.desktopScrollDistanceInViewports)
          }`,
        pin: true,
        scrub: CAMERA_MOTION.scrubSmoothing,
        anticipatePin: 1,
        invalidateOnRefresh: true,
      },
    });

    timeline
      // Let translation carry the move while restrained scale adds forward depth.
      .to(
        street,
        {
          scale: CAMERA_MOTION.backgroundScale,
          y: () =>
            window.innerHeight *
            CAMERA_MOTION.backgroundTravelInViewports,
          transformOrigin: "50% 58%",
          duration: 1,
          ease: "none",
        },
        0,
      )
      // Drift the grounded child more slowly to create natural layer parallax.
      .to(
        childPositioner,
        {
          scale: CAMERA_MOTION.childScale,
          y: () =>
            window.innerHeight * CAMERA_MOTION.childTravelInViewports,
          transformOrigin: "50% 86%",
          duration: 1,
          ease: "none",
        },
        0,
      )
      // Keep the message momentarily, then clear it early in the approach.
      .to(
        copy,
        {
          opacity: 0,
          duration: CAMERA_MOTION.textFadeProgress,
          ease: "power1.out",
        },
        0,
      )
      // Suggest a quiet head lift late in the approach without interrupting breath.
      .to(
        childAwareness,
        {
          rotationX: CAMERA_MOTION.awarenessRotation,
          y: CAMERA_MOTION.awarenessLift,
          transformPerspective: 1200,
          transformOrigin: "50% 30%",
          duration: CAMERA_MOTION.awarenessDuration,
          ease: "sine.inOut",
        },
        CAMERA_MOTION.awarenessStart,
      );

    return () => {
      timeline.scrollTrigger?.kill();
      timeline.kill();
    };
  });

  return {
    destroy: () => media.revert(),
  };
};
