import { gsap } from "gsap";
import { createLightningCanvas } from "./LightningCanvas";

const HIDDEN_MESSAGE = "tystnad";

const EDITORIAL_DEBUG = {
  enabled: false,
  hiddenMessage: HIDDEN_MESSAGE,
  selectedSourceLetterIndices: [] as number[],
  rainAwayProgress: 0,
  lightningProgress: 0,
  imageSwapProgress: 0,
  finalImagePosition: "right 1vw / 44vw",
  finalMessagePosition: "left clamp(2rem, 7vw, 8rem) / 46vw",
};

interface EditorialTransformationElements {
  chapter: HTMLElement;
  copy: HTMLElement;
  currentImage: HTMLElement;
}

interface LeafFlight {
  x: number;
  y: number;
  rotation: number;
  scale: number;
  midX: number;
  midY: number;
  midRotation: number;
}

export interface EditorialTransformationController {
  setProgress: (progress: number) => void;
  destroy: () => void;
}

const normalize = (value: string) =>
  value.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLocaleLowerCase("sv");

const fract = (value: number) => value - Math.floor(value);

const hash = (value: number) =>
  fract(Math.sin(value) * 43758.5453123);

const measureWithoutInlineTransform = (element: HTMLElement) => {
  const transform = element.style.transform;
  element.style.transform = "none";
  const bounds = element.getBoundingClientRect();
  element.style.transform = transform;
  return bounds;
};

const createLeafFlight = (
  letter: HTMLElement,
  index: number,
  width: number,
  height: number,
): LeafFlight => {
  const bounds = measureWithoutInlineTransform(letter);
  const seed = hash((index + 1) * 91.713);
  const horizontalSeed = hash((index + 1) * 12.9898 + 4.1414);
  const verticalSeed = hash((index + 1) * 78.233 + 17.1717);
  const targetX = width * (0.035 + horizontalSeed * 0.93);
  const targetY = height * (0.055 + verticalSeed * 0.86);
  const x = targetX - (bounds.left + bounds.width / 2);
  const y = targetY - (bounds.top + bounds.height / 2);
  const direction = index % 2 === 0 ? -1 : 1;
  const curl = direction * width * (0.08 + seed * 0.1);

  return {
    x,
    y,
    rotation: direction * (115 + seed * 310),
    scale: 0.68 + seed * 0.58,
    midX: x * 0.42 + curl,
    midY: y * 0.28 - height * (0.08 + seed * 0.13),
    midRotation: direction * (55 + seed * 145),
  };
};

const selectSourceLetters = (
  letters: HTMLElement[],
  message: string,
): HTMLElement[] => {
  const selected: HTMLElement[] = [];
  let cursor = 0;
  [...message].forEach((character) => {
    const wanted = normalize(character);
    const match = letters.findIndex(
      (letter, index) =>
        index >= cursor && normalize(letter.textContent ?? "") === wanted,
    );
    if (match < 0) return;
    selected.push(letters[match]);
    EDITORIAL_DEBUG.selectedSourceLetterIndices.push(match);
    cursor = match + 1;
  });
  return selected;
};

export const createEditorialTransformation = ({
  chapter,
  copy,
  currentImage,
}: EditorialTransformationElements): EditorialTransformationController => {
  const finalMessage = chapter.querySelector<HTMLElement>(
    "[data-editorial-hidden-message]",
  );
  const finalImage = chapter.querySelector<HTMLElement>(
    "[data-editorial-final-image]",
  );
  const targetLetters = [
    ...chapter.querySelectorAll<HTMLElement>("[data-editorial-target-letter]"),
  ];
  const lightning = chapter.querySelector<HTMLCanvasElement>(
    "[data-editorial-lightning]",
  );
  const exposure = chapter.querySelector<HTMLElement>(
    "[data-editorial-lightning-exposure]",
  );
  const sourceLetters = [
    ...copy.querySelectorAll<HTMLElement>(".rain-letter:not(.rain-letter--space)"),
  ];
  const selectedLetters = selectSourceLetters(sourceLetters, HIDDEN_MESSAGE);
  const selectedSet = new Set(selectedLetters);
  const washedLetters = sourceLetters.filter((letter) => !selectedSet.has(letter));
  let timeline: gsap.core.Timeline | undefined;
  let debugOverlay: HTMLElement | undefined;
  const flightOrigins: Array<{ x: number; y: number; scale: number }> = [];
  const leafFlights: LeafFlight[] = [];

  if (
    !finalMessage ||
    !finalImage ||
    targetLetters.length !== [...HIDDEN_MESSAGE].length ||
    !lightning ||
    !exposure ||
    selectedLetters.length !== [...HIDDEN_MESSAGE].length
  ) {
    return { setProgress: () => undefined, destroy: () => undefined };
  }
  const lightningCanvas = createLightningCanvas(lightning);
  const lightningState = { progress: 0 };

  selectedLetters.forEach((letter) =>
    letter.classList.add("editorial-source-letter--selected"),
  );
  washedLetters.forEach((letter, index) => {
    letter.classList.add("editorial-source-letter--washed");
  });
  sourceLetters.forEach((letter) =>
    letter.classList.add("editorial-source-letter"),
  );

  gsap.set(sourceLetters, {
    "--leaf-x": "0px",
    "--leaf-y": "0px",
    "--leaf-rotation": "0deg",
    "--leaf-scale": 1,
    "--leaf-scale-x": 1,
    "--leaf-scale-y": 1,
  });
  gsap.set(washedLetters, {
    "--wash-opacity": 1,
    "--wash-blur": "0px",
    "--wash-trail": "0em",
    "--wash-trail-opacity": 0,
    "--wash-drop-opacity": 0,
  });
  gsap.set(selectedLetters, { "--selected-opacity": 1 });
  gsap.set(lightning, { opacity: 0 });
  gsap.set(finalImage, {
    opacity: 0,
    x: "7vw",
    clipPath: "inset(0% 100% 0% 0%)",
    filter: "brightness(.38) saturate(.55) contrast(1.18)",
  });
  gsap.set(finalMessage, { opacity: 0 });

  const createTimeline = () => {
    const viewportWidth = chapter.clientWidth || window.innerWidth;
    const viewportHeight = chapter.clientHeight || window.innerHeight;

    sourceLetters.forEach((letter, index) => {
      leafFlights[index] = createLeafFlight(
        letter,
        index,
        viewportWidth,
        viewportHeight,
      );
    });

    targetLetters.forEach((target, index) => {
      const sourceBounds = measureWithoutInlineTransform(selectedLetters[index]);
      const targetBounds = target.getBoundingClientRect();
      const sourceSize = Number.parseFloat(
        getComputedStyle(selectedLetters[index]).fontSize,
      );
      const targetSize = Number.parseFloat(getComputedStyle(target).fontSize);
      const origin = {
        x:
          sourceBounds.left +
          sourceBounds.width / 2 -
          (targetBounds.left + targetBounds.width / 2),
        y:
          sourceBounds.top +
          sourceBounds.height / 2 -
          (targetBounds.top + targetBounds.height / 2),
        scale: Math.max(0.18, sourceSize / targetSize),
      };
      flightOrigins[index] = origin;
      gsap.set(target, {
        x: origin.x,
        y: origin.y,
        scale: origin.scale,
        rotation: 0,
        transformOrigin: "50% 50%",
        opacity: 0,
      });
    });

    chapter.classList.add("experience-chapter--editorial-ready");
    timeline = gsap.timeline({ paused: true });
    timeline
      .to(
        selectedLetters,
        {
          color: "#8f151a",
          "--selected-shadow":
            "0 0 0.08em rgba(194,40,47,.62), 0 0 .42em rgba(53,6,9,.52)",
          duration: 0.24,
          stagger: 0.008,
          ease: "power2.inOut",
        },
        0.12,
      )
      .to(
        sourceLetters,
        {
          "--leaf-x": (index: number) => `${leafFlights[index].midX}px`,
          "--leaf-y": (index: number) => `${leafFlights[index].midY}px`,
          "--leaf-rotation": (index: number) =>
            `${leafFlights[index].midRotation}deg`,
          "--leaf-scale": (index: number) => leafFlights[index].scale * 0.9,
          duration: 0.42,
          stagger: { each: 0.0012, from: "random" },
          ease: "power2.out",
        },
        0.28,
      )
      .to(
        sourceLetters,
        {
          "--leaf-x": (index: number) => `${leafFlights[index].x}px`,
          "--leaf-y": (index: number) => `${leafFlights[index].y}px`,
          "--leaf-rotation": (index: number) =>
            `${leafFlights[index].rotation}deg`,
          "--leaf-scale": (index: number) => leafFlights[index].scale,
          duration: 0.46,
          stagger: { each: 0.0015, from: "random" },
          ease: "sine.inOut",
        },
        0.66,
      )
      .to(
        selectedLetters,
        {
          color: "#e32636",
          "--selected-shadow":
            "0 0 .1em rgba(255,115,123,.98), 0 0 .5em rgba(239,35,51,.98), 0 0 1.25em rgba(175,8,24,.9)",
          duration: 0.2,
          stagger: 0.012,
          ease: "power2.inOut",
        },
        1.05,
      )
      .to(
        washedLetters,
        {
          "--leaf-x": (index: number, target: HTMLElement) => {
            const sourceIndex = sourceLetters.indexOf(target);
            const flight = leafFlights[sourceIndex];
            const drift =
              ((sourceIndex % 7) - 3) * 18 +
              (sourceIndex % 2 === 0 ? -1 : 1) * viewportWidth * 0.025;
            return `${flight.x + drift}px`;
          },
          "--leaf-y": (index: number, target: HTMLElement) => {
            const sourceIndex = sourceLetters.indexOf(target);
            return `${leafFlights[sourceIndex].y + viewportHeight * 1.12}px`;
          },
          "--leaf-rotation": (index: number, target: HTMLElement) => {
            const sourceIndex = sourceLetters.indexOf(target);
            const direction = sourceIndex % 2 === 0 ? -1 : 1;
            return `${leafFlights[sourceIndex].rotation + direction * (150 + (sourceIndex % 5) * 38)}deg`;
          },
          "--leaf-scale-x": 0.16,
          "--leaf-scale-y": 2.25,
          "--wash-opacity": 0,
          "--wash-blur": "1.5px",
          "--wash-trail": "5.2em",
          "--wash-trail-opacity": 0.82,
          "--wash-drop-opacity": 0.94,
          "--wash-shadow": "rgba(190,218,229,.3)",
          duration: 0.5,
          stagger: { each: 0.0011, from: "random" },
          ease: "power2.in",
        },
        1.28,
      )
      .to(lightning, { opacity: 1, duration: 0.016 }, 2.82)
      .to(
        lightningState,
        {
          progress: 1,
          duration: 0.32,
          ease: "none",
          onUpdate: () => lightningCanvas.setProgress(lightningState.progress),
        },
        2.82,
      )
      .to(exposure, { opacity: 0.86, duration: 0.018 }, 2.845)
      .to(exposure, { opacity: 0.14, duration: 0.1 }, 2.863)
      .to(exposure, { opacity: 0.62, duration: 0.018 }, 2.963)
      .to(exposure, { opacity: 0, duration: 0.14 }, 2.981)
      .to(
        finalImage,
        {
          opacity: 1,
          clipPath: "inset(0% 0% 0% 0%)",
          duration: 0.25,
          ease: "power2.inOut",
        },
        2.84,
      )
      .to(
        currentImage,
        {
          opacity: 0,
          x: "-8vw",
          duration: 0.22,
          ease: "power2.inOut",
        },
        2.88,
      )
      .to(copy, { opacity: 0, duration: 0.18, ease: "power2.out" }, 2.88)
      .to(lightning, { opacity: 0, duration: 0.14, ease: "power2.out" }, 3.04)
      .to(
        finalImage,
        {
          x: 0,
          filter: "brightness(.86) saturate(.7) contrast(1.1)",
          duration: 0.22,
          ease: "power3.out",
        },
        2.9,
      )
      .fromTo(
        finalMessage.querySelector("p"),
        { opacity: 0, y: 14 },
        { opacity: 1, y: 0, duration: 0.12, ease: "power2.out" },
        3.12,
      );

    targetLetters.forEach((target, index) => {
      const origin = flightOrigins[index];
      const sourceIndex = sourceLetters.indexOf(selectedLetters[index]);
      const flight = leafFlights[sourceIndex];

      timeline?.set(
        target,
        {
          x: origin.x + flight.x,
          y: origin.y + flight.y,
          scale: origin.scale * flight.scale,
          rotation: flight.rotation,
          opacity: 1,
        },
        1.91,
      );
      timeline?.set(
        selectedLetters[index],
        { "--selected-opacity": 0 },
        1.91,
      );
      timeline?.to(
        target,
        {
          keyframes: [
            {
              x: origin.x + flight.x * 0.7,
              y: origin.y + flight.y * 0.72 - viewportHeight * 0.035,
              scale: Math.max(0.5, origin.scale * 1.08),
              rotation: flight.rotation * 0.56,
              duration: 0.22,
              ease: "sine.inOut",
            },
            {
              x: origin.x * 0.22,
              y: origin.y * 0.2,
              scale: 0.92,
              rotation: flight.rotation * 0.08,
              duration: 0.26,
              ease: "power2.inOut",
            },
            {
              x: 0,
              y: 0,
              scale: 1,
              rotation: 0,
              duration: 0.18,
              ease: "power3.out",
            },
          ],
        },
        1.96 + index * 0.008,
      );
    });
    timeline.set(finalMessage, { opacity: 1 }, 1.91);

    if (EDITORIAL_DEBUG.enabled) {
      debugOverlay = document.createElement("pre");
      debugOverlay.className = "editorial-debug";
      chapter.append(debugOverlay);
    }
  };

  return {
    setProgress: (progress) => {
      const value = Math.min(1, Math.max(0, progress));
      if (!timeline) createTimeline();
      timeline?.progress(value);
      EDITORIAL_DEBUG.rainAwayProgress = Math.max(
        0,
        Math.min(1, (value - 0.39) / 0.3),
      );
      EDITORIAL_DEBUG.lightningProgress = Math.max(
        0,
        Math.min(1, (value - 0.85) / 0.12),
      );
      EDITORIAL_DEBUG.imageSwapProgress = Math.max(
        0,
        Math.min(1, (value - 0.86) / 0.13),
      );
      if (debugOverlay) {
        debugOverlay.textContent = [
          `message ${EDITORIAL_DEBUG.hiddenMessage}`,
          `indices ${EDITORIAL_DEBUG.selectedSourceLetterIndices.join(",")}`,
          `rain ${EDITORIAL_DEBUG.rainAwayProgress.toFixed(2)}`,
          `lightning ${EDITORIAL_DEBUG.lightningProgress.toFixed(2)}`,
          `image ${EDITORIAL_DEBUG.imageSwapProgress.toFixed(2)}`,
          `final image ${EDITORIAL_DEBUG.finalImagePosition}`,
          `final message ${EDITORIAL_DEBUG.finalMessagePosition}`,
        ].join("\n");
      }
    },
    destroy: () => {
      timeline?.kill();
      lightningCanvas.destroy();
      debugOverlay?.remove();
      selectedLetters.forEach((letter) =>
        letter.classList.remove("editorial-source-letter--selected"),
      );
      washedLetters.forEach((letter) => {
        letter.classList.remove("editorial-source-letter--washed");
      });
      sourceLetters.forEach((letter) =>
        letter.classList.remove("editorial-source-letter"),
      );
      chapter.classList.remove("experience-chapter--editorial-ready");
      gsap.killTweensOf([
        selectedLetters,
        washedLetters,
        targetLetters,
        finalMessage,
        finalImage,
        currentImage,
        copy,
        lightning,
        lightningState,
        exposure,
      ]);
    },
  };
};
