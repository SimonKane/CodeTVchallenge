export const HERO_INTRO_MOTION = {
  firstFlashAt: 1,
  secondFlashAt: 2.5,
  flashInDuration: 0.06,
  firstFlashOutDuration: 0.2,
  secondFlashOutDuration: 0.9,
  eyebrowFadeDuration: 0.65,
  wordFadeDuration: 0.8,
  wordPause: 0.2,
  textOffset: 10,
} as const;

export const HERO_INTRO_VISUALS = {
  hiddenStreetBrightness: 0.35,
  firstFlashBrightness: 1.65,
  secondFlashBrightness: 1.75,
  visibleStreetBrightness: 0.7,
  firstFlashOpacity: 0.18,
  secondFlashOpacity: 0.22,
  flashDarkness: "rgba(0, 0, 0, 0.15)",
  blackout: "rgba(0, 0, 0, 1)",
  settledDarkness: "rgba(0, 0, 0, 0.45)",
} as const;

export const HERO_CHILD_MOTION = {
  revealDuration: 0.8,
  breathingHalfCycleDuration: 2.5,
  breathingVerticalDistance: 2,
  breathingScaleDelta: 0.005,
} as const;
