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

export interface EditorialTransformationController {
  setProgress: (progress: number) => void;
  destroy: () => void;
}

const normalize = (value: string) =>
  value.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLocaleLowerCase("sv");

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
    letter.style.setProperty("--wash-drift", `${((index % 5) - 2) * 1.5}px`);
  });

  gsap.set(lightning, { opacity: 0 });
  gsap.set(finalImage, {
    opacity: 0,
    x: "7vw",
    clipPath: "inset(0% 100% 0% 0%)",
    filter: "brightness(.38) saturate(.55) contrast(1.18)",
  });
  gsap.set(finalMessage, { opacity: 0 });

  const createTimeline = () => {
    targetLetters.forEach((target, index) => {
      const sourceBounds = selectedLetters[index].getBoundingClientRect();
      const targetBounds = target.getBoundingClientRect();
      const sourceSize = Number.parseFloat(
        getComputedStyle(selectedLetters[index]).fontSize,
      );
      const targetSize = Number.parseFloat(getComputedStyle(target).fontSize);
      const origin = {
        x: sourceBounds.left - targetBounds.left,
        y: sourceBounds.top - targetBounds.top,
        scale: Math.max(0.18, sourceSize / targetSize),
      };
      flightOrigins[index] = origin;
      gsap.set(target, {
        x: origin.x,
        y: origin.y,
        scale: origin.scale,
        rotation: 0,
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
            "0 0 0.08em rgba(194,40,47,.55), 0 0 .42em rgba(53,6,9,.48)",
          duration: 0.2,
          stagger: 0.008,
          ease: "power2.inOut",
        },
        0.15,
      )
      .to(
        washedLetters,
        {
          "--wash-progress": 1,
          "--wash-opacity": 0,
          "--wash-x": (index: number, target: HTMLElement) =>
            target.style.getPropertyValue("--wash-drift"),
          "--wash-y": (index: number) => `${96 + (index % 13) * 9}px`,
          "--wash-scale-x": 0.12,
          "--wash-scale-y": 2.35,
          "--wash-blur": "1.4px",
          "--wash-trail": "4.6em",
          "--wash-trail-opacity": 0.82,
          "--wash-drop-opacity": 0.94,
          "--wash-shadow": "rgba(190,218,229,.3)",
          duration: 0.2,
          stagger: { each: 0.0009, from: "random" },
          ease: "power2.inOut",
        },
        0.39,
      )
      .set(finalMessage, { opacity: 1 }, 0.76)
      .to(targetLetters, { opacity: 1, duration: 0.04, ease: "sine.inOut" }, 0.76)
      .to(
        selectedLetters,
        { "--selected-opacity": 0, duration: 0.04, ease: "sine.inOut" },
        0.76,
      )
      .to(lightning, { opacity: 1, duration: 0.012 }, 1.66)
      .to(
        lightningState,
        {
          progress: 1,
          duration: 0.24,
          ease: "none",
          onUpdate: () => lightningCanvas.setProgress(lightningState.progress),
        },
        1.66,
      )
      .to(exposure, { opacity: 0.86, duration: 0.014 }, 1.685)
      .to(exposure, { opacity: 0.14, duration: 0.075 }, 1.699)
      .to(exposure, { opacity: 0.62, duration: 0.014 }, 1.774)
      .to(exposure, { opacity: 0, duration: 0.11 }, 1.788)
      .to(
        finalImage,
        {
          opacity: 1,
          clipPath: "inset(0% 0% 0% 0%)",
          duration: 0.19,
          ease: "power2.inOut",
        },
        1.68,
      )
      .to(
        currentImage,
        {
          opacity: 0,
          x: "-8vw",
          duration: 0.15,
          ease: "power2.inOut",
        },
        1.71,
      )
      .to(copy, { opacity: 0, duration: 0.12, ease: "power2.out" }, 1.71)
      .to(lightning, { opacity: 0, duration: 0.1, ease: "power2.out" }, 1.84)
      .to(
        finalImage,
        {
          x: 0,
          filter: "brightness(.86) saturate(.7) contrast(1.1)",
          duration: 0.15,
          ease: "power3.out",
        },
        1.73,
      )
      .fromTo(
        finalMessage.querySelector("p"),
        { opacity: 0, y: 14 },
        { opacity: 1, y: 0, duration: 0.07, ease: "power2.out" },
        1.88,
      );

    targetLetters.forEach((target, index) => {
      const origin = flightOrigins[index];
      const direction = index % 2 === 0 ? -1 : 1;
      const spread = direction * (105 + (index % 3) * 58);
      const lift = 85 + (index % 4) * 38;
      const spin =
        index % 3 === 0 ? direction * (45 + index * 7) : direction * 16;
      timeline?.to(
        target,
        {
          keyframes: [
            {
              x: origin.x + spread * 0.72,
              y: origin.y - lift * 0.62,
              scale: origin.scale * 0.9,
              rotation: spin * 0.72,
              duration: 0.12,
              ease: "power2.out",
            },
            {
              x: origin.x * 0.78 + spread * 1.12,
              y: origin.y * 0.74 - lift * 1.08,
              scale: 0.76,
              rotation: spin,
              duration: 0.12,
              ease: "sine.inOut",
            },
            {
              x: origin.x * 0.48 - spread * 0.34,
              y: origin.y * 0.46 + direction * lift * 0.24,
              scale: 0.82,
              rotation: -spin * 0.46,
              duration: 0.15,
              ease: "sine.inOut",
            },
            {
              x: origin.x * 0.14 + spread * 0.1,
              y: origin.y * 0.13 - lift * 0.07,
              scale: 0.95,
              rotation: spin * 0.08,
              duration: 0.14,
              ease: "power2.inOut",
            },
            {
              x: 0,
              y: 0,
              scale: 1,
              rotation: 0,
              duration: 0.12,
              ease: "power3.inOut",
            },
          ],
        },
        0.8 + index * 0.002,
      );
    });

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
        letter.style.removeProperty("--wash-drift");
      });
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
