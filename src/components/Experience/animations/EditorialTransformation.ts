import { gsap } from "gsap";
import { createLightningCanvas } from "./LightningCanvas";

const HIDDEN_MESSAGE = "silence";
const LIGHTNING_START_TIME = 2.82;
const LIGHTNING_SCROLL_STRETCH = 2.25;
const HIGHLIGHT_READY_TIME = 0.44;
const FIRST_FLIGHT_TIME = 0.46;
const SECOND_FLIGHT_TIME = 0.84;
const BRIGHT_HIGHLIGHT_TIME = 1.23;
const RAIN_AWAY_TIME = 1.46;
const MESSAGE_ASSEMBLY_TIME = 2.09;
const stretchLightningTime = (time: number) =>
  LIGHTNING_START_TIME +
  (time - LIGHTNING_START_TIME) * LIGHTNING_SCROLL_STRETCH;
const stretchLightningDuration = (duration: number) =>
  duration * LIGHTNING_SCROLL_STRETCH;

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

interface WashedGlyph {
  character: string;
  x: number;
  y: number;
  centerY: number;
  baselineOffset: number;
  targetX: number;
  targetY: number;
  midTargetX: number;
  midTargetY: number;
  rainTargetX: number;
  rainTargetY: number;
  midRotation: number;
  rotation: number;
  rainRotation: number;
  scale: number;
  fontSize: number;
  font: string;
  color: string;
  spriteKey: string;
  trailKey: number;
}

interface GlyphSprite {
  normal: CanvasImageSource;
  washed: CanvasImageSource;
  width: number;
  height: number;
  originX: number;
  baseline: number;
}

interface TrailSprite {
  trail: CanvasImageSource;
  drop: CanvasImageSource;
  trailWidth: number;
  trailHeight: number;
  dropWidth: number;
  dropHeight: number;
}

export interface EditorialTransformationController {
  getLightningTriggerProgress: () => number;
  setHighlightProgress: (progress: number) => void;
  setLightningSequenceProgress: (progress: number) => void;
  setProgress: (progress: number, lightningComplete?: boolean) => void;
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
  const washedCanvas = document.createElement("canvas");
  const washedContext = washedCanvas.getContext("2d", {
    alpha: true,
  });
  let timeline: gsap.core.Timeline | undefined;
  let debugOverlay: HTMLElement | undefined;
  let preparationHandle: number | undefined;
  const flightOrigins: Array<{ x: number; y: number; scale: number }> = [];
  const leafFlights: LeafFlight[] = [];
  const washedGlyphs: WashedGlyph[] = [];
  const glyphSprites = new Map<string, GlyphSprite>();
  const trailSprites = new Map<number, TrailSprite>();
  let washedActive = false;
  let washedWidth = 1;
  let washedHeight = 1;
  let washedPixelRatio = 1;
  let lastRenderedTime = -1;

  const createSpriteSurface = (width: number, height: number) => {
    const pixelWidth = Math.max(1, Math.ceil(width * washedPixelRatio));
    const pixelHeight = Math.max(1, Math.ceil(height * washedPixelRatio));
    const canvas: HTMLCanvasElement | OffscreenCanvas =
      typeof OffscreenCanvas === "undefined"
        ? document.createElement("canvas")
        : new OffscreenCanvas(pixelWidth, pixelHeight);
    canvas.width = pixelWidth;
    canvas.height = pixelHeight;
    const context = canvas.getContext("2d", { alpha: true }) as
      | CanvasRenderingContext2D
      | OffscreenCanvasRenderingContext2D
      | null;
    context?.setTransform(washedPixelRatio, 0, 0, washedPixelRatio, 0, 0);
    return { canvas, context };
  };

  const prepareGlyphSprite = (glyph: WashedGlyph) => {
    if (glyphSprites.has(glyph.spriteKey) || !washedContext) return;
    washedContext.font = glyph.font;
    const metrics = washedContext.measureText(glyph.character);
    const visibleWidth = Math.max(
      metrics.width,
      metrics.actualBoundingBoxLeft + metrics.actualBoundingBoxRight,
    );
    const padding = glyph.fontSize * 1.25 + 4;
    const width = Math.ceil(visibleWidth + padding * 2);
    const height = Math.ceil(glyph.fontSize * 3.2 + padding * 2);
    const originX = width * 0.5;
    const baseline = padding + glyph.fontSize * 1.35;
    const normal = createSpriteSurface(width, height);
    const washed = createSpriteSurface(width, height);

    [normal, washed].forEach(({ context }) => {
      if (!context) return;
      context.font = glyph.font;
      context.textAlign = "center";
      context.textBaseline = "alphabetic";
      context.fillStyle = glyph.color;
    });
    normal.context?.fillText(glyph.character, originX, baseline);
    if (washed.context) {
      washed.context.shadowColor = "rgba(190,218,229,.3)";
      washed.context.shadowBlur = glyph.fontSize * 0.18;
      washed.context.shadowOffsetY = glyph.fontSize * 0.55;
      washed.context.filter = "blur(1.5px)";
      washed.context.fillText(glyph.character, originX, baseline);
    }
    glyphSprites.set(glyph.spriteKey, {
      normal: normal.canvas,
      washed: washed.canvas,
      width,
      height,
      originX,
      baseline,
    });
  };

  const prepareTrailSprite = (fontSize: number) => {
    const key = Math.round(fontSize * 10);
    if (trailSprites.has(key)) return;
    const trailWidth = Math.max(4, fontSize * 0.16);
    const trailHeight = Math.max(1, fontSize * 5.2);
    const dropWidth = Math.max(8, fontSize * 0.9);
    const dropHeight = Math.max(8, fontSize * 1.4);
    const trail = createSpriteSurface(trailWidth, trailHeight);
    const drop = createSpriteSurface(dropWidth, dropHeight);
    if (trail.context) {
      const gradient = trail.context.createLinearGradient(0, 0, 0, trailHeight);
      gradient.addColorStop(0, "rgba(229,243,248,.72)");
      gradient.addColorStop(0.42, "rgba(145,181,196,.2)");
      gradient.addColorStop(1, "rgba(145,181,196,0)");
      trail.context.strokeStyle = gradient;
      trail.context.lineWidth = 1;
      trail.context.beginPath();
      trail.context.moveTo(trailWidth * 0.5, 0);
      trail.context.lineTo(trailWidth * 0.5, trailHeight);
      trail.context.stroke();
    }
    if (drop.context) {
      const gradient = drop.context.createLinearGradient(
        0,
        dropHeight * 0.25,
        0,
        dropHeight * 0.75,
      );
      gradient.addColorStop(0, "rgba(235,247,250,.86)");
      gradient.addColorStop(1, "rgba(157,194,208,.18)");
      drop.context.fillStyle = gradient;
      drop.context.shadowColor = "rgba(185,216,228,.32)";
      drop.context.shadowBlur = fontSize * 0.35;
      drop.context.fillRect(
        dropWidth * 0.5 - 1,
        dropHeight * 0.25,
        2,
        fontSize * 0.7,
      );
    }
    trailSprites.set(key, {
      trail: trail.canvas,
      drop: drop.canvas,
      trailWidth,
      trailHeight,
      dropWidth,
      dropHeight,
    });
  };

  if (
    !finalMessage ||
    !finalImage ||
    targetLetters.length !== [...HIDDEN_MESSAGE].length ||
    !lightning ||
    !exposure ||
    selectedLetters.length !== [...HIDDEN_MESSAGE].length
  ) {
    return {
      getLightningTriggerProgress: () => 1,
      setHighlightProgress: () => undefined,
      setLightningSequenceProgress: () => undefined,
      setProgress: () => undefined,
      destroy: () => undefined,
    };
  }
  const lightningCanvas = createLightningCanvas(lightning);
  const lightningState = { progress: 0 };
  washedCanvas.className = "editorial-washed-canvas";
  washedCanvas.setAttribute("aria-hidden", "true");
  chapter.append(washedCanvas);

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

    if (washedContext) {
      washedPixelRatio = mobile ? 1 : Math.min(devicePixelRatio || 1, 2);
      washedWidth = viewportWidth;
      washedHeight = viewportHeight;
      washedCanvas.width = Math.max(1, Math.round(viewportWidth * washedPixelRatio));
      washedCanvas.height = Math.max(1, Math.round(viewportHeight * washedPixelRatio));
      washedCanvas.style.width = `${viewportWidth}px`;
      washedCanvas.style.height = `${viewportHeight}px`;
      washedContext.setTransform(washedPixelRatio, 0, 0, washedPixelRatio, 0, 0);
      washedContext.textAlign = "center";
      washedContext.textBaseline = "alphabetic";
      washedGlyphs.length = 0;
      washedLetters.forEach((letter) => {
        const sourceIndex = sourceLetters.indexOf(letter);
        const bounds = sourceBounds[sourceIndex];
        const style = getComputedStyle(letter);
        const x = bounds.left - chapterBounds.left + bounds.width * 0.5;
        const y = bounds.top - chapterBounds.top + bounds.height * 0.82;
        const centerY = bounds.top - chapterBounds.top + bounds.height * 0.5;
        const flight = leafFlights[sourceIndex];
        const fontSize = Number.parseFloat(style.fontSize);
        const font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
        const character = letter.textContent ?? "";
        const seed = hash((sourceIndex + 1) * 91.713);
        const targetX =
          viewportWidth *
          (0.045 + fract(sourceIndex * 0.61803398875 + seed * 0.11) * 0.91);
        const targetY =
          viewportHeight *
          (0.09 + fract(sourceIndex * 0.75487766625 + seed * 0.13) * 0.82);
        const direction = sourceIndex % 2 === 0 ? -1 : 1;
        const midTargetX = clamp(
          viewportWidth * 0.035,
          viewportWidth * 0.965,
          lerp(x, targetX, 0.42) + direction * viewportWidth * 0.1,
        );
        const midTargetY = clamp(
          viewportHeight * 0.075,
          viewportHeight * 0.925,
          lerp(y, targetY, 0.28) - viewportHeight * 0.07,
        );
        const drift =
          ((sourceIndex % 7) - 3) * 18 + direction * viewportWidth * 0.025;
        washedGlyphs.push({
          character,
          x,
          y,
          centerY,
          baselineOffset: y - centerY,
          targetX,
          targetY,
          midTargetX,
          midTargetY,
          rainTargetX: targetX + drift,
          rainTargetY: targetY + viewportHeight * 1.12,
          midRotation: flight.midRotation,
          rotation: flight.rotation,
          rainRotation:
            flight.rotation + direction * (150 + (sourceIndex % 5) * 38),
          scale: flight.scale,
          fontSize,
          font,
          color: style.color,
          spriteKey: `${font}|${style.color}|${character}`,
          trailKey: Math.round(fontSize * 10),
        });
      });
      if (!mobile) {
        washedGlyphs.forEach((glyph) => {
          prepareGlyphSprite(glyph);
          prepareTrailSprite(glyph.fontSize);
        });
      }
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
          duration: 0.1,
          stagger: 0.004,
          ease: "power2.out",
        },
        0.02,
      )
      .to(
        selectedLetters,
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
        FIRST_FLIGHT_TIME,
      )
      .to(
        selectedLetters,
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
        SECOND_FLIGHT_TIME,
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
        BRIGHT_HIGHLIGHT_TIME,
      )
      .to(
        [],
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
        RAIN_AWAY_TIME,
      )
      .to(
        lightning,
        { opacity: 1, duration: stretchLightningDuration(0.016) },
        LIGHTNING_START_TIME,
      )
      .to(
        lightningState,
        {
          progress: 1,
          duration: stretchLightningDuration(0.32),
          ease: "none",
          onUpdate: () => lightningCanvas.setProgress(lightningState.progress),
        },
        LIGHTNING_START_TIME,
      )
      .to(
        exposure,
        { opacity: 0.86, duration: stretchLightningDuration(0.018) },
        stretchLightningTime(2.845),
      )
      .to(
        exposure,
        { opacity: 0.14, duration: stretchLightningDuration(0.1) },
        stretchLightningTime(2.863),
      )
      .to(
        exposure,
        { opacity: 0.62, duration: stretchLightningDuration(0.018) },
        stretchLightningTime(2.963),
      )
      .to(
        exposure,
        { opacity: 0, duration: stretchLightningDuration(0.14) },
        stretchLightningTime(2.981),
      )
      .to(
        finalImage,
        {
          opacity: 1,
          clipPath: mobile ? "none" : "inset(0% 0% 0% 0%)",
          duration: stretchLightningDuration(0.25),
          ease: "power2.inOut",
        },
        stretchLightningTime(2.84),
      )
      .to(
        currentImage,
        {
          opacity: 0,
          x: "-8vw",
          duration: stretchLightningDuration(0.22),
          ease: "power2.inOut",
        },
        stretchLightningTime(2.88),
      )
      .to(
        copy,
        {
          opacity: 0,
          duration: stretchLightningDuration(0.18),
          ease: "power2.out",
        },
        stretchLightningTime(2.88),
      )
      .to(
        lightning,
        {
          opacity: 0,
          duration: stretchLightningDuration(0.14),
          ease: "power2.out",
        },
        stretchLightningTime(3.04),
      )
      .to(
        finalImage,
        {
          x: 0,
          filter: "brightness(.86) saturate(.7) contrast(1.1)",
          duration: stretchLightningDuration(0.22),
          ease: "power3.out",
        },
        stretchLightningTime(2.9),
      )
      .fromTo(
        finalMessage.querySelector("p"),
        { opacity: 0, y: 14 },
        {
          opacity: 1,
          y: 0,
          duration: stretchLightningDuration(0.12),
          ease: "power2.out",
        },
        stretchLightningTime(3.12),
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
        MESSAGE_ASSEMBLY_TIME,
      );
      timeline?.set(
        selectedLetters[index],
        { "--selected-opacity": 0 },
        MESSAGE_ASSEMBLY_TIME,
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
        MESSAGE_ASSEMBLY_TIME + 0.05 + index * 0.008,
      );
    });
    timeline.set(finalMessage, { opacity: 1 }, MESSAGE_ASSEMBLY_TIME);

    // Resolve GSAP's CSS start/end values before scroll reaches this chapter.
    // Both renders happen synchronously with callbacks suppressed, before paint.
    timeline.progress(1, true).progress(0, true);

    if (EDITORIAL_DEBUG.enabled) {
      debugOverlay = document.createElement("pre");
      debugOverlay.className = "editorial-debug";
      chapter.append(debugOverlay);
    }
  };

  const renderWashedLetters = (progress: number) => {
    if (!washedContext || !timeline) return;
    const time = progress * timeline.duration();
    const active = time >= FIRST_FLIGHT_TIME && time < RAIN_AWAY_TIME + 0.52;
    if (active !== washedActive) {
      washedActive = active;
      washedLetters.forEach((letter) => {
        letter.style.visibility =
          active || time >= RAIN_AWAY_TIME + 0.52 ? "hidden" : "";
      });
      washedCanvas.style.opacity = active ? "1" : "0";
    }
    washedContext.clearRect(0, 0, washedWidth, washedHeight);
    if (!active) return;

    const firstFlight =
      1 - Math.pow(1 - unit((time - FIRST_FLIGHT_TIME) / 0.42), 2);
    const secondFlight = unit((time - SECOND_FLIGHT_TIME) / 0.46);
    const secondEase = 0.5 - Math.cos(secondFlight * Math.PI) * 0.5;
    const rain = Math.pow(unit((time - RAIN_AWAY_TIME) / 0.5), 2);
    let currentFont = "";

    washedGlyphs.forEach((glyph) => {
      const x = lerp(
        lerp(glyph.x, glyph.midTargetX, firstFlight),
        glyph.targetX,
        secondEase,
      );
      const sourceY = mobile ? glyph.y : glyph.centerY;
      const y = lerp(
        lerp(sourceY, glyph.midTargetY, firstFlight),
        glyph.targetY,
        secondEase,
      );
      const drawX = lerp(x, glyph.rainTargetX, rain);
      const drawY = lerp(y, glyph.rainTargetY, rain);
      if (
        ![drawX, drawY].every(Number.isFinite)
      ) {
        return;
      }

      if (currentFont !== glyph.font) {
        currentFont = glyph.font;
        washedContext.font = currentFont;
      }
      if (mobile) {
        washedContext.fillStyle = glyph.color;
        washedContext.globalAlpha = 1 - rain;
        washedContext.fillText(glyph.character, drawX, drawY);
        return;
      }

      const rotation = lerp(
        lerp(0, glyph.midRotation, firstFlight),
        glyph.rotation,
        secondEase,
      );
      const rainRotation = lerp(rotation, glyph.rainRotation, rain);
      const firstScale = lerp(1, glyph.scale * 0.9, firstFlight);
      const baseScale = lerp(firstScale, glyph.scale, secondEase);
      const scaleX = baseScale * lerp(1, 0.16, rain);
      const scaleY = baseScale * lerp(1, 2.25, rain);
      const opacity = 1 - rain;
      const sprite = glyphSprites.get(glyph.spriteKey);
      const trailSprite = trailSprites.get(glyph.trailKey);
      if (!sprite || !trailSprite || opacity <= 0.001) return;

      washedContext.save();
      washedContext.translate(drawX, drawY);
      washedContext.rotate((rainRotation * Math.PI) / 180);
      washedContext.scale(scaleX, scaleY);

      if (rain > 0.001) {
        const trailStart = glyph.fontSize * 0.08;
        const visibleTrailHeight = trailSprite.trailHeight * rain;
        washedContext.globalAlpha = opacity * rain * 0.82;
        washedContext.drawImage(
          trailSprite.trail,
          -trailSprite.trailWidth * 0.5,
          trailStart,
          trailSprite.trailWidth,
          visibleTrailHeight,
        );
        washedContext.globalAlpha = opacity * rain * 0.94;
        washedContext.drawImage(
          trailSprite.drop,
          -trailSprite.dropWidth * 0.5,
          trailStart + visibleTrailHeight,
          trailSprite.dropWidth,
          trailSprite.dropHeight,
        );
      }

      const spriteX = -sprite.originX;
      const spriteY = glyph.baselineOffset - sprite.baseline;
      const normalOpacity = opacity * (1 - rain);
      if (normalOpacity > 0.001) {
        washedContext.globalAlpha = normalOpacity;
        washedContext.drawImage(
          sprite.normal,
          spriteX,
          spriteY,
          sprite.width,
          sprite.height,
        );
      }
      const washedOpacity = opacity * rain;
      if (washedOpacity > 0.001) {
        washedContext.globalAlpha = washedOpacity;
        washedContext.drawImage(
          sprite.washed,
          spriteX,
          spriteY,
          sprite.width,
          sprite.height,
        );
      }
      washedContext.restore();
    });
    washedContext.globalAlpha = 1;
    washedContext.filter = "none";
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

  const renderAtTime = (requestedTime: number) => {
    if (!timeline) createTimeline();
    if (!timeline) return;
    const time = Math.min(timeline.duration(), Math.max(0, requestedTime));
    if (Math.abs(time - lastRenderedTime) < 0.00005) return;
    lastRenderedTime = time;
    const value = timeline.duration() > 0 ? time / timeline.duration() : 0;
    timeline.time(time);
    renderWashedLetters(value);
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
  };

  return {
    getLightningTriggerProgress: () => {
      if (!timeline) createTimeline();
      if (!timeline || timeline.duration() <= HIGHLIGHT_READY_TIME) return 1;
      return (
        (LIGHTNING_START_TIME - HIGHLIGHT_READY_TIME) /
        (timeline.duration() - HIGHLIGHT_READY_TIME)
      );
    },
    setHighlightProgress: (progress) => {
      const value = Math.min(1, Math.max(0, progress));
      renderAtTime(value * HIGHLIGHT_READY_TIME);
    },
    setLightningSequenceProgress: (progress) => {
      if (!timeline) createTimeline();
      if (!timeline) return;
      const value = Math.min(1, Math.max(0, progress));
      renderAtTime(
        LIGHTNING_START_TIME +
          value * (timeline.duration() - LIGHTNING_START_TIME),
      );
    },
    setProgress: (progress, lightningComplete = false) => {
      if (!timeline) createTimeline();
      if (!timeline) return;
      const value = Math.min(1, Math.max(0, progress));
      const lightningTriggerProgress =
        (LIGHTNING_START_TIME - HIGHLIGHT_READY_TIME) /
        (timeline.duration() - HIGHLIGHT_READY_TIME);
      if (value < lightningTriggerProgress) {
        renderAtTime(
          HIGHLIGHT_READY_TIME +
            (value / lightningTriggerProgress) *
              (LIGHTNING_START_TIME - HIGHLIGHT_READY_TIME),
        );
        return;
      }
      renderAtTime(
        lightningComplete ? timeline.duration() : LIGHTNING_START_TIME,
      );
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
      glyphSprites.clear();
      trailSprites.clear();
      washedCanvas.remove();
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
