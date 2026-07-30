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
  const lowPower = memory <= 4 || navigator.hardwareConcurrency <= 4;

  return {
    mobile,
    lowPower,
    pixelRatio: Math.min(devicePixelRatio || 1, mobile || lowPower ? 1.25 : 1.7),
    rainCount: mobile ? 950 : lowPower ? 1450 : 2400,
    wordParticles: mobile ? 820 : 1440,
    fogLayers: mobile ? 3 : 5,
    postProcessing: !lowPower && !mobile,
  };
};
