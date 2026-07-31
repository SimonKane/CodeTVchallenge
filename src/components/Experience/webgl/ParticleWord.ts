import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Points,
  ShaderMaterial,
} from "three";

const smooth = (edge0: number, edge1: number, value: number) => {
  const x = Math.min(1, Math.max(0, (value - edge0) / (edge1 - edge0)));
  return x * x * (3 - 2 * x);
};

const shader = {
  vertex: `
    attribute float aSeed;
    varying float vSeed;
    uniform float uSize;
    void main(){
      vSeed=aSeed;
      vec4 mv=modelViewMatrix*vec4(position,1.);
      gl_Position=projectionMatrix*mv;
      gl_PointSize=clamp(uSize*(280./-mv.z)*(0.7+aSeed*.6),2.,13.);
    }`,
  fragment: `
    varying float vSeed;
    uniform float uOpacity;
    uniform float uLightning;
    uniform float uWarmth;
    void main(){
      float d=length(gl_PointCoord-.5);
      float a=smoothstep(.5,.08,d)*uOpacity;
      if(a<.02)discard;
      vec3 cold=mix(vec3(.42,.82,1.15),vec3(1.,1.18,1.28),vSeed);
      vec3 warm=vec3(1.,.55,.2);
      gl_FragColor=vec4(mix(cold,warm,uWarmth)*(1.12+uLightning*1.75),a);
    }`,
};

export class ParticleWord {
  readonly points: Points;
  private readonly positions: Float32Array;
  private readonly origins: Float32Array;
  private readonly word: Float32Array;
  private readonly umbrella: Float32Array;
  private readonly seeds: Float32Array;
  private readonly material: ShaderMaterial;
  private progress = 0;

  constructor(count: number, mobile: boolean) {
    const geometry = new BufferGeometry();
    this.positions = new Float32Array(count * 3);
    this.origins = new Float32Array(count * 3);
    this.word = new Float32Array(count * 3);
    this.umbrella = new Float32Array(count * 3);
    this.seeds = new Float32Array(count);
    const wordSamples = this.createWordSamples();

    for (let i = 0; i < count; i += 1) {
      const offset = i * 3;
      const source = wordSamples[Math.floor((i / count) * wordSamples.length)];
      this.origins[offset] = (Math.random() - 0.5) * (mobile ? 7 : 10);
      this.origins[offset + 1] = Math.random() * 8 - 2.5;
      this.origins[offset + 2] = Math.random() * 4 - 1;
      const wordScale = mobile ? 4.95 : 5.9;
      this.word[offset] =
        (source[0] - 0.5) * wordScale + (mobile ? -0.08 : -0.28);
      this.word[offset + 1] =
        (0.5 - source[1]) * (mobile ? 1.32 : 1.5) + 0.5;
      this.word[offset + 2] =
        (mobile ? 0.45 : 0.6) + (Math.random() - 0.5) * 0.035;

      this.createUmbrellaTarget(i, count, mobile, offset);
      this.seeds[i] = Math.random();
    }

    this.positions.set(this.origins);
    geometry.setAttribute("position", new BufferAttribute(this.positions, 3));
    geometry.setAttribute("aSeed", new BufferAttribute(this.seeds, 1));
    this.material = new ShaderMaterial({
      uniforms: {
        uSize: { value: mobile ? 0.064 : 0.058 },
        uOpacity: { value: 0 },
        uLightning: { value: 0 },
        uWarmth: { value: 0 },
      },
      vertexShader: shader.vertex,
      fragmentShader: shader.fragment,
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
    });
    this.points = new Points(geometry, this.material);
    this.points.frustumCulled = false;
  }

  private createWordSamples() {
    const canvas = document.createElement("canvas");
    canvas.width = 920;
    canvas.height = 220;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) return [[0.5, 0.5]];
    context.fillStyle = "#fff";
    context.font = "900 158px Arial Black, Arial, sans-serif";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.lineWidth = 5;
    context.strokeStyle = "#fff";
    context.strokeText("HELP", canvas.width / 2, canvas.height / 2 + 5);
    context.fillText("HELP", canvas.width / 2, canvas.height / 2 + 5);
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    const samples: number[][] = [];
    for (let y = 0; y < canvas.height; y += 3) {
      for (let x = 0; x < canvas.width; x += 3) {
        if (pixels[(y * canvas.width + x) * 4 + 3] > 100) {
          samples.push([x / canvas.width, y / canvas.height]);
        }
      }
    }
    return samples;
  }

  private createUmbrellaTarget(
    index: number,
    count: number,
    mobile: boolean,
    offset: number,
  ) {
    const t = index / count;
    const centerX = mobile ? 0.68 : 1.82;
    const halfWidth = mobile ? 1.82 : 2.18;
    const baseY = mobile ? 0.92 : 1;
    let x = centerX;
    let y = baseY;

    if (t < 0.42) {
      // Upper canopy: a broad curve with an unmistakable center peak.
      const u = t / 0.42;
      const nx = u * 2 - 1;
      x = centerX + nx * halfWidth;
      y = baseY + (mobile ? 0.68 : 0.82) * (1 - Math.pow(Math.abs(nx), 1.45));
    } else if (t < 0.62) {
      // Scalloped lower canopy edge.
      const u = (t - 0.42) / 0.2;
      const nx = u * 2 - 1;
      x = centerX + nx * halfWidth;
      y = baseY + 0.14 + Math.abs(Math.sin(u * Math.PI * 4)) * 0.16;
    } else if (t < 0.82) {
      // Five structural ribs from the peak to the canopy edge.
      const local = (t - 0.62) / 0.2;
      const ribIndex = Math.min(4, Math.floor(local * 5));
      const along = (local * 5) % 1;
      const nx = (ribIndex / 4) * 2 - 1;
      const endX = centerX + nx * halfWidth * 0.92;
      const endY = baseY + 0.14 + Math.abs(Math.sin((nx + 1) * Math.PI)) * 0.1;
      x = centerX + (endX - centerX) * along;
      y = baseY + 0.8 + (endY - (baseY + 0.8)) * along;
    } else if (t < 0.95) {
      // Dense vertical shaft.
      const along = (t - 0.82) / 0.13;
      x = centerX;
      y = baseY + 0.76 - along * (mobile ? 2.62 : 2.82);
    } else {
      // Hook handle.
      const along = (t - 0.95) / 0.05;
      const angle = Math.PI + along * Math.PI;
      x = centerX + Math.sin(angle) * (mobile ? 0.22 : 0.28);
      y = baseY - (mobile ? 1.86 : 2.01) + Math.cos(angle) * 0.26;
    }

    this.umbrella[offset] = x + (Math.random() - 0.5) * 0.025;
    this.umbrella[offset + 1] = y + (Math.random() - 0.5) * 0.025;
    this.umbrella[offset + 2] = 0.08 + (Math.random() - 0.5) * 0.06;
  }

  setProgress(progress: number) {
    this.progress = progress;
    const form = smooth(0.45, 0.675, progress);
    const canopy = smooth(0.76, 0.92, progress);
    this.material.uniforms.uOpacity.value =
      smooth(0.445, 0.51, progress);
    this.material.uniforms.uWarmth.value = smooth(0.9, 0.96, progress);

    for (let i = 0; i < this.positions.length; i += 3) {
      const fall = Math.sin(i * 12.31) * (1 - form) * 0.025;
      const wordX = this.origins[i] + (this.word[i] - this.origins[i]) * form;
      const wordY =
        this.origins[i + 1] +
        (this.word[i + 1] - this.origins[i + 1]) * form +
        fall;
      const wordZ =
        this.origins[i + 2] + (this.word[i + 2] - this.origins[i + 2]) * form;
      this.positions[i] = wordX + (this.umbrella[i] - wordX) * canopy;
      this.positions[i + 1] =
        wordY +
        (this.umbrella[i + 1] - wordY) * canopy +
        Math.sin(canopy * Math.PI) *
          (0.28 + this.seeds[i / 3] * 0.34);
      this.positions[i + 2] =
        wordZ + (this.umbrella[i + 2] - wordZ) * canopy;
    }
    (this.points.geometry.getAttribute("position") as BufferAttribute).needsUpdate =
      true;
  }

  setLightning(value: number) {
    this.material.uniforms.uLightning.value = value;
  }
  get warmth() {
    return smooth(0.9, 0.96, this.progress);
  }
  get wordBloom() {
    return (
      smooth(0.655, 0.685, this.progress) *
      (1 - smooth(0.755, 0.78, this.progress))
    );
  }
  dispose() {
    this.points.geometry.dispose();
    this.material.dispose();
  }
}
