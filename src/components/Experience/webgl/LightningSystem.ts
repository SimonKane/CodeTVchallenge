import type {
  AmbientLight,
  DirectionalLight,
  PointLight,
  WebGLRenderer,
} from "three";
import type { FogSystem } from "./FogSystem";
import type { PostProcessing } from "./PostProcessing";
import type { RainSystem } from "./RainSystem";
import type { WetRoad } from "./WetRoad";

interface LightningTargets {
  renderer: WebGLRenderer;
  ambient: AmbientLight;
  directional: DirectionalLight;
  lamp: PointLight;
  warmLight: PointLight;
  fog: FogSystem;
  rain: RainSystem;
  road: WetRoad;
  post: PostProcessing;
}

export class LightningSystem {
  private value = 0;

  constructor(private readonly targets: LightningTargets) {}

  set(value: number, warmth = 0) {
    this.value = Math.min(1, Math.max(0, value));
    const {
      renderer,
      ambient,
      directional,
      lamp,
      warmLight,
    } = this.targets;
    renderer.toneMappingExposure = 0.82 + this.value * 0.8;
    ambient.intensity = 0.14 + this.value * 0.7;
    directional.intensity = 0.24 + this.value * 3.64;
    lamp.intensity = 8 + this.value * 16;
    warmLight.intensity = warmth * 4.5;
    this.targets.fog.setLightning(this.value);
    this.targets.rain.setLightning(this.value);
    this.targets.road.setLightning(this.value);
    this.targets.post.setLightning(this.value);
  }

  get intensity() {
    return this.value;
  }
}
