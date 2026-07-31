import { gsap } from "gsap";
import { createUmbrellaRainCanvas } from "./UmbrellaRainCanvas";

export interface UmbrellaChapterController {
  setProgress: (progress: number) => void;
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
      setProgress: () => undefined,
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
    .to(stage, { opacity: 1, duration: 0.28, ease: "power2.inOut" }, 0)
    .to(
      closedUmbrella,
      {
        opacity: 1,
        scale: 1,
        filter: "brightness(1.12) contrast(1.12)",
        duration: 0.34,
        ease: "power2.out",
      },
      0.16,
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
      0.36,
    )
    .to(exposure, { opacity: 0.92, duration: 0.025 }, 1.815)
    .to(exposure, { opacity: 0.08, duration: 0.09 }, 1.84)
    .to(exposure, { opacity: 0.62, duration: 0.025 }, 1.93)
    .to(exposure, { opacity: 0, duration: 0.15 }, 1.955)
    .to(
      closedUmbrella,
      {
        scale: 1.04,
        filter: "brightness(1.7) contrast(1.2)",
        duration: 0.04,
        ease: "power2.in",
      },
      1.8,
    )
    .set(closedUmbrella, { opacity: 0 }, 1.84)
    .set(openUmbrella, { opacity: 1 }, 1.84)
    .to(
      openUmbrella,
      {
        scale: 1,
        y: 0,
        clipPath: "circle(78% at 50% 37%)",
        filter: "brightness(1.1) contrast(1.1)",
        duration: 0.34,
        ease: "power3.out",
      },
      1.84,
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
      1.815,
    )
    .to(
      rainState,
      {
        visibility: 1,
        duration: 0.34,
        ease: "power2.out",
        onUpdate: () => rainCanvas.setVisibility(rainState.visibility),
      },
      2.08,
    )
    .to(shelterGlow, { opacity: 1, duration: 0.55, ease: "power2.out" }, 2.26)
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
      2.3,
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
      2.36,
    )
    .to({}, { duration: 0.72 });

  return {
    setProgress: (progress) => {
      timeline.progress(clamp(progress));
      rainCanvas.invalidateGeometry();
    },
    destroy: () => {
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
