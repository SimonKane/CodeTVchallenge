interface WaterRevealElements {
  container: HTMLElement;
  eyebrow: HTMLElement;
  headingLines: HTMLElement[];
  bodyLines: HTMLElement[];
}

export interface WaterTextRevealController {
  setProgress: (progress: number) => void;
  destroy: () => void;
}

interface RainLetter {
  element: HTMLSpanElement;
}

interface RevealTarget {
  element: HTMLElement;
  letters: RainLetter[];
  originalText: string;
  start: number;
  end: number;
  strength: number;
  bounds: { left: number; top: number; width: number; height: number };
  lastProgress: number;
}

const clamp = (value: number) => Math.min(1, Math.max(0, value));
const smooth = (value: number) => {
  const t = clamp(value);
  return t * t * (3 - 2 * t);
};
const hash = (value: number) =>
  ((Math.sin(value * 91.733 + 17.17) * 43758.5453) % 1 + 1) % 1;

const splitIntoRainLetters = (
  element: HTMLElement,
): { letters: RainLetter[]; originalText: string } => {
  const originalText = element.textContent?.replace(/\s+/g, " ").trim() ?? "";
  const fragment = document.createDocumentFragment();
  const letters: RainLetter[] = [];
  const parts = originalText.split(/(\s+)/);

  parts.forEach((part) => {
    if (!part) return;
    if (/^\s+$/.test(part)) {
      const space = document.createElement("span");
      space.className = "rain-letter rain-letter--space";
      space.textContent = "\u00a0";
      space.setAttribute("aria-hidden", "true");
      fragment.append(space);
      return;
    }

    const word = document.createElement("span");
    word.className = "rain-word";
    word.setAttribute("aria-hidden", "true");
    [...part].forEach((character) => {
      const letter = document.createElement("span");
      letter.className = "rain-letter";
      letter.textContent = character;
      word.append(letter);
      letters.push({ element: letter });
    });
    fragment.append(word);
  });

  element.textContent = "";
  element.append(fragment);
  element.classList.add("rain-text-reveal");
  element.style.opacity = "0";
  element.style.transform = "translate3d(0, -24px, 0)";
  element.style.filter = "none";
  return { letters, originalText };
};

export const createWaterTextReveal = ({
  container,
  eyebrow,
  headingLines,
  bodyLines,
}: WaterRevealElements): WaterTextRevealController => {
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  const mobile = matchMedia(
    "(max-width: 900px), (pointer: coarse)",
  ).matches;
  let pixelRatio = Math.min(devicePixelRatio, mobile ? 1 : 2);
  const definitions = [
    { element: eyebrow, start: 0, end: 0.22, strength: 0.74 },
    ...headingLines.map((element, index) => ({
      element,
      start: 0.12 + index * 0.045,
      end: 0.58 + index * 0.045,
      strength: mobile ? 0.72 : 1,
    })),
    ...bodyLines.map((element, index) => ({
      element,
      start: 0.38 + index * 0.05,
      end: 0.82 + index * 0.045,
      strength: mobile ? 0.42 : 0.56,
    })),
  ];
  const targets: RevealTarget[] = definitions.map((definition) => ({
    ...definition,
    ...splitIntoRainLetters(definition.element),
    bounds: { left: 0, top: 0, width: 0, height: 0 },
    lastProgress: -1,
  }));
  let width = 1;
  let height = 1;
  let currentProgress = 0;

  canvas.className = "experience-water-canvas";
  canvas.setAttribute("aria-hidden", "true");
  container.append(canvas);

  const resize = () => {
    const bounds = container.getBoundingClientRect();
    const nextWidth = Math.max(1, bounds.width);
    const nextHeight = Math.max(1, bounds.height);
    const nextPixelRatio = Math.min(devicePixelRatio, mobile ? 1 : 2);
    if (
      nextWidth === width &&
      nextHeight === height &&
      nextPixelRatio === pixelRatio
    ) {
      return;
    }
    width = nextWidth;
    height = nextHeight;
    pixelRatio = nextPixelRatio;
    canvas.width = Math.round(width * pixelRatio);
    canvas.height = Math.round(height * pixelRatio);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    context?.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    targets.forEach((target) => {
      const targetBounds = target.element.getBoundingClientRect();
      target.bounds = {
        left: targetBounds.left - bounds.left,
        top: targetBounds.top - bounds.top,
        width: targetBounds.width,
        height: targetBounds.height,
      };
    });
  };

  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(container);
  resize();

  const drawWater = (progress: number, time = performance.now() * 0.001) => {
    if (!context || mobile) return;
    context.clearRect(0, 0, width, height);
    if (progress < 0 || progress >= 0.98) return;
    const rainIn = smooth(progress / 0.1);
    const rainOut = 1 - smooth((progress - 0.82) / 0.16);
    const rainIntensity = rainIn * rainOut;
    const screenDropCount = 56;
    const screenBuckets: Array<
      Array<{ x: number; y: number; length: number }>
    > = [[], [], [], []];

    for (let index = 0; index < screenDropCount; index += 1) {
      const xSeed = hash(index * 2.17 + 4.3);
      const ySeed = hash(index * 5.91 + 1.7);
      const speed = 0.19 + hash(index * 3.13) * 0.34;
      const x = xSeed * width;
      const y = (((ySeed + time * speed) % 1.22) - 0.11) * height;
      const depth = 0.35 + hash(index * 7.31) * 0.65;
      const length = (mobile ? 18 : 24) + depth * (mobile ? 34 : 62);
      const bucket = Math.min(3, Math.floor(depth * 4));
      screenBuckets[bucket].push({ x, y, length });
    }

    screenBuckets.forEach((drops, bucket) => {
      if (drops.length === 0) return;
      const depth = (bucket + 0.5) / 4;
      const alpha = rainIntensity * (0.07 + depth * 0.2);
      context.strokeStyle = `rgba(222,239,245,${alpha.toFixed(3)})`;
      context.lineWidth = 0.55 + depth * 0.58;
      context.beginPath();
      drops.forEach(({ x, y, length }) => {
        context.moveTo(x, y - length);
        context.lineTo(x, y);
      });
      context.stroke();
    });

    targets.forEach((target, targetIndex) => {
      const groupProgress = clamp(
        (progress - target.start) / (target.end - target.start),
      );
      if (groupProgress <= 0 || groupProgress >= 1) return;
      const bounds = target.bounds;
      const left = bounds.left;
      const top = bounds.top;
      const dropCount = Math.round(4 + target.strength * 4);

      context.strokeStyle = `rgba(220,238,244,${(
        0.28 * target.strength
      ).toFixed(3)})`;
      context.lineWidth = 0.78;
      context.beginPath();
      for (let index = 0; index < dropCount; index += 1) {
        const seed = hash(index + targetIndex * 8.17);
        const x = left + bounds.width * (0.04 + seed * 0.92);
        const fall = (groupProgress * 1.55 + hash(index * 2.3) * 0.72) % 1;
        const y = top - 18 + fall * (bounds.height + 32);
        const trail = 18 + seed * 42 * target.strength;
        context.moveTo(x, y - trail);
        context.lineTo(x, y);
      }
      context.stroke();
    });
  };

  const updateTarget = (target: RevealTarget, progress: number) => {
    const groupProgress = clamp(
      (progress - target.start) / (target.end - target.start),
    );
    if (
      groupProgress === target.lastProgress ||
      (groupProgress > 0 &&
        groupProgress < 1 &&
        Math.abs(groupProgress - target.lastProgress) < 0.003)
    ) {
      return;
    }
    target.lastProgress = groupProgress;
    const settled = smooth(groupProgress);
    target.element.style.opacity = `${smooth(groupProgress / 0.22)}`;
    target.element.style.transform = `translate3d(0, ${(
      -24 *
      (1 - settled)
    ).toFixed(2)}px, 0)`;
    target.element.classList.toggle(
      "rain-text-reveal--complete",
      groupProgress >= 0.999,
    );
  };

  return {
    setProgress: (progress) => {
      currentProgress = progress;
      targets.forEach((target) => updateTarget(target, progress));
      drawWater(currentProgress);
    },
    destroy: () => {
      resizeObserver.disconnect();
      context?.clearRect(0, 0, width, height);
      targets.forEach(({ element, originalText }) => {
        element.classList.remove(
          "rain-text-reveal",
          "rain-text-reveal--complete",
        );
        element.textContent = originalText;
        element.style.removeProperty("opacity");
        element.style.removeProperty("transform");
        element.style.removeProperty("filter");
      });
      canvas.remove();
    },
  };
};
