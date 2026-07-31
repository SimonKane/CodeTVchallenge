import { gsap } from "gsap";
import { createUmbrellaRainCanvas } from "./UmbrellaRainCanvas";

export interface UmbrellaChapterController {
  setEntranceProgress: (progress: number) => void;
  setProgress: (progress: number) => void;
  setTextIntroProgress: (progress: number) => void;
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
const TEXT_READY_TIME = 1.9;

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
      word.className = "umbrella-rain-word";
      [...part].forEach((character) => {
        const letter = document.createElement("span");
        letter.className = "umbrella-rain-character";
        letter.textContent = character;
        word.append(letter);
      });
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
): UmbrellaChapterController => {
  const experienceChapter = chapter.closest<HTMLElement>(
    "[data-experience-chapter]",
  );
  const stage = chapter.querySelector<HTMLElement>("[data-umbrella-stage]");
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

  if (
    !stage ||
    !closedUmbrella ||
    !openUmbrella ||
    !canopyRain ||
    !problem ||
    !safeCopy ||
    !shelteredChild ||
    !shelterGlow ||
    !exposure
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
  const safeBlocks = [
    ...safeCopy.querySelectorAll<HTMLElement>("h2, p"),
  ];
  const pushVectors = createPushVectors(rainCharacters, stage);
  const rainCanvas = createUmbrellaRainCanvas(canopyRain, openUmbrella);
  const rainState = { visibility: 0 };
  let entranceProgress = 0;
  let requestedProgress = 0;
  let textIntroProgress = 0;

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
    x: (index: number) => `${(hash(index * 3.71) - 0.5) * 34}px`,
    y: (index: number) => `${-70 - hash(index * 7.13 + 2.4) * 150}px`,
    rotation: (index: number) => (hash(index * 5.29) - 0.5) * 22,
    scaleX: 0.22,
    scaleY: 1.85,
    filter: "blur(1.8px)",
    "--umbrella-rain-trail": 0.78,
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
        filter: "blur(0px)",
        "--umbrella-rain-trail": 0,
        duration: 0.42,
        stagger: { amount: 0.72, from: "random" },
        ease: "power3.out",
      },
      0.68,
    )
    .to(exposure, { opacity: 0.82, duration: 0.035 }, 2.14)
    .to(exposure, { opacity: 0.08, duration: 0.1 }, 2.175)
    .to(exposure, { opacity: 0.52, duration: 0.025 }, 2.275)
    .to(exposure, { opacity: 0, duration: 0.17 }, 2.3)
    .to(
      closedUmbrella,
      {
        scale: 1.025,
        filter: "brightness(1.7) contrast(1.2)",
        duration: 0.06,
        ease: "power2.in",
      },
      2.1,
    )
    .to(closedUmbrella, { opacity: 0, duration: 0.08 }, 2.16)
    .set(openUmbrella, { opacity: 1 }, 2.18)
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
      2.18,
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
      2.52,
    )
    .to(
      rainCharacters,
      {
        x: (index: number) => pushVectors[index].x,
        y: (index: number) => pushVectors[index].y,
        rotation: (index: number) => pushVectors[index].rotation,
        scale: 0.55,
        opacity: 0,
        filter: "blur(1.8px)",
        duration: 0.54,
        stagger: { amount: 0.12, from: "center" },
        ease: "power3.out",
      },
      2.14,
    )
    .to(
      rainState,
      {
        visibility: 1,
        duration: 0.34,
        ease: "power2.out",
        onUpdate: () => rainCanvas.setVisibility(rainState.visibility),
      },
      2.42,
    )
    .to(shelterGlow, { opacity: 1, duration: 0.55, ease: "power2.out" }, 2.6)
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
      2.64,
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
      2.7,
    )
    .to({}, { duration: 0.72 });

  const renderProgress = () => {
    const timelineDuration = timeline.duration();
    const effectiveTime =
      requestedProgress > 0 || textIntroProgress >= 1
        ? TEXT_READY_TIME +
          requestedProgress * (timelineDuration - TEXT_READY_TIME)
        : textIntroProgress > 0
          ? BACKGROUND_READY_TIME +
            textIntroProgress * (TEXT_READY_TIME - BACKGROUND_READY_TIME)
          : entranceProgress * BACKGROUND_READY_TIME;
    experienceChapter?.classList.toggle(
      "experience-chapter--umbrella-active",
      entranceProgress >= 0.98 || textIntroProgress > 0 || requestedProgress > 0,
    );
    timeline.time(effectiveTime, false);
    rainCanvas.invalidateGeometry();
  };

  return {
    setEntranceProgress: (progress) => {
      entranceProgress = clamp(progress);
      renderProgress();
    },
    setProgress: (progress) => {
      requestedProgress = clamp(progress);
      renderProgress();
    },
    setTextIntroProgress: (progress) => {
      textIntroProgress = clamp(progress);
      renderProgress();
    },
    destroy: () => {
      entranceProgress = 0;
      requestedProgress = 0;
      textIntroProgress = 0;
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
        rainCharacters,
        safeBlocks,
        shelteredChild,
        shelterGlow,
        exposure,
      ]);
    },
  };
};
