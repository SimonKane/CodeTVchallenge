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
  SphereGeometry,
  Texture,
  Vector2,
  Vector3,
  WebGLRenderer,
  BoxGeometry,
  LineBasicMaterial,
  Line,
  BufferGeometry,
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
  uniform float uEditorial;
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
    float streak=sin((vUv.x*1.35+vUv.y)*52.+depth*14.)*.5+.5;
    float editorialMask=smoothstep(.08,.92,uEditorial+streak*.14-vUv.y*.08);
    vec3 editorial=vec3(.035,.026,.023)+vec3(.018,.01,.006)*(1.-vUv.y);
    color=mix(color,editorial,editorialMask*uEditorial);
    gl_FragColor=vec4(color,uVisibility);
  }`;

const childVertex = `
  uniform vec2 uUvScale;
  uniform vec2 uUvOffset;
  varying vec2 vUv;
  varying vec3 vWorld;
  void main(){
    vUv=(uv-.5)*uUvScale+.5+uUvOffset;
    vec4 world=modelMatrix*vec4(position,1.);
    vWorld=world.xyz;
    gl_Position=projectionMatrix*viewMatrix*world;
  }`;

const childFragment = `
  uniform sampler2D uMap;
  uniform float uOpacity;
  uniform float uMaskProgress;
  uniform float uIncoming;
  uniform float uBrightness;
  uniform float uLight;
  uniform float uDebug;
  uniform vec3 uTint;
  uniform vec2 uMaskAnchor;
  varying vec2 vUv;
  varying vec3 vWorld;
  float noise(vec2 p){
    return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);
  }
  void main(){
    vec4 tex=texture2D(uMap,vUv);
    if(tex.a<.018) discard;
    float radius=distance(vWorld.xy,uMaskAnchor);
    float grain=(noise(floor(vWorld.xy*34.))-.5)*.2;
    float threshold=uMaskProgress*3.25-.38;
    float reveal=smoothstep(radius-.16+grain,radius+.16+grain,threshold);
    float mask=mix(1.-reveal,reveal,uIncoming);
    if(uDebug>.5) mask=.5;
    float rim=smoothstep(.34,.02,abs(radius-threshold))*(1.-uDebug);
    vec3 color=tex.rgb*uTint*(uBrightness+uLight*.36)+vec3(.18,.31,.4)*rim*.08;
    float cropFeather=mix(1.,smoothstep(0.,.15,vUv.y)*smoothstep(0.,.055,1.-vUv.y),uIncoming);
    gl_FragColor=vec4(color,tex.a*uOpacity*mask*cropFeather);
  }`;

interface ChildLayout {
  position: [number, number, number];
  size: [number, number];
  rotation: number;
  uvScale: [number, number];
  uvOffset: [number, number];
  brightness: number;
  tint: [number, number, number];
}

const CHILD_LAYOUT = {
  desktop: {
    standing: {
      position: [2, -0.86, -0.15],
      size: [2, 3.53],
      rotation: 0,
      uvScale: [1, 1],
      uvOffset: [0, 0],
      brightness: 0.82,
      tint: [0.76, 0.81, 0.86],
    },
    lookback: {
      position: [1.88, 0.46, -0.14],
      size: [2.17, 1.45],
      rotation: -0.008,
      uvScale: [1, 1],
      uvOffset: [0, 0],
      brightness: 0.82,
      tint: [0.76, 0.81, 0.86],
    },
    anchor: [1.92, 0.74] as [number, number],
  },
  mobile: {
    standing: {
      position: [0.72, -1.03, -0.15],
      size: [1.8, 3.19],
      rotation: 0,
      uvScale: [1, 1],
      uvOffset: [0, 0],
      brightness: 0.84,
      tint: [0.76, 0.81, 0.86],
    },
    lookback: {
      position: [0.6, 0.25, -0.14],
      size: [1.91, 1.28],
      rotation: -0.006,
      uvScale: [1, 1],
      uvOffset: [0, 0],
      brightness: 0.84,
      tint: [0.76, 0.81, 0.86],
    },
    anchor: [0.64, 0.55] as [number, number],
  },
} satisfies Record<string, { standing: ChildLayout; lookback: ChildLayout; anchor: [number, number] }>;

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
  private child?: Mesh<PlaneGeometry, ShaderMaterial>;
  private childLookback?: Mesh<PlaneGeometry, ShaderMaterial>;
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
  private debugGroup?: Group;
  private debugOverlay?: HTMLDivElement;
  private debugEnabled = false;
  private readonly handlePointer = (event: PointerEvent) => {
    this.pointerTarget.set(
      (event.clientX / innerWidth) * 2 - 1,
      -(event.clientY / innerHeight) * 2 + 1,
    );
  };
  private readonly handleDebug = (event: KeyboardEvent) => {
    if (event.key.toLowerCase() !== "d") return;
    this.debugEnabled = !this.debugEnabled;
    if (this.debugGroup) this.debugGroup.visible = this.debugEnabled;
    if (this.debugOverlay)
      this.debugOverlay.style.display = this.debugEnabled ? "block" : "none";
    if (this.child) this.child.material.uniforms.uDebug.value = Number(this.debugEnabled);
    if (this.childLookback)
      this.childLookback.material.uniforms.uDebug.value = Number(this.debugEnabled);
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
    if (import.meta.env.DEV) this.createDebugTools();
  }

  private createChildMaterial(
    map: Texture,
    layout: ChildLayout,
    incoming: boolean,
    anchor: [number, number],
  ) {
    return new ShaderMaterial({
      uniforms: {
        uMap: { value: map },
        uOpacity: { value: 0 },
        uMaskProgress: { value: 0 },
        uIncoming: { value: Number(incoming) },
        uBrightness: { value: layout.brightness },
        uLight: { value: 0 },
        uDebug: { value: 0 },
        uTint: { value: new Color(...layout.tint) },
        uUvScale: { value: new Vector2(...layout.uvScale) },
        uUvOffset: { value: new Vector2(...layout.uvOffset) },
        uMaskAnchor: { value: new Vector2(...anchor) },
      },
      vertexShader: childVertex,
      fragmentShader: childFragment,
      transparent: true,
      depthWrite: false,
    });
  }

  private applyChildLayout(
    mesh: Mesh<PlaneGeometry, ShaderMaterial>,
    layout: ChildLayout,
  ) {
    mesh.position.set(...layout.position);
    mesh.scale.set(layout.size[0], layout.size[1], 1);
    mesh.rotation.z = layout.rotation;
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
        uEditorial: { value: 0 },
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

    const layout = this.quality.mobile ? CHILD_LAYOUT.mobile : CHILD_LAYOUT.desktop;
    const childMaterial = this.createChildMaterial(
      assets.child,
      layout.standing,
      false,
      layout.anchor,
    );
    this.child = new Mesh(new PlaneGeometry(1, 1), childMaterial);
    this.applyChildLayout(this.child, layout.standing);
    this.sceneGroup.add(this.child);

    const lookbackMaterial = this.createChildMaterial(
      assets.childLookback,
      layout.lookback,
      true,
      layout.anchor,
    );
    this.childLookback = new Mesh(new PlaneGeometry(1, 1), lookbackMaterial);
    this.applyChildLayout(this.childLookback, layout.lookback);
    this.childLookback.renderOrder = 1;
    this.sceneGroup.add(this.childLookback);

    const reflectionMaterial = new MeshBasicMaterial({
      map: assets.child,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      color: new Color(0.55, 0.62, 0.67),
    });
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
    const travel = smooth(0, 0.58, this.progress);
    const arrival = smooth(0.58, 0.72, this.progress);
    const mask = smooth(0.72, 0.84, this.progress);
    const editorial = smooth(0.84, 1, this.progress);
    const childX = this.quality.mobile ? 0.72 : 2;
    const startX = this.quality.mobile ? 0.12 : -0.16;
    const closeX = this.quality.mobile ? 0.43 : 1.28;
    const closeZ = this.quality.mobile ? 2.88 : 2.34;
    const editorialX = this.quality.mobile ? 0.82 : 2.42;
    const editorialZ = this.quality.mobile ? 3.35 : 3.62;
    const drift =
      Math.sin(this.progress * Math.PI * 3.4) * 0.11 * travel * (1 - arrival);
    const verticalDrift =
      Math.sin(this.progress * Math.PI * 2.2) * 0.045 * travel * (1 - arrival);

    this.camera.position.x =
      startX + (closeX - startX) * travel + (editorialX - closeX) * editorial + drift;
    this.camera.position.y =
      verticalDrift +
      arrival * (this.quality.mobile ? 0.12 : 0.22) +
      editorial * 0.08;
    this.camera.position.z =
      6 + (closeZ - 6) * travel + (editorialZ - closeZ) * editorial;
    this.camera.fov =
      (this.quality.mobile ? 55 : 47) -
      arrival * (this.quality.mobile ? 3 : 5) +
      editorial * (this.quality.mobile ? 1 : 3);
    this.camera.updateProjectionMatrix();

    const targetBlend = smooth(0.12, 0.7, this.progress);
    const targetX =
      (this.quality.mobile ? 0.25 : 0) +
      (childX - 0.06 - (this.quality.mobile ? 0.25 : 0)) * targetBlend +
      editorial * (this.quality.mobile ? 0.58 : 1.18);
    const targetY = -0.15 + 0.52 * targetBlend + editorial * 0.05;
    const targetZ = -2.3 + 2.15 * targetBlend - editorial * 0.18;
    this.camera.lookAt(targetX, targetY, targetZ);

    if (this.environment) {
      this.environment.material.uniforms.uProgress.value = this.progress;
      this.environment.material.uniforms.uDepthStrength.value =
        0.16 + travel * 0.32 + arrival * 0.13;
      this.environment.material.uniforms.uClose.value = arrival;
      this.environment.material.uniforms.uEditorial.value = editorial;
    }
    this.rain?.setProgress(this.progress);
    this.rain?.setFaceClear(arrival);
    if (this.fog) {
      this.fog.group.position.z = travel * (this.quality.mobile ? 1.15 : 1.65);
      this.fog.group.position.x =
        Math.sin(this.progress * Math.PI * 2.5) * 0.16 * travel;
    }
    this.road?.setProgress(this.progress);
    const warmth = editorial * 0.12;
    this.road?.setWarmth(warmth);
    this.lightning?.set(this.lightning.intensity, warmth);

    const handoff = smooth(0.96, 1, this.progress);
    if (this.child) {
      this.child.material.uniforms.uOpacity.value = this.childVisibility * (1 - handoff);
      this.child.material.uniforms.uMaskProgress.value = mask;
    }
    if (this.childLookback) {
      this.childLookback.material.uniforms.uOpacity.value =
        this.childVisibility * (1 - handoff);
      this.childLookback.material.uniforms.uMaskProgress.value = mask;
      const lookbackLayout = this.quality.mobile
        ? CHILD_LAYOUT.mobile.lookback
        : CHILD_LAYOUT.desktop.lookback;
      this.childLookback.position.set(
        lookbackLayout.position[0] + (1 - mask) * 0.035,
        lookbackLayout.position[1] - (1 - mask) * 0.025,
        lookbackLayout.position[2],
      );
    }
    if (this.debugOverlay && this.debugEnabled)
      this.debugOverlay.textContent =
        `DEV · D toggles\nprogress ${this.progress.toFixed(3)}\ncamera ${this.camera.position
          .toArray()
          .map((number) => number.toFixed(2))
          .join(", ")}\nmask ${mask.toFixed(2)}\nchild safe 30–68%`;
  }

  setLightning(value: number) {
    const warmth = smooth(0.84, 1, this.progress) * 0.12;
    this.lightning?.set(value, warmth);
    if (this.child) this.child.material.uniforms.uLight.value = value;
    if (this.childLookback)
      this.childLookback.material.uniforms.uLight.value = value;
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
    const handoff = smooth(0.96, 1, this.progress);
    if (this.child)
      this.child.material.uniforms.uOpacity.value = value * (1 - handoff);
    if (this.childLookback)
      this.childLookback.material.uniforms.uOpacity.value = value * (1 - handoff);
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
      const layout = this.quality.mobile ? CHILD_LAYOUT.mobile : CHILD_LAYOUT.desktop;
      if (this.child) this.applyChildLayout(this.child, layout.standing);
      if (this.childLookback)
        this.applyChildLayout(this.childLookback, layout.lookback);
      const childX = this.quality.mobile ? 0.72 : 2;
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

  private createDebugTools() {
    const group = new Group();
    const pathGeometry = new BufferGeometry().setFromPoints([
      new Vector3(this.quality.mobile ? 0.12 : -0.16, 0, 6),
      new Vector3(this.quality.mobile ? 0.43 : 1.28, 0.2, this.quality.mobile ? 2.88 : 2.34),
      new Vector3(this.quality.mobile ? 0.82 : 2.42, 0.3, this.quality.mobile ? 3.35 : 3.62),
    ]);
    group.add(new Line(pathGeometry, new LineBasicMaterial({ color: 0x39ffbf })));
    const rainBounds = new Mesh(
      new BoxGeometry(18, 12.6, 18),
      new MeshBasicMaterial({ color: 0x2a7fff, wireframe: true }),
    );
    rainBounds.name = "rain-bounds";
    rainBounds.position.z = this.camera.position.z - 9;
    group.add(rainBounds);
    const layout = this.quality.mobile ? CHILD_LAYOUT.mobile : CHILD_LAYOUT.desktop;
    const anchor = new Mesh(
      new SphereGeometry(0.075, 10, 8),
      new MeshBasicMaterial({ color: 0xff315d }),
    );
    anchor.position.set(layout.anchor[0], layout.anchor[1], 0);
    group.add(anchor);
    group.visible = false;
    this.scene.add(group);
    this.debugGroup = group;

    const overlay = document.createElement("div");
    overlay.setAttribute("aria-hidden", "true");
    overlay.style.cssText =
      "display:none;position:fixed;inset:8% 12%;z-index:99;border:1px solid rgba(57,255,191,.55);padding:8px;color:#8fffd9;background:rgba(0,0,0,.15);font:11px/1.45 monospace;white-space:pre;pointer-events:none";
    this.canvas.parentElement?.append(overlay);
    this.debugOverlay = overlay;
    addEventListener("keydown", this.handleDebug);
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
      this.rain?.update(delta, this.elapsed, this.camera.position.z);
      const bounds = this.debugGroup?.getObjectByName("rain-bounds");
      if (bounds) bounds.position.z = this.camera.position.z - 9;
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
    removeEventListener("keydown", this.handleDebug);
    this.debugOverlay?.remove();
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
