import type { Camera, Scene, WebGLRenderer } from "three";
import {
  BlendFunction,
  BloomEffect,
  EffectComposer,
  EffectPass,
  NoiseEffect,
  RenderPass,
  ToneMappingEffect,
  ToneMappingMode,
  VignetteEffect,
} from "postprocessing";

export class PostProcessing {
  private readonly composer?: EffectComposer;
  private readonly bloom?: BloomEffect;
  private lightning = 0;
  private formationBloom = 0;

  constructor(
    private readonly renderer: WebGLRenderer,
    private readonly scene: Scene,
    private readonly camera: Camera,
    enabled: boolean,
  ) {
    if (!enabled) return;
    this.composer = new EffectComposer(renderer, { multisampling: 0 });
    this.composer.addPass(new RenderPass(scene, camera));
    this.bloom = new BloomEffect({
      intensity: 0.48,
      luminanceThreshold: 0.56,
      luminanceSmoothing: 0.28,
      mipmapBlur: true,
    });
    this.composer.addPass(
      new EffectPass(
        camera,
        new ToneMappingEffect({ mode: ToneMappingMode.ACES_FILMIC }),
        this.bloom,
        new VignetteEffect({ darkness: 0.58, offset: 0.23 }),
        new NoiseEffect({
          blendFunction: BlendFunction.SOFT_LIGHT,
          premultiply: true,
        }),
      ),
    );
  }

  setLightning(value: number) {
    this.lightning = value;
    this.renderBloom();
  }
  setFormationBloom(value: number) {
    this.formationBloom = value;
    this.renderBloom();
  }
  private renderBloom() {
    if (this.bloom) {
      this.bloom.intensity =
        0.48 + this.lightning * 1.05 + this.formationBloom * 0.34;
    }
  }
  setSize(width: number, height: number) {
    this.composer?.setSize(width, height);
  }
  render(delta: number) {
    if (this.composer) this.composer.render(delta);
    else this.renderer.render(this.scene, this.camera);
  }
  dispose() {
    this.composer?.dispose();
  }
}
