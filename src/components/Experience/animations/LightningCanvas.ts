interface Point {
  x: number;
  y: number;
}

interface Bolt {
  points: Point[];
  lengths: number[];
  totalLength: number;
  revealAt: number;
  strength: number;
}

export interface LightningCanvasController {
  setProgress: (progress: number) => void;
  destroy: () => void;
}

const clamp = (value: number) => Math.min(1, Math.max(0, value));
const smooth = (value: number) => {
  const t = clamp(value);
  return t * t * (3 - 2 * t);
};

const createRandom = (seed: number) => {
  let value = seed >>> 0;
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 4294967296;
  };
};

const buildBolt = (
  start: Point,
  end: Point,
  iterations: number,
  roughness: number,
  random: () => number,
): Point[] => {
  let points = [start, end];
  let displacement = Math.hypot(end.x - start.x, end.y - start.y) * roughness;
  for (let iteration = 0; iteration < iterations; iteration += 1) {
    const next: Point[] = [points[0]];
    for (let index = 0; index < points.length - 1; index += 1) {
      const from = points[index];
      const to = points[index + 1];
      const dx = to.x - from.x;
      const dy = to.y - from.y;
      const length = Math.max(1, Math.hypot(dx, dy));
      const normalX = -dy / length;
      const normalY = dx / length;
      const asymmetricNoise =
        (random() - 0.5) * displacement * (0.45 + random() * 0.7);
      next.push({
        x: (from.x + to.x) * 0.5 + normalX * asymmetricNoise,
        y: (from.y + to.y) * 0.5 + normalY * asymmetricNoise,
      });
      next.push(to);
    }
    points = next;
    displacement *= 0.51;
  }
  return points;
};

const measureBolt = (
  points: Point[],
  revealAt: number,
  strength: number,
): Bolt => {
  const lengths = [0];
  let totalLength = 0;
  for (let index = 1; index < points.length; index += 1) {
    totalLength += Math.hypot(
      points[index].x - points[index - 1].x,
      points[index].y - points[index - 1].y,
    );
    lengths.push(totalLength);
  }
  return { points, lengths, totalLength, revealAt, strength };
};

export const createLightningCanvas = (
  canvas: HTMLCanvasElement,
): LightningCanvasController => {
  const context = canvas.getContext("2d");
  const pixelRatio = Math.min(devicePixelRatio, 2);
  let width = 1;
  let height = 1;
  let progress = 0;
  let bolts: Bolt[] = [];

  const rebuild = () => {
    const bounds = canvas.getBoundingClientRect();
    width = Math.max(1, bounds.width);
    height = Math.max(1, bounds.height);
    canvas.width = Math.round(width * pixelRatio);
    canvas.height = Math.round(height * pixelRatio);
    context?.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);

    const random = createRandom(92841);
    const start = { x: width * 1.04, y: height * 0.13 };
    const end = { x: width * -0.04, y: height * 0.7 };
    const mainPoints = buildBolt(start, end, 8, 0.115, random);
    const main = measureBolt(mainPoints, 0, 1);
    const branches: Bolt[] = [];
    const branchAnchors = [0.16, 0.27, 0.39, 0.52, 0.64, 0.75, 0.84];

    branchAnchors.forEach((anchor, branchIndex) => {
      const pointIndex = Math.min(
        mainPoints.length - 3,
        Math.max(2, Math.floor(anchor * (mainPoints.length - 1))),
      );
      const anchorPoint = mainPoints[pointIndex];
      const previous = mainPoints[pointIndex - 2];
      const tangentX = anchorPoint.x - previous.x;
      const tangentY = anchorPoint.y - previous.y;
      const tangentLength = Math.max(1, Math.hypot(tangentX, tangentY));
      const normalX = -tangentY / tangentLength;
      const normalY = tangentX / tangentLength;
      const side = branchIndex % 2 === 0 ? -1 : 1;
      const branchLength = width * (0.1 + random() * 0.12);
      const branchEnd = {
        x:
          anchorPoint.x +
          (tangentX / tangentLength) * branchLength * 0.34 +
          normalX * branchLength * side,
        y:
          anchorPoint.y +
          (tangentY / tangentLength) * branchLength * 0.34 +
          normalY * branchLength * side,
      };
      const branchPoints = buildBolt(
        anchorPoint,
        branchEnd,
        6,
        0.14,
        random,
      );
      branches.push(
        measureBolt(branchPoints, 0.12 + anchor * 0.52, 0.48 + random() * 0.22),
      );

      if (branchIndex === 1 || branchIndex === 4) {
        const forkAnchor = branchPoints[Math.floor(branchPoints.length * 0.56)];
        const forkEnd = {
          x: forkAnchor.x + normalX * branchLength * side * 0.46,
          y: forkAnchor.y + normalY * branchLength * side * 0.46,
        };
        branches.push(
          measureBolt(
            buildBolt(forkAnchor, forkEnd, 5, 0.15, random),
            0.24 + anchor * 0.5,
            0.3,
          ),
        );
      }
    });
    bolts = [main, ...branches];
  };

  const traceBolt = (bolt: Bolt, reveal: number) => {
    if (!context || reveal <= 0) return;
    const visibleLength = bolt.totalLength * clamp(reveal);
    context.beginPath();
    context.moveTo(bolt.points[0].x, bolt.points[0].y);
    for (let index = 1; index < bolt.points.length; index += 1) {
      const previousLength = bolt.lengths[index - 1];
      const nextLength = bolt.lengths[index];
      if (nextLength <= visibleLength) {
        context.lineTo(bolt.points[index].x, bolt.points[index].y);
        continue;
      }
      if (previousLength < visibleLength) {
        const segmentProgress =
          (visibleLength - previousLength) /
          Math.max(0.001, nextLength - previousLength);
        context.lineTo(
          bolt.points[index - 1].x +
            (bolt.points[index].x - bolt.points[index - 1].x) * segmentProgress,
          bolt.points[index - 1].y +
            (bolt.points[index].y - bolt.points[index - 1].y) * segmentProgress,
        );
      }
      break;
    }
  };

  const drawLayer = (
    lineWidth: number,
    color: string,
    blur: number,
    intensity: number,
  ) => {
    if (!context) return;
    context.lineCap = "round";
    context.lineJoin = "round";
    context.strokeStyle = color;
    context.lineWidth = lineWidth;
    context.shadowBlur = blur;
    context.shadowColor = color;
    bolts.forEach((bolt, index) => {
      const branchProgress =
        index === 0
          ? smooth(progress / 0.58)
          : smooth((progress - bolt.revealAt) / 0.34);
      if (branchProgress <= 0) return;
      context.globalAlpha = intensity * bolt.strength;
      traceBolt(bolt, branchProgress);
      context.stroke();
    });
  };

  const draw = () => {
    if (!context) return;
    context.clearRect(0, 0, width, height);
    if (progress <= 0 || progress >= 1) return;
    const ignition = smooth(progress / 0.16);
    const recovery = 1 - smooth((progress - 0.7) / 0.3);
    const intensity = ignition * recovery;
    context.save();
    context.globalCompositeOperation = "lighter";
    drawLayer(24, "rgba(72,145,196,.12)", 34, intensity);
    drawLayer(9, "rgba(126,199,235,.22)", 19, intensity);
    drawLayer(3.2, "rgba(195,232,250,.66)", 9, intensity);
    drawLayer(1.15, "rgba(250,254,255,.98)", 3, intensity);
    context.restore();
  };

  const resizeObserver = new ResizeObserver(() => {
    rebuild();
    draw();
  });
  resizeObserver.observe(canvas);
  rebuild();

  return {
    setProgress: (value) => {
      progress = clamp(value);
      draw();
    },
    destroy: () => {
      resizeObserver.disconnect();
      context?.clearRect(0, 0, width, height);
    },
  };
};
