import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Points,
  ShaderMaterial,
  Vector2,
} from "three";

const vertexShader = `
  attribute float aSize;
  attribute float aAlpha;
  varying float vAlpha;
  varying float vWarmth;
  uniform vec2 uPointer;
  uniform float uLightning;
  uniform float uIntensity;
  uniform float uWarmth;
  uniform float uWarmCenter;
  uniform float uFaceClear;
  void main() {
    vec3 p = position;
    float d = distance(p.xy * .24, uPointer);
    p.x += (p.x * .24 - uPointer.x) * smoothstep(.7, 0., d) * .16;
    vec4 mv = modelViewMatrix * vec4(p, 1.);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = clamp(aSize * (280. / -mv.z), 1.2, 19.);
    vAlpha = aAlpha * uIntensity * (.72 + uLightning * 2.2);
    float faceMask=smoothstep(.95,.12,distance(p.xy,vec2(uWarmCenter,.62)));
    vAlpha*=1.-faceMask*uFaceClear*.78;
    vWarmth = uWarmth * smoothstep(2.8, .2, abs(p.x-uWarmCenter)) *
      smoothstep(3.2, .1, abs(p.y+.2));
  }
`;

const fragmentShader = `
  varying float vAlpha;
  varying float vWarmth;
  void main() {
    vec2 p = gl_PointCoord - .5;
    float core = smoothstep(.12, .0, abs(p.x));
    float tail = smoothstep(.52, -.42, p.y);
    float head = smoothstep(.52, .16, p.y);
    float alpha = core * tail * head * vAlpha;
    if (alpha < .015) discard;
    vec3 color=mix(vec3(.68,.86,1.),vec3(1.,.62,.3),vWarmth);
    gl_FragColor = vec4(color, alpha);
  }
`;

export class RainSystem {
  readonly points: Points;
  private readonly positions: Float32Array;
  private readonly speeds: Float32Array;
  private readonly material: ShaderMaterial;
  private progress = 0;
  private time = 0;

  constructor(count: number, warmCenter: number) {
    const geometry = new BufferGeometry();
    this.positions = new Float32Array(count * 3);
    this.speeds = new Float32Array(count);
    const sizes = new Float32Array(count);
    const alphas = new Float32Array(count);

    for (let i = 0; i < count; i += 1) {
      const zone = i % 3;
      const offset = i * 3;
      this.positions[offset] = (Math.random() - 0.5) * 15;
      this.positions[offset + 1] = Math.random() * 11 - 4;
      this.positions[offset + 2] = 3.8 - Math.random() * 12;
      this.speeds[i] = 2.4 + zone * 1.85 + Math.random() * 2.2;
      sizes[i] = 0.07 + zone * 0.04 + Math.random() * 0.06;
      alphas[i] = 0.22 + zone * 0.16 + Math.random() * 0.24;
    }

    geometry.setAttribute("position", new BufferAttribute(this.positions, 3));
    geometry.setAttribute("aSize", new BufferAttribute(sizes, 1));
    geometry.setAttribute("aAlpha", new BufferAttribute(alphas, 1));
    this.material = new ShaderMaterial({
      uniforms: {
        uPointer: { value: new Vector2(20, 20) },
        uLightning: { value: 0 },
        uIntensity: { value: 0.85 },
        uWarmth: { value: 0 },
        uWarmCenter: { value: warmCenter },
        uFaceClear: { value: 0 },
      },
      vertexShader,
      fragmentShader,
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
    });
    this.points = new Points(geometry, this.material);
    this.points.frustumCulled = false;
  }

  setProgress(progress: number) {
    this.progress = progress;
    this.material.uniforms.uIntensity.value = 0.82 + progress * 0.38;
  }

  setLightning(value: number) {
    this.material.uniforms.uLightning.value = value;
  }

  setWarmth(value: number) {
    this.material.uniforms.uWarmth.value = value;
  }

  setFaceClear(value: number) {
    this.material.uniforms.uFaceClear.value = value;
  }

  setPointer(pointer: Vector2) {
    this.material.uniforms.uPointer.value.copy(pointer);
  }

  update(delta: number, elapsed: number) {
    this.time += delta;
    const wind = Math.sin(elapsed * 0.38) * 0.32 + 0.18 + this.progress * 0.12;
    for (let i = 0; i < this.speeds.length; i += 1) {
      const offset = i * 3;
      const zBoost = 1 + Math.max(0, this.positions[offset + 2]) * 0.045;
      this.positions[offset + 1] -=
        this.speeds[i] * delta * zBoost * (1 + this.progress * 0.32);
      this.positions[offset] += wind * delta * zBoost;
      if (this.positions[offset + 1] < -4.2) {
        this.positions[offset + 1] = 6.4 + Math.random() * 2;
        this.positions[offset] = (Math.random() - 0.5) * 15;
      }
      if (this.positions[offset] > 8) this.positions[offset] = -8;
    }
    (this.points.geometry.getAttribute("position") as BufferAttribute).needsUpdate =
      true;
  }

  dispose() {
    this.points.geometry.dispose();
    this.material.dispose();
  }
}
