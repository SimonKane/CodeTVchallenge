import { initializeHero } from "../Hero/Hero";
import { createNarrativeTimeline, type NarrativeController } from "./animations/NarrativeTimeline";
import { ExperienceScene } from "./webgl/ExperienceScene";
import { getQualityPreset, supportsWebGL } from "./webgl/QualityManager";

interface ExperienceInstance {
  scene: ExperienceScene;
  narrative: NarrativeController;
  resizeObserver: ResizeObserver;
  handleVisibility: () => void;
}

const instances = new Map<HTMLElement, ExperienceInstance>();

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
  instance.scene.dispose();
  instances.delete(root);
};

const initializeExperience = async (root: HTMLElement) => {
  if (
    instances.has(root) ||
    matchMedia("(prefers-reduced-motion: reduce)").matches ||
    !supportsWebGL()
  ) {
    if (!instances.has(root)) {
      activateFallback(
        root,
        matchMedia("(prefers-reduced-motion: reduce)").matches,
      );
    }
    return;
  }

  const canvas = root.querySelector<HTMLCanvasElement>("[data-experience-canvas]");
  const copy = root.querySelector<HTMLElement>("[data-experience-copy]");
  const eyebrow = root.querySelector<HTMLElement>(".experience-eyebrow");
  const titleFirst = root.querySelector<HTMLElement>("[data-title-first]");
  const titleSecond = root.querySelector<HTMLElement>("[data-title-second]");
  const chapter = findChapter(root);
  const chapterEyebrow = chapter?.querySelector<HTMLElement>(
    "[data-chapter-eyebrow]",
  );
  const chapterLines = chapter
    ? [...chapter.querySelectorAll<HTMLElement>("[data-chapter-line]")]
    : [];
  const chapterBody = chapter?.querySelector<HTMLElement>("[data-chapter-body]");
  if (
    !canvas ||
    !copy ||
    !eyebrow ||
    !titleFirst ||
    !titleSecond ||
    !chapter ||
    !chapterEyebrow ||
    chapterLines.length === 0 ||
    !chapterBody
  ) {
    activateFallback(root);
    return;
  }

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
        eyebrow,
        titleFirst,
        titleSecond,
        chapter,
        chapterEyebrow,
        chapterLines,
        chapterBody,
      },
      scene,
    );
    const resizeObserver = new ResizeObserver(() => scene.resize());
    resizeObserver.observe(root);
    const handleVisibility = () =>
      document.hidden ? scene.pause() : scene.start();
    document.addEventListener("visibilitychange", handleVisibility);
    instances.set(root, { scene, narrative, resizeObserver, handleVisibility });
    root.dataset.sceneStatus = "ready";
    scene.start();
  } catch (error) {
    console.warn("WebGL experience unavailable; showing static scene.", error);
    activateFallback(root);
  }
};

const initializeExperiences = () => {
  document
    .querySelectorAll<HTMLElement>("[data-cinematic-scene]")
    .forEach((root) => void initializeExperience(root));
};

const destroyExperiences = () => [...instances.keys()].forEach(destroyExperience);

initializeExperiences();
document.addEventListener("astro:page-load", initializeExperiences);
document.addEventListener("astro:before-swap", destroyExperiences);
