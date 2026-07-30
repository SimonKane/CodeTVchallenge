import {
  AdditiveBlending,
  AmbientLight,
  Color,
  DirectionalLight,
  DoubleSide,
  Group,
  LinearFilter,
  Mesh,
  MeshBasicMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  PointLight,
  Scene,
  ShaderMaterial,
  Texture,
  Vector2,
  WebGLRenderer,
} from "three";
import type { QualityPreset } from "./QualityManager";
import { loadExperienceAssets, type ExperienceAssets } from "./AssetLoader";
import { FogSystem } from "./FogSystem";
import { LightningSystem } from "./LightningSystem";
import { PostProcessing } from "./PostProcessing";
import { RainSystem } from "./RainSystem";
import { WetRoad } from "./WetRoad";

interface SceneOptions {
  canvas: HTMLCanvasElement;
  streetUrl: string;
  depthUrl: string;
  childUrl: string;
  childLookbackUrl: string;
  quality: QualityPreset;
}

const smooth = (start: number, end: number, value: number) => {
  const t = Math.min(1, Math.max(0, (value - start) / (end - start)));
  return t * t * (3 - 2 * t);
};

const environmentVertex = `
  uniform sampler2D uDepth;
  uniform float uDepthStrength;
  uniform vec2 uParallax;
  varying vec2 vUv;
  void main(){
    vUv=uv;
    float depth=texture2D(uDepth,uv).r;
    vec3 p=position;
    p.z+=(depth-.45)*uDepthStrength;
    p.xy+=uParallax*(depth-.35);
    gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);
  }`;

const environmentFragment = `
  uniform sampler2D uStreet;
  uniform sampler2D uDepth;
  uniform float uVisibility;
  uniform float uLightning;
  uniform float uProgress;
  uniform float uClose;
  uniform float uTextureAspect;
  uniform float uViewportAspect;
  varying vec2 vUv;
  vec2 cover(vec2 uv){
    float ratio=uViewportAspect/uTextureAspect;
    if(ratio>1.) uv.y=(uv.y-.5)/ratio+.5;
    else uv.x=(uv.x-.5)*ratio+.5;
    return uv;
  }
  void main(){
    vec2 uv=cover(vUv);
    float depth=texture2D(uDepth,uv).r;
    vec2 drift=vec2((depth-.4)*uProgress*.008, sin(uv.y*10.)*uProgress*.0015);
    vec3 color=texture2D(uStreet,uv+drift).rgb;
    color*=.94 + uLightning*.92;
    color+=vec3(.08,.17,.24)*depth*(.08+uProgress*.08);
    float edge=smoothstep(.34,.78,length(vUv-.5)*1.5);
    color*=1.-edge*uClose*.46;
    gl_FragColor=vec4(color,uVisibility);
  }`;

const coneFragment = `
  varying vec2 vUv;
  uniform float uLightning;
  void main(){
    float halfWidth=mix(.48,.06,vUv.y);
    float side=smoothstep(halfWidth,halfWidth*.58,abs(vUv.x-.5));
    float fade=smoothstep(0.,.18,vUv.y)*(1.-vUv.y);
    gl_FragColor=vec4(.48,.72,.9,side*fade*(.012+uLightning*.025));
  }`;

export class ExperienceScene {
  readonly renderer: WebGLRenderer;
  readonly scene = new Scene();
  readonly camera = new PerspectiveCamera(47, 1, 0.1, 40);
  private elapsed = 0;
  private previousTime = 0;
  private readonly pointer = new Vector2();
  private readonly pointerTarget = new Vector2();
  private readonly quality: QualityPreset;
  private readonly canvas: HTMLCanvasElement;
  private assets?: ExperienceAssets;
  private post?: PostProcessing;
  private rain?: RainSystem;
  private fog?: FogSystem;
  private road?: WetRoad;
  private lightning?: LightningSystem;
  private environment?: Mesh<PlaneGeometry, ShaderMaterial>;
  private child?: Mesh<PlaneGeometry, MeshBasicMaterial>;
  private childLookback?: Mesh<PlaneGeometry, MeshBasicMaterial>;
  private childReflection?: Mesh<PlaneGeometry, MeshBasicMaterial>;
  private childShadow?: Mesh<PlaneGeometry, MeshBasicMaterial>;
  private lampCone?: Mesh<PlaneGeometry, ShaderMaterial>;
  private shadowTexture?: Texture;
  private sceneGroup = new Group();
  private animationFrame?: number;
  private running = false;
  private progress = 0;
  private environmentVisibility = 0;
  private childVisibility = 0;
  private readonly handlePointer = (event: PointerEvent) => {
    this.pointerTarget.set(
      (event.clientX / innerWidth) * 2 - 1,
      -(event.clientY / innerHeight) * 2 + 1,
    );
  };

  constructor(private readonly options: SceneOptions) {
    this.canvas = options.canvas;
    this.quality = options.quality;
    this.renderer = new WebGLRenderer({
      canvas: options.canvas,
      antialias: !options.quality.mobile,
      powerPreference: "high-performance",
      alpha: false,
    });
    this.renderer.setPixelRatio(options.quality.pixelRatio);
    this.renderer.setClearColor(0x010304, 1);
    this.renderer.outputColorSpace = "srgb";
    this.camera.position.set(0, 0, 6);
    this.scene.background = new Color(0x010304);
    this.scene.add(this.sceneGroup);
  }

  async init() {
    this.assets = await loadExperienceAssets(
      this.options.streetUrl,
      this.options.depthUrl,
      this.options.childUrl,
      this.options.childLookbackUrl,
    );
    this.createWorld(this.assets);
    this.resize();
    if (!this.quality.mobile && matchMedia("(pointer: fine)").matches) {
      addEventListener("pointermove", this.handlePointer, { passive: true });
    }
  }

  private createWorld(assets: ExperienceAssets) {
    const environmentMaterial = new ShaderMaterial({
      uniforms: {
        uStreet: { value: assets.street },
        uDepth: { value: assets.depth },
        uDepthStrength: { value: 0.16 },
        uParallax: { value: new Vector2() },
        uVisibility: { value: 0 },
        uLightning: { value: 0 },
        uProgress: { value: 0 },
        uClose: { value: 0 },
        uTextureAspect: { value: 1.5 },
        uViewportAspect: { value: 1 },
      },
      vertexShader: environmentVertex,
      fragmentShader: environmentFragment,
      transparent: true,
    });
    this.environment = new Mesh(
      new PlaneGeometry(1, 1, 96, 64),
      environmentMaterial,
    );
    this.environment.position.z = -4;
    this.sceneGroup.add(this.environment);

    const childMaterial = new MeshBasicMaterial({
      map: assets.child,
      transparent: true,
      alphaTest: 0.02,
      opacity: 0,
      color: new Color(0.72, 0.76, 0.8),
    });
    this.child = new Mesh(new PlaneGeometry(2.35, 4.15), childMaterial);
    this.child.position.set(2, -0.55, -0.15);
    this.sceneGroup.add(this.child);

    const lookbackMaterial = new MeshBasicMaterial({
      map: assets.childLookback,
      transparent: true,
      alphaTest: 0.02,
      opacity: 0,
      depthWrite: false,
      color: new Color(0.72, 0.76, 0.8),
    });
    this.childLookback = new Mesh(
      new PlaneGeometry(2.55, 1.7),
      lookbackMaterial,
    );
    this.childLookback.position.set(1.88, 0.58, -0.14);
    this.childLookback.renderOrder = 1;
    this.sceneGroup.add(this.childLookback);

    const reflectionMaterial = childMaterial.clone();
    reflectionMaterial.opacity = 0;
    reflectionMaterial.depthWrite = false;
    this.childReflection = new Mesh(
      new PlaneGeometry(2.05, 2.6),
      reflectionMaterial,
    );
    this.childReflection.scale.y = -1;
    this.childReflection.position.set(2, -3.25, -0.42);
    this.sceneGroup.add(this.childReflection);

    const shadowTexture = this.createShadowTexture();
    this.shadowTexture = shadowTexture;
    this.childShadow = new Mesh(
      new PlaneGeometry(2.3, 1),
      new MeshBasicMaterial({
        map: shadowTexture,
        transparent: true,
        opacity: 0.62,
        depthWrite: false,
      }),
    );
    this.childShadow.rotation.x = -Math.PI / 2;
    this.childShadow.position.set(2, -2.38, -0.05);
    this.sceneGroup.add(this.childShadow);

    this.rain = new RainSystem(
      this.quality.rainCount,
      this.quality.mobile ? 0.7 : 1.9,
    );
    this.fog = new FogSystem(this.quality.fogLayers);
    this.road = new WetRoad();
    this.sceneGroup.add(
      this.road.mesh,
      this.fog.group,
      this.rain.points,
    );

    const ambient = new AmbientLight(0x92b5ca, 0.09);
    const directional = new DirectionalLight(0xc8e7ff, 0.18);
    directional.position.set(-3, 6, 4);
    const lamp = new PointLight(0x8fcfff, 8, 9, 1.5);
    lamp.position.set(2.75, 2.15, -1.6);
    const warmLight = new PointLight(0xff8a38, 0, 7, 1.8);
    warmLight.position.set(this.quality.mobile ? 0.7 : 1.9, 0.1, 0.4);
    this.scene.add(ambient, directional, lamp, warmLight);

    const coneMaterial = new ShaderMaterial({
      uniforms: { uLightning: { value: 0 } },
      vertexShader:
        "varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}",
      fragmentShader: coneFragment,
      transparent: true,
      depthWrite: false,
      side: DoubleSide,
      blending: AdditiveBlending,
    });
    this.lampCone = new Mesh(new PlaneGeometry(3.4, 5.2), coneMaterial);
    this.lampCone.position.set(2.72, -0.3, -1.8);
    this.scene.add(this.lampCone);

    this.post = new PostProcessing(
      this.renderer,
      this.scene,
      this.camera,
      this.quality.postProcessing,
    );
    this.lightning = new LightningSystem({
      renderer: this.renderer,
      ambient,
      directional,
      lamp,
      warmLight,
      childMaterials: [childMaterial, lookbackMaterial],
      fog: this.fog,
      rain: this.rain,
      road: this.road,
      post: this.post,
    });
    this.lightning.set(0);
  }

  private createShadowTexture() {
    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 128;
    const context = canvas.getContext("2d");
    if (context) {
      const gradient = context.createRadialGradient(128, 64, 8, 128, 64, 105);
      gradient.addColorStop(0, "rgba(0,0,0,.9)");
      gradient.addColorStop(1, "rgba(0,0,0,0)");
      context.fillStyle = gradient;
      context.fillRect(0, 0, 256, 128);
    }
    const texture = new Texture(canvas);
    texture.needsUpdate = true;
    texture.minFilter = LinearFilter;
    return texture;
  }

  setProgress(value: number) {
    this.progress = Math.min(1, Math.max(0, value));
    const distance = smooth(0, 0.25, this.progress);
    const approach = smooth(0.25, 0.6, this.progress);
    const close = smooth(0.6, 0.78, this.progress);
    const lookback = smooth(0.78, 0.92, this.progress);
    const childX = this.quality.mobile ? 0.72 : 2;
    const startX = this.quality.mobile ? 0.12 : -0.16;
    const finalX = this.quality.mobile ? 0.46 : 1.28;
    const finalZ = this.quality.mobile ? 2.82 : 2.34;
    const travel =
      distance * 0.18 + approach * 0.5 + close * 0.24 + lookback * 0.08;

    this.camera.position.x = startX + (finalX - startX) * travel;
    this.camera.position.y = close * 0.2 + lookback * 0.04;
    this.camera.position.z = 6 + (finalZ - 6) * travel;
    this.camera.fov =
      (this.quality.mobile ? 55 : 47) - close * (this.quality.mobile ? 3 : 5);
    this.camera.updateProjectionMatrix();

    const targetBlend = smooth(0.18, 0.72, this.progress);
    const targetX =
      (this.quality.mobile ? 0.25 : 0) +
      (childX - 0.06 - (this.quality.mobile ? 0.25 : 0)) * targetBlend;
    const targetY = -0.15 + 0.52 * targetBlend;
    const targetZ = -2.3 + 2.15 * targetBlend;
    this.camera.lookAt(targetX, targetY, targetZ);

    if (this.environment) {
      this.environment.material.uniforms.uProgress.value = this.progress;
      this.environment.material.uniforms.uDepthStrength.value =
        0.16 + approach * 0.3 + close * 0.14;
      this.environment.material.uniforms.uClose.value = close;
    }
    this.rain?.setProgress(this.progress);
    this.rain?.setFaceClear(close);
    this.road?.setProgress(this.progress);
    const warmth = smooth(0.62, 0.9, this.progress) * 0.22;
    this.road?.setWarmth(warmth);
    this.lightning?.set(this.lightning.intensity, warmth);

    const lookFade = smooth(0.78, 0.92, this.progress);
    const distantFade = smooth(0.8, 0.92, this.progress);
    if (this.child) {
      this.child.material.opacity = this.childVisibility * (1 - distantFade);
    }
    if (this.childLookback) {
      const lookbackX = childX - 0.12;
      const lookbackY = this.quality.mobile ? 0.36 : 0.58;
      this.childLookback.material.opacity = this.childVisibility * lookFade;
      this.childLookback.position.set(
        lookbackX + (1 - lookFade) * 0.025,
        lookbackY - (1 - lookFade) * 0.02,
        -0.14,
      );
    }
  }

  setLightning(value: number) {
    const warmth = smooth(0.62, 0.9, this.progress) * 0.22;
    this.lightning?.set(value, warmth);
    if (this.environment)
      this.environment.material.uniforms.uLightning.value = value;
    if (this.lampCone)
      this.lampCone.material.uniforms.uLightning.value = value;
  }

  setEnvironmentVisibility(value: number) {
    this.environmentVisibility = value;
    if (this.environment)
      this.environment.material.uniforms.uVisibility.value = value;
  }

  setChildVisibility(value: number) {
    this.childVisibility = value;
    const lookFade = smooth(0.78, 0.92, this.progress);
    const distantFade = smooth(0.8, 0.92, this.progress);
    if (this.child) this.child.material.opacity = value * (1 - distantFade);
    if (this.childLookback)
      this.childLookback.material.opacity = value * lookFade;
    if (this.childReflection)
      this.childReflection.material.opacity = value * 0.11;
  }

  resize() {
    const width = Math.max(1, this.canvas.clientWidth);
    const height = Math.max(1, this.canvas.clientHeight);
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.fov = this.quality.mobile ? 55 : 47;
    this.camera.updateProjectionMatrix();
    if (this.environment) {
      const distance = this.camera.position.z - this.environment.position.z;
      const visibleHeight = 2 * Math.tan((this.camera.fov * Math.PI) / 360) * distance;
      this.environment.scale.set(visibleHeight * this.camera.aspect, visibleHeight, 1);
      this.environment.material.uniforms.uViewportAspect.value = this.camera.aspect;
      const childX = this.quality.mobile ? 0.72 : 2;
      this.child?.position.set(childX, this.quality.mobile ? -0.75 : -0.55, -0.15);
      this.childLookback?.position.set(
        childX - 0.12,
        this.quality.mobile ? 0.36 : 0.58,
        -0.14,
      );
      this.childReflection?.position.set(
        childX,
        this.quality.mobile ? -3.42 : -3.25,
        -0.42,
      );
      this.childShadow?.position.set(
        childX,
        this.quality.mobile ? -2.57 : -2.38,
        -0.05,
      );
    }
    this.post?.setSize(width, height);
  }

  start() {
    if (this.running || document.hidden) return;
    this.running = true;
    this.previousTime = 0;
    const tick = (time: number) => {
      if (!this.running) return;
      const seconds = time * 0.001;
      const delta = Math.min(0.04, this.previousTime ? seconds - this.previousTime : 0);
      this.previousTime = seconds;
      this.elapsed += delta;
      this.pointer.lerp(this.pointerTarget, 0.045);
      this.rain?.setPointer(this.pointer);
      this.fog?.setPointer(this.pointer);
      this.rain?.update(delta, this.elapsed);
      this.fog?.update(this.elapsed);
      this.road?.update(this.elapsed);
      if (this.environment) {
        this.environment.material.uniforms.uParallax.value.set(
          this.pointer.x * 0.055 + this.progress * 0.08,
          this.pointer.y * 0.025,
        );
      }
      this.post?.render(delta);
      this.animationFrame = requestAnimationFrame(tick);
    };
    this.animationFrame = requestAnimationFrame(tick);
  }

  pause() {
    this.running = false;
    if (this.animationFrame !== undefined) cancelAnimationFrame(this.animationFrame);
    this.animationFrame = undefined;
  }

  dispose() {
    this.pause();
    removeEventListener("pointermove", this.handlePointer);
    this.rain?.dispose();
    this.fog?.dispose();
    this.road?.dispose();
    this.post?.dispose();
    this.scene.traverse((object) => {
      if (object instanceof Mesh) {
        object.geometry.dispose();
        const materials = Array.isArray(object.material)
          ? object.material
          : [object.material];
        materials.forEach((material) => material.dispose());
      }
    });
    this.assets &&
      Object.values(this.assets).forEach((texture) => texture.dispose());
    this.shadowTexture?.dispose();
    this.renderer.dispose();
  }
}
