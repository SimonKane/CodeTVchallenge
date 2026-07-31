export interface QualityPreset {
  mobile: boolean;
  lowPower: boolean;
  pixelRatio: number;
  rainCount: number;
  wordParticles: number;
  fogLayers: number;
  postProcessing: boolean;
}

type NavigatorWithMemory = Navigator & { deviceMemory?: number };

const usesSoftwareRenderer = () => {
  try {
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("webgl2") || canvas.getContext("webgl");
    if (!context) return false;
    const extension = context.getExtension("WEBGL_debug_renderer_info");
    const renderer = String(
      extension
        ? context.getParameter(extension.UNMASKED_RENDERER_WEBGL)
        : context.getParameter(context.RENDERER),
    ).toLowerCase();
    return /swiftshader|llvmpipe|software/.test(renderer);
  } catch {
    return false;
  }
};

export const supportsWebGL = () => {
  try {
    const canvas = document.createElement("canvas");
    return Boolean(
      canvas.getContext("webgl2", { failIfMajorPerformanceCaveat: true }) ||
        canvas.getContext("webgl", { failIfMajorPerformanceCaveat: true }),
    );
  } catch {
    return false;
  }
};

export const getQualityPreset = (): QualityPreset => {
  const mobile = matchMedia("(max-width: 720px), (pointer: coarse)").matches;
  const memory = (navigator as NavigatorWithMemory).deviceMemory ?? 8;
  const lowPower =
    memory <= 4 || navigator.hardwareConcurrency <= 4 || usesSoftwareRenderer();

  return {
    mobile,
    lowPower,
    pixelRatio: Math.min(devicePixelRatio || 1, mobile ? 1 : lowPower ? 1.25 : 1.7),
    rainCount: mobile ? 650 : lowPower ? 1450 : 2400,
    wordParticles: mobile ? 600 : 1440,
    fogLayers: mobile ? 2 : lowPower ? 3 : 5,
    postProcessing: !lowPower && !mobile,
  };
};
