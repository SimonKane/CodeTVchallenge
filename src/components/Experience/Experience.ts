import { initializeHero } from "../Hero/Hero";
import { createNarrativeTimeline, type NarrativeController } from "./animations/NarrativeTimeline";
import { ExperienceScene } from "./webgl/ExperienceScene";
import { getQualityPreset, supportsWebGL } from "./webgl/QualityManager";

interface ExperienceInstance {
  scene: ExperienceScene;
  narrative: NarrativeController;
  resizeObserver: ResizeObserver;
  handleVisibility: () => void;
  decodeHandle?: number;
}

const instances = new Map<HTMLElement, ExperienceInstance>();
const initializing = new WeakSet<HTMLElement>();

const resetScrollOnReload = () => {
  const navigation = performance.getEntriesByType(
    "navigation",
  )[0] as PerformanceNavigationTiming | undefined;
  if (navigation?.type !== "reload") return;

  history.scrollRestoration = "manual";
  const root = document.documentElement;
  const previousBehavior = root.style.scrollBehavior;
  root.style.scrollBehavior = "auto";
  scrollTo(0, 0);
  requestAnimationFrame(() => {
    scrollTo(0, 0);
    root.style.scrollBehavior = previousBehavior;
  });
};

resetScrollOnReload();
addEventListener("load", resetScrollOnReload, { once: true });

const findFallback = (root: HTMLElement) => {
  const candidate = root.nextElementSibling;
  return candidate instanceof HTMLElement &&
    candidate.matches("[data-experience-fallback]")
    ? candidate
    : undefined;
};

const findChapter = (root: HTMLElement) => {
  const candidate = findFallback(root)?.nextElementSibling;
  return candidate instanceof HTMLElement &&
    candidate.matches("[data-experience-chapter]")
    ? candidate
    : undefined;
};

const activateFallback = (root: HTMLElement, staticMode = false) => {
  const fallback = findFallback(root);
  root.dataset.sceneStatus = "fallback";
  root.hidden = true;
  if (!fallback) return;
  fallback.hidden = false;
  fallback.dataset.active = staticMode ? "static" : "true";
  const hero = fallback.querySelector<HTMLElement>(".hero");
  if (hero && !staticMode) initializeHero(hero);
};

const destroyExperience = (root: HTMLElement) => {
  const instance = instances.get(root);
  if (!instance) return;
  instance.narrative.destroy();
  instance.resizeObserver.disconnect();
  document.removeEventListener("visibilitychange", instance.handleVisibility);
  if (instance.decodeHandle !== undefined) {
    if ("cancelIdleCallback" in window) {
      cancelIdleCallback(instance.decodeHandle);
    } else {
      cancelAnimationFrame(instance.decodeHandle);
    }
  }
  instance.scene.dispose();
  instances.delete(root);
};

const initializeExperience = async (root: HTMLElement) => {
  if (instances.has(root) || initializing.has(root)) return;
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reducedMotion || !supportsWebGL()) {
    activateFallback(root, reducedMotion);
    return;
  }

  const canvas = root.querySelector<HTMLCanvasElement>("[data-experience-canvas]");
  const copy = root.querySelector<HTMLElement>("[data-experience-copy]");
  const eyebrow = root.querySelector<HTMLElement>(".experience-eyebrow");
  const titleFirst = root.querySelector<HTMLElement>("[data-title-first]");
  const titleSecond = root.querySelector<HTMLElement>("[data-title-second]");
  const chapter = findChapter(root);
  const transitionFlash = chapter?.querySelector<HTMLElement>(
    "[data-transition-flash]",
  );
  const chapterCopy = chapter?.querySelector<HTMLElement>("[data-chapter-copy]");
  const chapterEyebrow = chapter?.querySelector<HTMLElement>(
    "[data-chapter-eyebrow]",
  );
  const chapterLines = chapter
    ? [...chapter.querySelectorAll<HTMLElement>("[data-chapter-line]")]
    : [];
  const chapterBody = chapter?.querySelector<HTMLElement>("[data-chapter-body]");
  const chapterBodyLines = chapter
    ? [...chapter.querySelectorAll<HTMLElement>("[data-chapter-body-line]")]
    : [];
  const chapterChild = chapter?.querySelector<HTMLElement>("[data-chapter-child]");
  if (
    !canvas ||
    !copy ||
    !transitionFlash ||
    !eyebrow ||
    !titleFirst ||
    !titleSecond ||
    !chapter ||
    !chapterCopy ||
    !chapterEyebrow ||
    chapterLines.length === 0 ||
    !chapterBody ||
    chapterBodyLines.length === 0 ||
    !chapterChild
  ) {
    activateFallback(root);
    return;
  }

  initializing.add(root);
  try {
    const scene = new ExperienceScene({
      canvas,
      streetUrl: canvas.dataset.streetSrc ?? "",
      depthUrl: canvas.dataset.depthSrc ?? "",
      childUrl: canvas.dataset.childSrc ?? "",
      childLookbackUrl: canvas.dataset.childLookbackSrc ?? "",
      quality: getQualityPreset(),
    });
    await scene.init();
    if (!document.contains(root)) {
      scene.dispose();
      return;
    }
    const narrative = createNarrativeTimeline(
      {
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
      },
      scene,
    );
    const resizeObserver = new ResizeObserver(() => scene.resize());
    resizeObserver.observe(root);
    const handleVisibility = () =>
      document.hidden ? scene.pause() : scene.start();
    document.addEventListener("visibilitychange", handleVisibility);
    const decodeLaterImages = () => {
      chapter
        .querySelectorAll<HTMLImageElement>("img")
        .forEach((image) => void image.decode().catch(() => undefined));
    };
    const decodeHandle = "requestIdleCallback" in window
      ? requestIdleCallback(decodeLaterImages, { timeout: 1400 })
      : requestAnimationFrame(decodeLaterImages);
    instances.set(root, {
      scene,
      narrative,
      resizeObserver,
      handleVisibility,
      decodeHandle,
    });
    root.dataset.sceneStatus = "ready";
    scene.start();
  } catch (error) {
    console.warn("WebGL experience unavailable; showing static scene.", error);
    activateFallback(root);
  } finally {
    initializing.delete(root);
  }
};

const destroyExperiences = () => [...instances.keys()].forEach(destroyExperience);

const initializeExperiences = async () => {
  const roots = [
    ...document.querySelectorAll<HTMLElement>("[data-cinematic-scene]"),
  ];
  await Promise.all(roots.map(initializeExperience));
};

void initializeExperiences();
document.addEventListener("astro:page-load", () => void initializeExperiences());
document.addEventListener("astro:before-swap", () => {
  destroyExperiences();
});
