import { gsap } from "gsap";
import { createUmbrellaRainCanvas } from "./UmbrellaRainCanvas";
import type { InteractionField } from "../motion/InteractionField";

export interface UmbrellaChapterController {
  setEntranceProgress: (progress: number) => void;
  setProgress: (progress: number) => void;
  setTextIntroProgress: (progress: number) => void;
  destroy: () => void;
}

export interface UmbrellaInteractionController {
  destroy: () => void;
}

interface PushVector {
  x: number;
  y: number;
  rotation: number;
}

const fract = (value: number) => value - Math.floor(value);
const hash = (value: number) => fract(Math.sin(value) * 43758.5453123);
const clamp = (value: number) => Math.min(1, Math.max(0, value));
const BACKGROUND_READY_TIME = 0.6;
const TEXT_SETTLED_TIME = 2.66;
const UMBRELLA_OPEN_READY_TIME = 3.44;
const INTERACTION_REVEAL_TIME = 4.32;
const OPENING_INTRO_PROGRESS = 0.72;
const AUTO_OPEN_PORTION = 0.28;

export const createStaticUmbrellaInteraction = (
  chapter: HTMLElement,
  interaction: InteractionField,
): UmbrellaInteractionController => {
  const umbrellaChapter = chapter.matches("[data-umbrella-chapter]")
    ? chapter
    : chapter.querySelector<HTMLElement>("[data-umbrella-chapter]");
  const openControl = umbrellaChapter?.querySelector<HTMLButtonElement>(
    "[data-umbrella-hit-target]",
  );
  const status = umbrellaChapter?.querySelector<HTMLElement>(
    "[data-umbrella-status]",
  );
  if (!umbrellaChapter || !openControl || !status) {
    return { destroy: () => undefined };
  }

  const media = umbrellaChapter?.querySelector<HTMLElement>("[data-umbrella-media]");
  let animationFrame: number | undefined;
  const updateInteraction = (time: number) => {
    const snapshot = interaction.sample(time);
    media?.style.setProperty("--umbrella-tilt-x", `${(snapshot.pointerX - 0.5) * 5}deg`);
    media?.style.setProperty("--umbrella-tilt-y", `${(0.5 - snapshot.pointerY) * 3}deg`);
    animationFrame = requestAnimationFrame(updateInteraction);
  };
  const open = () => {
    umbrellaChapter.classList.add("umbrella-chapter--opened");
    openControl.setAttribute("aria-expanded", "true");
    openControl.tabIndex = -1;
    status.textContent = "The umbrella is open. Welcome to a safe place.";
  };

  umbrellaChapter.classList.add("umbrella-chapter--control-visible");
  openControl.tabIndex = 0;
  openControl.addEventListener("click", open);
  animationFrame = requestAnimationFrame(updateInteraction);

  return {
    destroy: () => {
      openControl.removeEventListener("click", open);
      if (animationFrame !== undefined) cancelAnimationFrame(animationFrame);
      umbrellaChapter.classList.remove(
        "umbrella-chapter--control-visible",
        "umbrella-chapter--opened",
      );
    },
  };
};

const splitIntoRainCharacters = (element: HTMLElement) => {
  const textNodes: Text[] = [];
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  let node = walker.nextNode();
  while (node) {
    if (node.textContent?.trim()) textNodes.push(node as Text);
    node = walker.nextNode();
  }

  textNodes.forEach((textNode) => {
    const fragment = document.createDocumentFragment();
    const parts = (textNode.textContent ?? "").split(/(\s+)/);
    parts.forEach((part) => {
      if (!part) return;
      if (/^\s+$/.test(part)) {
        fragment.append(part);
        return;
      }
      const word = document.createElement("span");
      word.className = "umbrella-rain-word umbrella-rain-character";
      word.textContent = part;
      fragment.append(word);
    });
    textNode.replaceWith(fragment);
  });

  return [
    ...element.querySelectorAll<HTMLElement>(".umbrella-rain-character"),
  ];
};

const createPushVectors = (
  letters: HTMLElement[],
  stage: HTMLElement,
): PushVector[] => {
  const stageBounds = stage.getBoundingClientRect();
  const centerX = stageBounds.left + stageBounds.width / 2;

  return letters.map((letter, index) => {
    const bounds = letter.getBoundingClientRect();
    let dx = bounds.left + bounds.width / 2 - centerX;
    if (Math.abs(dx) < stageBounds.width * 0.04) {
      dx += (index % 2 === 0 ? -1 : 1) * stageBounds.width * 0.08;
    }
    const direction = dx < 0 ? -1 : 1;
    return {
      x:
        direction *
        stageBounds.width *
        (0.27 + hash(index * 8.17 + 3.2) * 0.2),
      y: -stageBounds.height * (0.2 + hash(index * 4.31) * 0.28),
      rotation:
        (index % 2 === 0 ? -1 : 1) *
        (45 + hash(index * 6.93 + 8.4) * 170),
    };
  });
};

export const createUmbrellaChapter = (
  chapter: HTMLElement,
  interaction: InteractionField,
): UmbrellaChapterController => {
  const experienceChapter = chapter.closest<HTMLElement>(
    "[data-experience-chapter]",
  );
  const stage = chapter.querySelector<HTMLElement>("[data-umbrella-stage]");
  const media = chapter.querySelector<HTMLElement>("[data-umbrella-media]");
  const closedUmbrella = chapter.querySelector<HTMLElement>(
    "[data-umbrella-closed]",
  );
  const openUmbrella = chapter.querySelector<HTMLElement>("[data-umbrella-open]");
  const canopyRain = chapter.querySelector<HTMLCanvasElement>(
    "[data-umbrella-canopy-rain]",
  );
  const problem = chapter.querySelector<HTMLElement>("[data-umbrella-problem]");
  const safeCopy = chapter.querySelector<HTMLElement>("[data-umbrella-safe]");
  const shelteredChild = chapter.querySelector<HTMLElement>(
    "[data-umbrella-sheltered-child]",
  );
  const shelterGlow = chapter.querySelector<HTMLElement>("[data-umbrella-glow]");
  const exposure = chapter.querySelector<HTMLElement>(
    "[data-umbrella-exposure]",
  );
  const openControl = chapter.querySelector<HTMLButtonElement>(
    "[data-umbrella-hit-target]",
  );
  const status = chapter.querySelector<HTMLElement>("[data-umbrella-status]");

  if (
    !stage ||
    !media ||
    !closedUmbrella ||
    !openUmbrella ||
    !canopyRain ||
    !problem ||
    !safeCopy ||
    !shelteredChild ||
    !shelterGlow ||
    !exposure ||
    !openControl ||
    !status
  ) {
    return {
      setEntranceProgress: () => undefined,
      setProgress: () => undefined,
      setTextIntroProgress: () => undefined,
      destroy: () => undefined,
    };
  }

  const rainText = [
    ...problem.querySelectorAll<HTMLElement>("[data-umbrella-rain-text]"),
  ];
  const rainCharacters = rainText.flatMap(splitIntoRainCharacters);
  const mobile = matchMedia("(max-width: 800px), (pointer: coarse)").matches;
  const safeBlocks = [
    ...safeCopy.querySelectorAll<HTMLElement>("h2, p"),
  ];
  const pushVectors = createPushVectors(rainCharacters, stage);
  const rainCanvas = createUmbrellaRainCanvas(canopyRain, openUmbrella);
  const rainState = { visibility: 0 };
  const interactionState = { progress: 0 };
  let entranceProgress = 0;
  let requestedProgress = 0;
  let textIntroProgress = 0;
  let previousEffectiveTime = -1;
  let openedByUser = false;
  let renderProgress = () => undefined;
  let interactionFrame: number | undefined;

  const openFromInteraction = () => {
    if (openedByUser) return;
    openedByUser = true;
    chapter.classList.add("umbrella-chapter--interaction-requested");
    openControl.setAttribute("aria-expanded", "true");
    status.textContent = "The umbrella is opening. Welcome to a safe place.";
    gsap.to(interactionState, {
      progress: 1,
      duration: 0.86,
      ease: "power3.inOut",
      overwrite: true,
      onUpdate: () => renderProgress(),
      onComplete: () => {
        status.textContent = "The umbrella is open. Welcome to a safe place.";
      },
    });
  };

  openControl.addEventListener("click", openFromInteraction);

  gsap.set(stage, { opacity: 0 });
  gsap.set(closedUmbrella, {
    opacity: 0,
    scale: 0.96,
    rotation: 180,
    transformOrigin: "50% 50%",
    filter: "brightness(1.08) contrast(1.16)",
  });
  gsap.set(openUmbrella, {
    opacity: 0,
    scale: 0.76,
    y: "5svh",
    clipPath: "circle(0% at 50% 37%)",
    filter: "brightness(1.06) contrast(1.14)",
  });
  rainCanvas.setVisibility(0);
  gsap.set(rainCharacters, {
    opacity: 0,
    x: (index: number) => `${(hash(index * 3.71) - 0.5) * 24}px`,
    y: (index: number) => `${-28 - hash(index * 7.13 + 2.4) * 68}px`,
    rotation: (index: number) => (hash(index * 5.29) - 0.5) * 12,
    scaleX: 0.62,
    scaleY: 1.38,
    filter: mobile ? "none" : "blur(1px)",
    "--umbrella-rain-trail": 0.45,
  });
  gsap.set(safeBlocks, { opacity: 0, y: 22 });
  gsap.set(shelteredChild, {
    "--sheltered-child-reveal": 0,
    x: 24,
    scale: 1.035,
    filter: "brightness(0.7) contrast(1.18) saturate(0.74) blur(2px)",
  });
  gsap.set([shelterGlow, exposure], { opacity: 0 });

  const timeline = gsap.timeline({ paused: true });
  timeline
    .to(stage, { opacity: 1, duration: 0.52, ease: "power2.inOut" }, 0)
    .to(
      closedUmbrella,
      {
        opacity: 1,
        scale: 1,
        filter: "brightness(1.12) contrast(1.12)",
        duration: 0.46,
        ease: "power2.inOut",
      },
      0.12,
    )
    .to(
      rainCharacters,
      {
        opacity: 1,
        x: 0,
        y: 0,
        rotation: 0,
        scaleX: 1,
        scaleY: 1,
        filter: "none",
        "--umbrella-rain-trail": 0,
        duration: 0.44,
        stagger: { amount: 0.38, from: "random" },
        ease: "power2.out",
      },
      0.72,
    )
    .to(exposure, { opacity: 0.82, duration: 0.035 }, 2.82)
    .to(exposure, { opacity: 0.08, duration: 0.1 }, 2.855)
    .to(exposure, { opacity: 0.52, duration: 0.025 }, 2.955)
    .to(exposure, { opacity: 0, duration: 0.17 }, 2.98)
    .to(
      closedUmbrella,
      {
        scale: 1.025,
        filter: "brightness(1.7) contrast(1.2)",
        duration: 0.06,
        ease: "power2.in",
      },
      2.78,
    )
    .to(closedUmbrella, { opacity: 0, duration: 0.08 }, 2.84)
    .set(openUmbrella, { opacity: 1 }, 2.86)
    .to(
      openUmbrella,
      {
        scale: 1,
        y: 0,
        clipPath: "circle(78% at 50% 37%)",
        filter: "brightness(1.1) contrast(1.1)",
        duration: 0.42,
        ease: "power3.out",
      },
      2.86,
    )
    .to(
      openUmbrella,
      {
        scale: 0.985,
        duration: 0.12,
        ease: "power2.inOut",
        yoyo: true,
        repeat: 1,
      },
      3.2,
    )
    .to(
      rainCharacters,
      {
        x: (index: number) => pushVectors[index].x,
        y: (index: number) => pushVectors[index].y,
        rotation: (index: number) => pushVectors[index].rotation,
        scale: 0.55,
        opacity: 0,
        filter: mobile ? "none" : "blur(1.8px)",
        duration: 0.54,
        stagger: { amount: 0.12, from: "center" },
        ease: "power3.out",
      },
      2.82,
    )
    .to(
      rainState,
      {
        visibility: 1,
        duration: 0.34,
        ease: "power2.out",
        onUpdate: () => rainCanvas.setVisibility(rainState.visibility),
      },
      3.1,
    )
    .to(shelterGlow, { opacity: 1, duration: 0.55, ease: "power2.out" }, 3.28)
    .to(
      shelteredChild,
      {
        "--sheltered-child-reveal": 1,
        x: 0,
        scale: 1,
        filter: "brightness(1.06) contrast(1.08) saturate(0.92) blur(0px)",
        duration: 0.82,
        ease: "power3.out",
      },
      3.32,
    )
    .to(
      safeBlocks,
      {
        opacity: 1,
        y: 0,
        duration: 0.58,
        stagger: 0.12,
        ease: "power3.out",
      },
      3.38,
    )
    .to({}, { duration: 0.72 });

  // Warm all CSSPlugin property renderers before the umbrella is visible.
  timeline.progress(1, true).progress(0, true);

  const applyInteractionMotion = () => {
    const motion = interaction.sample();
    const interactionEnergy = Math.min(
      1,
      Math.hypot(motion.pointerVelocityX, motion.pointerVelocityY) *
        (motion.dragging ? 0.8 : 0.32),
    );
    media.style.setProperty(
      "--umbrella-tilt-x",
      `${(motion.pointerX - 0.5) * (motion.dragging ? 7 : 4)}deg`,
    );
    media.style.setProperty(
      "--umbrella-tilt-y",
      `${(0.5 - motion.pointerY) * (motion.dragging ? 4 : 2.5)}deg`,
    );
    media.style.setProperty("--umbrella-motion-energy", `${interactionEnergy}`);
    rainCanvas.setInteraction(motion);
  };

  renderProgress = () => {
    applyInteractionMotion();
    const timelineDuration = timeline.duration();
    const textTime = textIntroProgress > 0
      ? BACKGROUND_READY_TIME +
        (textIntroProgress / OPENING_INTRO_PROGRESS) *
          (TEXT_SETTLED_TIME - BACKGROUND_READY_TIME)
      : entranceProgress * BACKGROUND_READY_TIME;
    const settledTextTime = Math.min(TEXT_SETTLED_TIME, textTime);
    const autoOpenProgress = clamp(requestedProgress / AUTO_OPEN_PORTION);
    const openingProgress = Math.max(
      interactionState.progress,
      autoOpenProgress,
    );
    rainCanvas.setCollisionProgress(openingProgress);
    const finaleProgress = openedByUser
      ? requestedProgress
      : clamp(
          (requestedProgress - AUTO_OPEN_PORTION) / (1 - AUTO_OPEN_PORTION),
        );
    let effectiveTime = settledTextTime;
    if (openedByUser) {
      effectiveTime = Math.max(
        effectiveTime,
        TEXT_SETTLED_TIME +
          interactionState.progress *
            (Math.min(timelineDuration, INTERACTION_REVEAL_TIME) -
              TEXT_SETTLED_TIME),
      );
    }
    if (openingProgress > 0) {
      effectiveTime = Math.max(
        effectiveTime,
        TEXT_SETTLED_TIME +
          openingProgress * (UMBRELLA_OPEN_READY_TIME - TEXT_SETTLED_TIME),
      );
    }
    if (openingProgress >= 0.999) {
      effectiveTime = Math.max(
        effectiveTime,
        UMBRELLA_OPEN_READY_TIME +
          finaleProgress * (timelineDuration - UMBRELLA_OPEN_READY_TIME),
      );
    }
    const controlVisible =
      entranceProgress >= 0.9 &&
      textIntroProgress >= OPENING_INTRO_PROGRESS &&
      openingProgress < 0.94 &&
      !openedByUser;
    chapter.classList.toggle(
      "umbrella-chapter--control-visible",
      controlVisible,
    );
    chapter.classList.toggle(
      "umbrella-chapter--opened",
      openingProgress >= 0.999,
    );
    openControl.tabIndex = controlVisible ? 0 : -1;
    experienceChapter?.classList.toggle(
      "experience-chapter--umbrella-active",
      entranceProgress >= 0.98 || requestedProgress > 0,
    );
    timeline.time(effectiveTime, false);
    rainCanvas.setVisibility(
      Math.max(rainState.visibility, entranceProgress * 0.24),
    );
    const canopyIsMoving = effectiveTime >= 2.78 && effectiveTime <= 3.44;
    const crossedCanopyMotion =
      (previousEffectiveTime < 2.78 && effectiveTime > 3.44) ||
      (previousEffectiveTime > 3.44 && effectiveTime < 2.78);
    if (canopyIsMoving || crossedCanopyMotion || previousEffectiveTime < 0) {
      rainCanvas.invalidateGeometry();
    }
    previousEffectiveTime = effectiveTime;
  };

  const syncLiveInteraction = () => {
    if (entranceProgress > 0.02 || requestedProgress > 0) {
      applyInteractionMotion();
    }
    interactionFrame = requestAnimationFrame(syncLiveInteraction);
  };
  interactionFrame = requestAnimationFrame(syncLiveInteraction);

  return {
    setEntranceProgress: (progress) => {
      entranceProgress = clamp(progress);
      renderProgress();
    },
    setProgress: (progress) => {
      requestedProgress = textIntroProgress >= 1 ? clamp(progress) : 0;
      renderProgress();
    },
    setTextIntroProgress: (progress) => {
      textIntroProgress = clamp(progress);
      renderProgress();
    },
    destroy: () => {
      if (interactionFrame !== undefined) cancelAnimationFrame(interactionFrame);
      entranceProgress = 0;
      requestedProgress = 0;
      textIntroProgress = 0;
      previousEffectiveTime = -1;
      openedByUser = false;
      openControl.removeEventListener("click", openFromInteraction);
      openControl.setAttribute("aria-expanded", "false");
      openControl.tabIndex = -1;
      status.textContent = "";
      chapter.classList.remove(
        "umbrella-chapter--control-visible",
        "umbrella-chapter--opened",
        "umbrella-chapter--interaction-requested",
      );
      experienceChapter?.classList.toggle(
        "experience-chapter--umbrella-active",
        false,
      );
      timeline.kill();
      rainCanvas.destroy();
      gsap.killTweensOf([
        stage,
        closedUmbrella,
        openUmbrella,
        canopyRain,
        rainState,
        interactionState,
        rainCharacters,
        safeBlocks,
        shelteredChild,
        shelterGlow,
        exposure,
      ]);
    },
  };
};
