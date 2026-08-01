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

interface WebGLCapabilities {
  supported: boolean;
  softwareRenderer: boolean;
}

let cachedCapabilities: WebGLCapabilities | undefined;

const inspectWebGL = (): WebGLCapabilities => {
  if (cachedCapabilities) return cachedCapabilities;
  try {
    const canvas = document.createElement("canvas");
    const options = { failIfMajorPerformanceCaveat: true };
    const context =
      canvas.getContext("webgl2", options) || canvas.getContext("webgl", options);
    if (!context) {
      cachedCapabilities = { supported: false, softwareRenderer: false };
      return cachedCapabilities;
    }
    const extension = context.getExtension("WEBGL_debug_renderer_info");
    const renderer = String(
      extension
        ? context.getParameter(extension.UNMASKED_RENDERER_WEBGL)
        : context.getParameter(context.RENDERER),
    ).toLowerCase();
    cachedCapabilities = {
      supported: true,
      softwareRenderer: /swiftshader|llvmpipe|software/.test(renderer),
    };
    context.getExtension("WEBGL_lose_context")?.loseContext();
    return cachedCapabilities;
  } catch {
    cachedCapabilities = { supported: false, softwareRenderer: false };
    return cachedCapabilities;
  }
};

export const supportsWebGL = () => inspectWebGL().supported;

export const getQualityPreset = (): QualityPreset => {
  const mobile = matchMedia("(max-width: 720px), (pointer: coarse)").matches;
  const memory = (navigator as NavigatorWithMemory).deviceMemory ?? 8;
  const lowPower =
    memory <= 4 ||
    navigator.hardwareConcurrency <= 4 ||
    inspectWebGL().softwareRenderer;

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
