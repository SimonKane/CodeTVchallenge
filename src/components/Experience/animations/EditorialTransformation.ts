import { gsap } from "gsap";
import { createLightningCanvas } from "./LightningCanvas";

const HIDDEN_MESSAGE = "silence";

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

interface MobileWashedGlyph {
  character: string;
  x: number;
  y: number;
  font: string;
  color: string;
  sourceIndex: number;
}

export interface EditorialTransformationController {
  setProgress: (progress: number) => void;
  destroy: () => void;
}

const normalize = (value: string) =>
  value.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLocaleLowerCase("sv");

const fract = (value: number) => value - Math.floor(value);
const clamp = (minimum: number, maximum: number, value: number) =>
  Math.min(maximum, Math.max(minimum, value));
const unit = (value: number) => clamp(0, 1, value);
const lerp = (from: number, to: number, progress: number) =>
  from + (to - from) * progress;

const hash = (value: number) =>
  fract(Math.sin(value) * 43758.5453123);

const measureWithoutInlineTransforms = (elements: HTMLElement[]) => {
  const transforms = elements.map((element) => element.style.transform);
  elements.forEach((element) => {
    element.style.transform = "none";
  });
  const bounds = elements.map((element) => element.getBoundingClientRect());
  elements.forEach((element, index) => {
    element.style.transform = transforms[index];
  });
  return bounds;
};

const createLeafFlight = (
  bounds: DOMRect,
  index: number,
  width: number,
  height: number,
  originLeft: number,
  originTop: number,
): LeafFlight => {
  const seed = hash((index + 1) * 91.713);
  const horizontalSeed = fract(index * 0.61803398875 + seed * 0.11);
  const verticalSeed = fract(index * 0.75487766625 + seed * 0.13);
  const targetX = width * (0.045 + horizontalSeed * 0.91);
  const targetY = height * (0.09 + verticalSeed * 0.82);
  const sourceX = bounds.left - originLeft + bounds.width / 2;
  const sourceY = bounds.top - originTop + bounds.height / 2;
  const x = targetX - sourceX;
  const y = targetY - sourceY;
  const direction = index % 2 === 0 ? -1 : 1;
  const curl = direction * width * (0.08 + seed * 0.1);
  const midTargetX = clamp(width * 0.035, width * 0.965, sourceX + x * 0.42 + curl);
  const midTargetY = clamp(
    height * 0.075,
    height * 0.925,
    sourceY + y * 0.28 - height * (0.045 + seed * 0.075),
  );

  return {
    x,
    y,
    rotation: direction * (115 + seed * 310),
    scale: 0.68 + seed * 0.58,
    midX: midTargetX - sourceX,
    midY: midTargetY - sourceY,
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
  const mobile = matchMedia("(max-width: 800px), (pointer: coarse)").matches;
  const mobileWashedCanvas = mobile ? document.createElement("canvas") : undefined;
  const mobileWashedContext = mobileWashedCanvas?.getContext("2d", {
    alpha: true,
  });
  let timeline: gsap.core.Timeline | undefined;
  let debugOverlay: HTMLElement | undefined;
  let preparationHandle: number | undefined;
  const flightOrigins: Array<{ x: number; y: number; scale: number }> = [];
  const leafFlights: LeafFlight[] = [];
  const mobileWashedGlyphs: MobileWashedGlyph[] = [];
  let mobileWashedActive = false;

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
  if (mobileWashedCanvas) {
    mobileWashedCanvas.className = "editorial-washed-canvas";
    mobileWashedCanvas.setAttribute("aria-hidden", "true");
    chapter.append(mobileWashedCanvas);
  }

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
    x: mobile ? "4vw" : "7vw",
    clipPath: mobile ? "none" : "inset(0% 100% 0% 0%)",
    filter: mobile
      ? "brightness(.86) saturate(.7) contrast(1.1)"
      : "brightness(.38) saturate(.55) contrast(1.18)",
  });
  gsap.set(finalMessage, { opacity: 0 });
  [currentImage, finalImage].forEach((container) => {
    const image = container.querySelector<HTMLImageElement>("img");
    if (image && !image.complete) void image.decode().catch(() => undefined);
  });

  const createTimeline = () => {
    if (timeline) return;
    const viewportWidth = chapter.clientWidth || window.innerWidth;
    const viewportHeight = chapter.clientHeight || window.innerHeight;
    const sourceBounds = measureWithoutInlineTransforms(sourceLetters);
    const chapterBounds = chapter.getBoundingClientRect();

    sourceLetters.forEach((_, index) => {
      leafFlights[index] = createLeafFlight(
        sourceBounds[index],
        index,
        viewportWidth,
        viewportHeight,
        chapterBounds.left,
        chapterBounds.top,
      );
    });

    if (mobileWashedCanvas && mobileWashedContext) {
      mobileWashedCanvas.width = Math.max(1, Math.round(viewportWidth));
      mobileWashedCanvas.height = Math.max(1, Math.round(viewportHeight));
      mobileWashedContext.textAlign = "center";
      mobileWashedContext.textBaseline = "alphabetic";
      mobileWashedGlyphs.length = 0;
      washedLetters.forEach((letter) => {
        const sourceIndex = sourceLetters.indexOf(letter);
        const bounds = sourceBounds[sourceIndex];
        const style = getComputedStyle(letter);
        mobileWashedGlyphs.push({
          character: letter.textContent ?? "",
          x: bounds.left - chapterBounds.left + bounds.width * 0.5,
          y: bounds.top - chapterBounds.top + bounds.height * 0.82,
          font: `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`,
          color: style.color,
          sourceIndex,
        });
      });
    }

    targetLetters.forEach((target, index) => {
      const selectedIndex = sourceLetters.indexOf(selectedLetters[index]);
      const selectedBounds = sourceBounds[selectedIndex];
      const targetBounds = target.getBoundingClientRect();
      const sourceSize = Number.parseFloat(
        getComputedStyle(selectedLetters[index]).fontSize,
      );
      const targetSize = Number.parseFloat(getComputedStyle(target).fontSize);
      const origin = {
        x:
          selectedBounds.left +
          selectedBounds.width / 2 -
          (targetBounds.left + targetBounds.width / 2),
        y:
          selectedBounds.top +
          selectedBounds.height / 2 -
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
        mobile ? selectedLetters : sourceLetters,
        {
          "--leaf-x": (index: number, target: HTMLElement) => {
            const sourceIndex = sourceLetters.indexOf(target);
            return `${leafFlights[sourceIndex].midX}px`;
          },
          "--leaf-y": (index: number, target: HTMLElement) => {
            const sourceIndex = sourceLetters.indexOf(target);
            return `${leafFlights[sourceIndex].midY}px`;
          },
          "--leaf-rotation": (index: number, target: HTMLElement) => {
            const sourceIndex = sourceLetters.indexOf(target);
            return `${leafFlights[sourceIndex].midRotation}deg`;
          },
          "--leaf-scale": (index: number, target: HTMLElement) => {
            const sourceIndex = sourceLetters.indexOf(target);
            return leafFlights[sourceIndex].scale * 0.9;
          },
          duration: 0.42,
          stagger: { each: 0.0012, from: "random" },
          ease: "power2.out",
        },
        0.28,
      )
      .to(
        mobile ? selectedLetters : sourceLetters,
        {
          "--leaf-x": (index: number, target: HTMLElement) => {
            const sourceIndex = sourceLetters.indexOf(target);
            return `${leafFlights[sourceIndex].x}px`;
          },
          "--leaf-y": (index: number, target: HTMLElement) => {
            const sourceIndex = sourceLetters.indexOf(target);
            return `${leafFlights[sourceIndex].y}px`;
          },
          "--leaf-rotation": (index: number, target: HTMLElement) => {
            const sourceIndex = sourceLetters.indexOf(target);
            return `${leafFlights[sourceIndex].rotation}deg`;
          },
          "--leaf-scale": (index: number, target: HTMLElement) => {
            const sourceIndex = sourceLetters.indexOf(target);
            return leafFlights[sourceIndex].scale;
          },
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
        mobile ? [] : washedLetters,
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
          "--wash-blur": mobile ? "0px" : "1.5px",
          "--wash-trail": mobile ? "0em" : "5.2em",
          "--wash-trail-opacity": mobile ? 0 : 0.82,
          "--wash-drop-opacity": mobile ? 0 : 0.94,
          "--wash-shadow": mobile
            ? "rgba(190,218,229,0)"
            : "rgba(190,218,229,.3)",
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
          clipPath: mobile ? "none" : "inset(0% 0% 0% 0%)",
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

  const renderMobileWashedLetters = (progress: number) => {
    if (!mobileWashedCanvas || !mobileWashedContext || !timeline) return;
    const time = progress * timeline.duration();
    const active = time >= 0.28 && time < 1.8;
    if (active !== mobileWashedActive) {
      mobileWashedActive = active;
      washedLetters.forEach((letter) => {
        letter.style.visibility = active || time >= 1.8 ? "hidden" : "";
      });
      mobileWashedCanvas.style.opacity = active ? "1" : "0";
    }
    mobileWashedContext.clearRect(
      0,
      0,
      mobileWashedCanvas.width,
      mobileWashedCanvas.height,
    );
    if (!active) return;

    const firstFlight = 1 - Math.pow(1 - unit((time - 0.28) / 0.42), 2);
    const secondFlight = unit((time - 0.66) / 0.46);
    const secondEase = 0.5 - Math.cos(secondFlight * Math.PI) * 0.5;
    const rain = Math.pow(unit((time - 1.28) / 0.5), 2);
    let currentFont = "";

    mobileWashedGlyphs.forEach((glyph) => {
      const seed = hash((glyph.sourceIndex + 1) * 91.713);
      const targetX =
        mobileWashedCanvas.width *
        (0.045 + fract(glyph.sourceIndex * 0.61803398875 + seed * 0.11) * 0.91);
      const targetY =
        mobileWashedCanvas.height *
        (0.09 + fract(glyph.sourceIndex * 0.75487766625 + seed * 0.13) * 0.82);
      const direction = glyph.sourceIndex % 2 === 0 ? -1 : 1;
      const midTargetX = clamp(
        mobileWashedCanvas.width * 0.035,
        mobileWashedCanvas.width * 0.965,
        lerp(glyph.x, targetX, 0.42) + direction * mobileWashedCanvas.width * 0.1,
      );
      const midTargetY = clamp(
        mobileWashedCanvas.height * 0.075,
        mobileWashedCanvas.height * 0.925,
        lerp(glyph.y, targetY, 0.28) - mobileWashedCanvas.height * 0.07,
      );
      const x = lerp(lerp(glyph.x, midTargetX, firstFlight), targetX, secondEase);
      const y = lerp(lerp(glyph.y, midTargetY, firstFlight), targetY, secondEase);
      const drift =
        ((glyph.sourceIndex % 7) - 3) * 18 +
        (glyph.sourceIndex % 2 === 0 ? -1 : 1) * mobileWashedCanvas.width * 0.025;
      const drawX = lerp(x, targetX + drift, rain);
      const drawY = lerp(y, targetY + mobileWashedCanvas.height * 1.12, rain);
      if (
        ![drawX, drawY].every(Number.isFinite)
      ) {
        return;
      }

      if (currentFont !== glyph.font) {
        currentFont = glyph.font;
        mobileWashedContext.font = currentFont;
      }
      mobileWashedContext.fillStyle = glyph.color;
      mobileWashedContext.globalAlpha = 1 - rain;
      mobileWashedContext.fillText(
        glyph.character,
        drawX,
        drawY,
      );
    });
    mobileWashedContext.globalAlpha = 1;
  };

  const prepareTimeline = () => {
    preparationHandle = undefined;
    createTimeline();
  };
  void document.fonts.ready.then(() => {
    if (timeline || preparationHandle !== undefined) return;
    if ("requestIdleCallback" in window) {
      preparationHandle = window.requestIdleCallback(prepareTimeline, {
        timeout: 900,
      });
    } else {
      preparationHandle = requestAnimationFrame(prepareTimeline);
    }
  });

  return {
    setProgress: (progress) => {
      const value = Math.min(1, Math.max(0, progress));
      if (!timeline) createTimeline();
      timeline?.progress(value);
      renderMobileWashedLetters(value);
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
      if (preparationHandle !== undefined) {
        if ("cancelIdleCallback" in window) {
          window.cancelIdleCallback(preparationHandle);
        } else {
          cancelAnimationFrame(preparationHandle);
        }
      }
      timeline?.kill();
      mobileWashedCanvas?.remove();
      lightningCanvas.destroy();
      debugOverlay?.remove();
      selectedLetters.forEach((letter) =>
        letter.classList.remove("editorial-source-letter--selected"),
      );
      washedLetters.forEach((letter) => {
        letter.style.visibility = "";
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
