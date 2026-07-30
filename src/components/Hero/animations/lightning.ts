import type { gsap } from "gsap";

export interface LightningElements {
  street: HTMLElement;
  darkness: HTMLElement;
  flash: HTMLElement;
}

interface LightningOptions {
  at: number;
  flashInDuration: number;
  flashOutDuration: number;
  flashOpacity: number;
  peakBrightness: number;
  endBrightness: number;
  peakDarkness: string;
  endDarkness: string;
  hideStreetAfterFlash?: boolean;
}

/**
 * Adds one lightning strike to an existing timeline so the complete intro
 * remains controlled by a single GSAP Timeline.
 */
export const addLightningFlash = (
  timeline: gsap.core.Timeline,
  elements: LightningElements,
  options: LightningOptions,
) => {
  const { street, darkness, flash } = elements;
  const releaseAt = options.at + options.flashInDuration;

  timeline
    // Reveal and illuminate the street at the instant the lightning arrives.
    .set(street, { opacity: 1 }, options.at)
    .to(
      street,
      {
        filter: `brightness(${options.peakBrightness})`,
        duration: options.flashInDuration,
      },
      options.at,
    )
    .to(
      darkness,
      {
        backgroundColor: options.peakDarkness,
        duration: options.flashInDuration,
      },
      options.at,
    )
    .to(
      flash,
      {
        opacity: options.flashOpacity,
        duration: options.flashInDuration,
      },
      options.at,
    )
    // Let the lightning fall away into either blackout or the settled scene.
    .to(
      flash,
      {
        opacity: 0,
        duration: options.flashOutDuration,
      },
      releaseAt,
    )
    .to(
      street,
      {
        filter: `brightness(${options.endBrightness})`,
        duration: options.flashOutDuration,
      },
      releaseAt,
    )
    .to(
      darkness,
      {
        backgroundColor: options.endDarkness,
        duration: options.flashOutDuration,
      },
      releaseAt,
    );

  if (options.hideStreetAfterFlash) {
    timeline.set(
      street,
      { opacity: 0 },
      releaseAt + options.flashOutDuration,
    );
  }
};
