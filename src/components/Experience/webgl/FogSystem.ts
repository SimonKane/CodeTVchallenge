import {
  AdditiveBlending,
  Group,
  Mesh,
  PlaneGeometry,
  ShaderMaterial,
  Vector2,
} from "three";

const fragmentShader = `
  varying vec2 vUv;
  uniform float uTime;
  uniform float uLightning;
  uniform float uLayer;
  uniform vec2 uPointer;
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3. - 2. * f);
    return mix(mix(hash(i), hash(i + vec2(1,0)), f.x),
      mix(hash(i + vec2(0,1)), hash(i + vec2(1,1)), f.x), f.y);
  }
  void main() {
    vec2 uv = vUv;
    uv.x += uPointer.x * .012 * (uLayer + 1.);
    float n = noise(uv * vec2(3.2, 2.) + vec2(uTime * (.025 + uLayer*.008), uLayer*4.));
    n += noise(uv * 7. - vec2(uTime*.018, 0.)) * .42;
    float horizon = smoothstep(.02, .72, uv.y) * smoothstep(1., .44, uv.y);
    float alpha = smoothstep(.58, 1.22, n) * horizon * (.07 + uLightning*.12);
    gl_FragColor = vec4(.44 + uLightning*.18, .62 + uLightning*.16, .72 + uLightning*.2, alpha);
  }
`;

export class FogSystem {
  readonly group = new Group();
  private materials: ShaderMaterial[] = [];

  constructor(layers: number) {
    for (let i = 0; i < layers; i += 1) {
      const material = new ShaderMaterial({
        uniforms: {
          uTime: { value: 0 },
          uLightning: { value: 0 },
          uLayer: { value: i / Math.max(1, layers - 1) },
          uPointer: { value: new Vector2() },
        },
        vertexShader:
          "varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}",
        fragmentShader,
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
      });
      const mesh = new Mesh(new PlaneGeometry(15, 8.8), material);
      mesh.position.set((i % 2 ? 1 : -1) * 0.4, -0.35, 1.2 - i * 1.55);
      this.group.add(mesh);
      this.materials.push(material);
    }
  }

  update(elapsed: number) {
    this.materials.forEach((material) => (material.uniforms.uTime.value = elapsed));
  }

  setLightning(value: number) {
    this.materials.forEach(
      (material) => (material.uniforms.uLightning.value = value),
    );
  }

  setPointer(pointer: Vector2) {
    this.materials.forEach((material) =>
      material.uniforms.uPointer.value.copy(pointer),
    );
  }

  dispose() {
    this.group.children.forEach((child) => {
      if (child instanceof Mesh) child.geometry.dispose();
    });
    this.materials.forEach((material) => material.dispose());
  }
}
