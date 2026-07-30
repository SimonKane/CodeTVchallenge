import {
  AdditiveBlending,
  Mesh,
  PlaneGeometry,
  ShaderMaterial,
} from "three";

const fragmentShader = `
  varying vec2 vUv;
  uniform float uTime;
  uniform float uLightning;
  uniform float uProgress;
  uniform float uWarmth;
  float ring(vec2 uv, vec2 center, float phase) {
    float d = length((uv-center) * vec2(1.8, 1.));
    return smoothstep(.018, .0, abs(d - phase));
  }
  void main() {
    vec2 uv = vUv;
    float streak = pow(max(0., 1. - abs(uv.x-.54)*8.), 5.) *
      (.18 + .82*pow(uv.y, 1.7));
    float broken = .55 + .45*sin(uv.y*145. + sin(uv.x*41.)*3. + uTime*1.8);
    float lamp = streak * broken * (.24 + uProgress*.28 + uLightning*1.15);
    float ripple = 0.;
    ripple += ring(uv, vec2(.28,.34), fract(uTime*.09));
    ripple += ring(uv, vec2(.72,.62), fract(uTime*.075+.42));
    ripple += ring(uv, vec2(.48,.78), fract(uTime*.065+.7));
    float warmPool=smoothstep(.48,.02,length((uv-vec2(.65,.53))*vec2(1.35,.72)));
    vec3 cold = vec3(.28,.58,.76) * (lamp + ripple*.055);
    vec3 warm = vec3(1.,.38,.1) * uWarmth *
      (warmPool*.42 + streak*.72) * broken;
    float alpha = clamp(lamp*.34 + ripple*.04 + uWarmth*warmPool*.2, 0., .58);
    gl_FragColor = vec4(cold + warm, alpha);
  }
`;

export class WetRoad {
  readonly mesh: Mesh;
  readonly material: ShaderMaterial;

  constructor() {
    this.material = new ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uLightning: { value: 0 },
        uProgress: { value: 0 },
        uWarmth: { value: 0 },
      },
      vertexShader:
        "varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}",
      fragmentShader,
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
    });
    this.mesh = new Mesh(new PlaneGeometry(13, 8.5, 1, 32), this.material);
    this.mesh.rotation.x = -Math.PI / 2;
    this.mesh.position.set(0, -2.42, -1.9);
  }

  update(elapsed: number) {
    this.material.uniforms.uTime.value = elapsed;
  }
  setProgress(value: number) {
    this.material.uniforms.uProgress.value = value;
  }
  setLightning(value: number) {
    this.material.uniforms.uLightning.value = value;
  }
  setWarmth(value: number) {
    this.material.uniforms.uWarmth.value = value;
  }
  dispose() {
    this.mesh.geometry.dispose();
    this.material.dispose();
  }
}
