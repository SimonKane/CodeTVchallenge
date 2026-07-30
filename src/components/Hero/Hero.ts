import { createHeroTimeline } from "./animations/timeline";
import {
  createCameraApproach,
  type CameraApproachController,
} from "./animations/camera";

interface HeroInstance {
  intro: ReturnType<typeof createHeroTimeline>;
  camera?: CameraApproachController;
}

const instances = new Map<HTMLElement, HeroInstance>();

export const initializeHero = (hero: HTMLElement) => {
  if (instances.has(hero)) {
    return;
  }

  const fallback = hero.closest<HTMLElement>("[data-experience-fallback]");
  if (fallback && fallback.dataset.active !== "true") {
    return;
  }

  const street = hero.querySelector<HTMLElement>(".hero-street");
  const child = hero.querySelector<HTMLElement>(".hero-child");
  const childPositioner = hero.querySelector<HTMLElement>(
    ".hero-child-positioner",
  );
  const childAwareness = hero.querySelector<HTMLElement>(
    ".hero-child-awareness",
  );
  const darkness = hero.querySelector<HTMLElement>(".hero-darkness");
  const flash = hero.querySelector<HTMLElement>(".hero-flash");
  const copy = hero.querySelector<HTMLElement>(".hero-copy");
  const eyebrow = hero.querySelector<HTMLElement>(".hero-eyebrow");
  const titleFirst = hero.querySelector<HTMLElement>(
    ".hero-title-word--first",
  );
  const titleSecond = hero.querySelector<HTMLElement>(
    ".hero-title-word--second",
  );

  if (
    !street ||
    !child ||
    !childPositioner ||
    !childAwareness ||
    !darkness ||
    !flash ||
    !copy ||
    !eyebrow ||
    !titleFirst ||
    !titleSecond
  ) {
    console.warn("Ett eller flera element i Hero saknas.");
    return;
  }

  const intro = createHeroTimeline({
    street,
    child,
    darkness,
    flash,
    copy,
    eyebrow,
    titleFirst,
    titleSecond,
  });

  const instance: HeroInstance = { intro };
  instances.set(hero, instance);

  // Scroll interaction is created only after every intro beat has completed.
  intro.timeline.eventCallback("onComplete", () => {
    if (!instances.has(hero)) {
      return;
    }

    instance.camera = createCameraApproach({
      hero,
      street,
      childPositioner,
      childAwareness,
      copy,
    });
  });
};

const initializeHeroes = () => {
  document.querySelectorAll<HTMLElement>(".hero").forEach(initializeHero);
};

const destroyHeroes = () => {
  instances.forEach(({ intro, camera }) => {
    camera?.destroy();
    intro.timeline.kill();
    intro.childBreathing.destroy();
  });
  instances.clear();
};

initializeHeroes();

// Support Astro client-side navigation without leaking timelines or triggers.
document.addEventListener("astro:page-load", initializeHeroes);
document.addEventListener("astro:before-swap", destroyHeroes);
