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
  delay: number;
  distance: number;
}

interface RevealTarget {
  element: HTMLElement;
  letters: RainLetter[];
  originalText: string;
  start: number;
  end: number;
  strength: number;
  bounds: { left: number; top: number; width: number; height: number };
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
  strength: number,
): { letters: RainLetter[]; originalText: string } => {
  const originalText = element.textContent?.replace(/\s+/g, " ").trim() ?? "";
  const fragment = document.createDocumentFragment();
  const letters: RainLetter[] = [];
  const parts = originalText.split(/(\s+)/);
  let letterIndex = 0;

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
      const delaySeed = hash(letterIndex + originalText.length * 0.37);
      const distanceSeed = hash(letterIndex * 1.71 + originalText.length);
      const distance = (54 + distanceSeed * 126) * strength;
      letter.className = "rain-letter";
      letter.textContent = character;
      letter.style.opacity = "0";
      letter.style.transform = `translate3d(0, ${-distance}px, 0) scaleX(.12) scaleY(1.9)`;
      letter.style.filter = "blur(1.6px)";
      letter.style.setProperty("--rain-trail-opacity", "0");
      letter.style.setProperty("--rain-drop-opacity", "0");
      letter.style.setProperty("--rain-trail-height", `${distance}px`);
      word.append(letter);
      letters.push({
        element: letter,
        delay: delaySeed * 0.56,
        distance,
      });
      letterIndex += 1;
    });
    fragment.append(word);
  });

  element.textContent = "";
  element.append(fragment);
  element.classList.add("rain-text-reveal");
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
  const mobile = matchMedia("(max-width: 720px)").matches;
  const pixelRatio = Math.min(devicePixelRatio, mobile ? 1.5 : 2);
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
      start: 0.48 + index * 0.055,
      end: 0.88 + index * 0.04,
      strength: mobile ? 0.42 : 0.56,
    })),
  ];
  const targets: RevealTarget[] = definitions.map((definition) => ({
    ...definition,
    ...splitIntoRainLetters(definition.element, definition.strength),
    bounds: { left: 0, top: 0, width: 0, height: 0 },
  }));
  let width = 1;
  let height = 1;
  let currentProgress = 0;
  let animationFrame: number | undefined;

  canvas.className = "experience-water-canvas";
  canvas.setAttribute("aria-hidden", "true");
  container.append(canvas);

  const resize = () => {
    const bounds = container.getBoundingClientRect();
    width = Math.max(1, bounds.width);
    height = Math.max(1, bounds.height);
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
    if (!context) return;
    context.clearRect(0, 0, width, height);
    if (progress < 0 || progress >= 0.98) return;
    const rainIn = smooth(progress / 0.1);
    const rainOut = 1 - smooth((progress - 0.82) / 0.16);
    const rainIntensity = rainIn * rainOut;
    const screenDropCount = mobile ? 42 : 86;

    for (let index = 0; index < screenDropCount; index += 1) {
      const xSeed = hash(index * 2.17 + 4.3);
      const ySeed = hash(index * 5.91 + 1.7);
      const speed = 0.19 + hash(index * 3.13) * 0.34;
      const x = xSeed * width;
      const y = (((ySeed + time * speed) % 1.22) - 0.11) * height;
      const depth = 0.35 + hash(index * 7.31) * 0.65;
      const length = (mobile ? 18 : 24) + depth * (mobile ? 34 : 62);
      const alpha = rainIntensity * (0.07 + depth * 0.2);
      const gradient = context.createLinearGradient(x, y - length, x, y);
      gradient.addColorStop(0, "rgba(186,214,226,0)");
      gradient.addColorStop(
        0.72,
        `rgba(197,222,232,${(alpha * 0.48).toFixed(3)})`,
      );
      gradient.addColorStop(
        1,
        `rgba(233,244,247,${alpha.toFixed(3)})`,
      );
      context.strokeStyle = gradient;
      context.lineWidth = 0.55 + depth * 0.58;
      context.beginPath();
      context.moveTo(x, y - length);
      context.lineTo(x, y);
      context.stroke();
    }

    targets.forEach((target, targetIndex) => {
      const groupProgress = clamp(
        (progress - target.start) / (target.end - target.start),
      );
      if (groupProgress <= 0 || groupProgress >= 1) return;
      const bounds = target.bounds;
      const left = bounds.left;
      const top = bounds.top;
      const dropCount = mobile ? 4 : Math.round(7 + target.strength * 7);

      for (let index = 0; index < dropCount; index += 1) {
        const seed = hash(index + targetIndex * 8.17);
        const x = left + bounds.width * (0.04 + seed * 0.92);
        const fall = (groupProgress * 1.55 + hash(index * 2.3) * 0.72) % 1;
        const y = top - 18 + fall * (bounds.height + 32);
        const trail = 18 + seed * 42 * target.strength;
        const gradient = context.createLinearGradient(x, y - trail, x, y + 3);
        gradient.addColorStop(0, "rgba(205,229,238,0)");
        gradient.addColorStop(
          0.76,
          `rgba(205,229,238,${0.16 * target.strength})`,
        );
        gradient.addColorStop(
          1,
          `rgba(238,247,249,${0.48 * target.strength})`,
        );
        context.strokeStyle = gradient;
        context.lineWidth = mobile ? 0.6 : 0.85;
        context.beginPath();
        context.moveTo(x, y - trail);
        context.lineTo(x, y);
        context.stroke();
        context.fillStyle = `rgba(232,244,248,${0.42 * target.strength})`;
        context.beginPath();
        context.ellipse(x, y + 1, mobile ? 0.8 : 1.15, mobile ? 2 : 2.8, 0, 0, Math.PI * 2);
        context.fill();
      }
    });
  };

  const stopRain = () => {
    if (animationFrame !== undefined) cancelAnimationFrame(animationFrame);
    animationFrame = undefined;
  };

  const animateRain = (time: number) => {
    animationFrame = undefined;
    drawWater(currentProgress, time * 0.001);
    if (currentProgress > 0 && currentProgress < 0.98) {
      animationFrame = requestAnimationFrame(animateRain);
    }
  };

  const syncRainLoop = () => {
    const active = currentProgress > 0 && currentProgress < 0.98;
    if (active && animationFrame === undefined) {
      animationFrame = requestAnimationFrame(animateRain);
    } else if (!active) {
      stopRain();
      context?.clearRect(0, 0, width, height);
    }
  };

  const updateTarget = (target: RevealTarget, progress: number) => {
    const groupProgress = clamp(
      (progress - target.start) / (target.end - target.start),
    );
    target.letters.forEach(({ element, delay, distance }) => {
      const cinematicDelay = delay * (0.35 / 0.56);
      const letterProgress = clamp((groupProgress - cinematicDelay) / 0.65);
      const settled = smooth(letterProgress);
      const visibility = smooth(letterProgress / 0.13);
      const glyphShape = smooth((letterProgress - 0.16) / 0.68);
      const trailOpacity =
        Math.sin(Math.PI * letterProgress) *
        (0.32 + target.strength * 0.48);
      const dropOpacity =
        (1 - smooth((letterProgress - 0.42) / 0.38)) *
        Math.min(1, visibility * 1.4);

      element.style.opacity = String(visibility);
      element.style.transform = `translate3d(0, ${(
        -distance *
        (1 - settled)
      ).toFixed(2)}px, 0) scaleX(${(0.12 + glyphShape * 0.88).toFixed(
        3,
      )}) scaleY(${(1.9 - glyphShape * 0.9).toFixed(3)})`;
      element.style.filter =
        letterProgress >= 0.88
          ? "none"
          : `blur(${((1 - glyphShape) * 1.35).toFixed(2)}px)`;
      element.style.textShadow =
        letterProgress >= 0.92
          ? "none"
          : `0 0 ${(2 + (1 - glyphShape) * 7).toFixed(
              1,
            )}px rgba(205,231,240,${(0.12 + dropOpacity * 0.34).toFixed(2)})`;
      element.style.setProperty(
        "--rain-trail-opacity",
        trailOpacity.toFixed(3),
      );
      element.style.setProperty(
        "--rain-drop-opacity",
        dropOpacity.toFixed(3),
      );
      element.style.setProperty(
        "--rain-trail-height",
        `${Math.max(5, distance * (1 - settled * 0.72)).toFixed(1)}px`,
      );
    });
    target.element.classList.toggle(
      "rain-text-reveal--complete",
      groupProgress >= 0.999,
    );
  };

  return {
    setProgress: (progress) => {
      currentProgress = progress;
      targets.forEach((target) => updateTarget(target, progress));
      syncRainLoop();
    },
    destroy: () => {
      resizeObserver.disconnect();
      stopRain();
      targets.forEach(({ element, originalText }) => {
        element.classList.remove(
          "rain-text-reveal",
          "rain-text-reveal--complete",
        );
        element.textContent = originalText;
      });
      canvas.remove();
    },
  };
};
