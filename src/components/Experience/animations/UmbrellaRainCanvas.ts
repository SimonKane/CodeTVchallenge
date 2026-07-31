interface RainDrop {
  x: number;
  y: number;
  length: number;
  speed: number;
  drift: number;
  alpha: number;
}

interface SplashDrop {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
}

interface ImpactCrown {
  x: number;
  y: number;
  side: -1 | 1;
  life: number;
  maxLife: number;
}

interface RunoffDrop {
  side: -1 | 1;
  progress: number;
  speed: number;
  x: number;
  y: number;
  vy: number;
  falling: boolean;
  alpha: number;
}

export interface UmbrellaRainCanvasController {
  setVisibility: (visibility: number) => void;
  invalidateGeometry: () => void;
  destroy: () => void;
}

const clamp = (value: number) => Math.min(1, Math.max(0, value));
const CANOPY_RADIUS_RATIO = 476 / 1024;
const CANOPY_APEX_RATIO = 316 / 1536;
const CANOPY_EDGE_RATIO = 623 / 1536;

export const createUmbrellaRainCanvas = (
  canvas: HTMLCanvasElement,
  umbrella: HTMLElement,
): UmbrellaRainCanvasController => {
  const context = canvas.getContext("2d");
  const mobile = matchMedia("(max-width: 800px), (pointer: coarse)").matches;
  const pixelRatio = Math.min(devicePixelRatio, mobile ? 1 : 2);
  const rain: RainDrop[] = [];
  const splashes: SplashDrop[] = [];
  const impactCrowns: ImpactCrown[] = [];
  const runoff: RunoffDrop[] = [];
  let width = 1;
  let height = 1;
  let visibility = 0;
  let animationFrame: number | undefined;
  let previousTime = performance.now();
  let geometryDirty = true;

  const canopy = {
    centerX: width * 0.5,
    radiusX: width * CANOPY_RADIUS_RATIO,
    apexY: height * CANOPY_APEX_RATIO,
    edgeY: height * CANOPY_EDGE_RATIO,
  };

  const syncCanopyGeometry = () => {
    const canvasBounds = canvas.getBoundingClientRect();
    const umbrellaBounds = umbrella.getBoundingClientRect();
    canopy.centerX = umbrellaBounds.left - canvasBounds.left + umbrellaBounds.width * 0.5;
    canopy.radiusX = umbrellaBounds.width * CANOPY_RADIUS_RATIO;
    canopy.apexY =
      umbrellaBounds.top - canvasBounds.top + umbrellaBounds.height * CANOPY_APEX_RATIO;
    canopy.edgeY =
      umbrellaBounds.top - canvasBounds.top + umbrellaBounds.height * CANOPY_EDGE_RATIO;
    geometryDirty = false;
  };

  const canopySurface = (x: number) => {
    const normalized = (x - canopy.centerX) / canopy.radiusX;
    if (Math.abs(normalized) >= 1) return undefined;
    return (
      canopy.apexY +
      Math.pow(Math.abs(normalized), 2.08) * (canopy.edgeY - canopy.apexY)
    );
  };

  const resetRainDrop = (drop: RainDrop, randomY = false) => {
    drop.x = Math.random() * (width + 160) - 80;
    drop.y = randomY ? Math.random() * height : -40 - Math.random() * height * 0.3;
    drop.length = 13 + Math.random() * 24;
    drop.speed = 720 + Math.random() * 620;
    drop.drift = -42 - Math.random() * 46;
    drop.alpha = 0.22 + Math.random() * 0.48;
  };

  const createImpact = (x: number, y: number) => {
    const side = (x < canopy.centerX ? -1 : 1) as -1 | 1;
    const crownLife = 0.1 + Math.random() * 0.07;
    impactCrowns.push({ x, y, side, life: crownLife, maxLife: crownLife });
    const splashCount = 2 + Math.floor(Math.random() * 3);
    for (let index = 0; index < splashCount; index += 1) {
      const maxLife = 0.14 + Math.random() * 0.13;
      splashes.push({
        x,
        y,
        vx: side * (28 + Math.random() * 95) + (Math.random() - 0.5) * 50,
        vy: -45 - Math.random() * 85,
        life: maxLife,
        maxLife,
        size: 0.7 + Math.random() * 1.4,
      });
    }

    if (runoff.length < 100 && Math.random() < 0.9) {
      runoff.push({
        side,
        progress: Math.min(0.94, Math.abs(x - canopy.centerX) / canopy.radiusX),
        speed: 0.22 + Math.random() * 0.34,
        x,
        y,
        vy: 0,
        falling: false,
        alpha: 0.32 + Math.random() * 0.5,
      });
    }
  };

  const rebuild = () => {
    const bounds = canvas.getBoundingClientRect();
    width = Math.max(1, bounds.width);
    height = Math.max(1, bounds.height);
    canvas.width = Math.round(width * pixelRatio);
    canvas.height = Math.round(height * pixelRatio);
    context?.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    syncCanopyGeometry();
    rain.length = 0;
    const count = mobile ? 100 : width < 700 ? 135 : 260;
    for (let index = 0; index < count; index += 1) {
      const drop = {} as RainDrop;
      resetRainDrop(drop, true);
      const surface = canopySurface(drop.x);
      if (surface !== undefined && drop.y > surface) drop.y = Math.random() * surface;
      rain.push(drop);
    }
    splashes.length = 0;
    impactCrowns.length = 0;
    runoff.length = 0;
  };

  const update = (delta: number) => {
    if (geometryDirty) syncCanopyGeometry();
    rain.forEach((drop) => {
      const previousY = drop.y;
      drop.x += drop.drift * delta;
      drop.y += drop.speed * delta;
      const surface = canopySurface(drop.x);
      if (surface !== undefined && previousY > surface) {
        resetRainDrop(drop);
      } else if (
        surface !== undefined &&
        previousY <= surface &&
        drop.y >= surface
      ) {
        createImpact(drop.x, surface);
        resetRainDrop(drop);
      } else if (drop.y - drop.length > height || drop.x < -100) {
        resetRainDrop(drop);
      }
    });

    for (let index = splashes.length - 1; index >= 0; index -= 1) {
      const drop = splashes[index];
      drop.vy += 620 * delta;
      drop.x += drop.vx * delta;
      drop.y += drop.vy * delta;
      drop.life -= delta;
      if (drop.life <= 0) splashes.splice(index, 1);
    }

    for (let index = impactCrowns.length - 1; index >= 0; index -= 1) {
      impactCrowns[index].life -= delta;
      if (impactCrowns[index].life <= 0) impactCrowns.splice(index, 1);
    }

    for (let index = runoff.length - 1; index >= 0; index -= 1) {
      const drop = runoff[index];
      if (!drop.falling) {
        drop.progress += drop.speed * delta;
        drop.x = canopy.centerX + drop.side * canopy.radiusX * drop.progress;
        drop.y = canopySurface(drop.x) ?? canopy.edgeY;
        if (drop.progress >= 0.995) {
          drop.falling = true;
          drop.vy = 180 + Math.random() * 150;
        }
      } else {
        drop.x += drop.side * 35 * delta;
        drop.vy += 520 * delta;
        drop.y += drop.vy * delta;
      }
      if (drop.y > height + 30) runoff.splice(index, 1);
    }
  };

  const draw = () => {
    if (!context) return;
    context.clearRect(0, 0, width, height);
    context.save();
    context.lineCap = "round";
    rain.forEach((drop) => {
      context.globalAlpha = drop.alpha;
      context.strokeStyle = "rgba(205,231,241,.9)";
      context.lineWidth = 0.65;
      context.beginPath();
      context.moveTo(drop.x - drop.drift * 0.018, drop.y - drop.length);
      context.lineTo(drop.x, drop.y);
      context.stroke();
    });
    splashes.forEach((drop) => {
      context.globalAlpha = (drop.life / drop.maxLife) * 0.9;
      context.strokeStyle = "rgba(229,245,249,.95)";
      context.lineWidth = drop.size;
      context.beginPath();
      context.moveTo(drop.x - drop.vx * 0.014, drop.y - drop.vy * 0.014);
      context.lineTo(drop.x, drop.y);
      context.stroke();
    });
    impactCrowns.forEach((impact) => {
      const progress = 1 - impact.life / impact.maxLife;
      context.globalAlpha = (1 - progress) * 0.72;
      context.strokeStyle = "rgba(231,247,251,.92)";
      context.lineWidth = 0.9;
      context.beginPath();
      context.ellipse(
        impact.x + impact.side * progress * 4,
        impact.y,
        2 + progress * 7,
        0.6 + progress * 1.6,
        impact.side * 0.28,
        Math.PI,
        Math.PI * 2,
      );
      context.stroke();
    });
    runoff.forEach((drop) => {
      context.globalAlpha = drop.alpha;
      context.strokeStyle = "rgba(215,238,244,.86)";
      context.lineWidth = 1.15;
      context.beginPath();
      context.moveTo(drop.x, drop.y - (drop.falling ? 8 : 2));
      context.lineTo(drop.x, drop.y + 3);
      context.stroke();
    });
    context.restore();
  };

  const animate = (time: number) => {
    const delta = Math.min(0.033, Math.max(0, (time - previousTime) / 1000));
    previousTime = time;
    update(delta);
    draw();
    animationFrame = requestAnimationFrame(animate);
  };

  const syncAnimation = () => {
    if (visibility > 0 && animationFrame === undefined) {
      previousTime = performance.now();
      animationFrame = requestAnimationFrame(animate);
    } else if (visibility <= 0 && animationFrame !== undefined) {
      cancelAnimationFrame(animationFrame);
      animationFrame = undefined;
      context?.clearRect(0, 0, width, height);
    }
  };

  const resizeObserver = new ResizeObserver(rebuild);
  resizeObserver.observe(canvas);
  rebuild();

  return {
    setVisibility: (value) => {
      visibility = clamp(value);
      canvas.style.opacity = `${visibility}`;
      syncAnimation();
    },
    invalidateGeometry: () => {
      geometryDirty = true;
    },
    destroy: () => {
      if (animationFrame !== undefined) cancelAnimationFrame(animationFrame);
      resizeObserver.disconnect();
      context?.clearRect(0, 0, width, height);
    },
  };
};
