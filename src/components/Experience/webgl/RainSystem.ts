import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Points,
  ShaderMaterial,
  Vector2,
} from "three";

const NEAR_DEPTH = 0.34;
const FAR_DEPTH = 18;
const HALF_WIDTH = 9;
const BOTTOM = -5.6;
const TOP = 7;

const vertexShader = `
  attribute float aSize;
  attribute float aAlpha;
  attribute float aLayer;
  varying float vAlpha;
  varying float vWarmth;
  varying vec2 vFlow;
  varying float vStretch;
  varying float vPointSize;
  uniform vec2 uPointer;
  uniform float uLightning;
  uniform float uIntensity;
  uniform float uWarmth;
  uniform float uWarmCenter;
  uniform float uFaceClear;
  uniform float uTravel;
  uniform float uRush;
  void main() {
    vec3 p=position;
    float pointerDistance=distance(p.xy*.22,uPointer);
    p.x+=(p.x*.22-uPointer.x)*smoothstep(.75,0.,pointerDistance)*.11;
    vec4 mv=modelViewMatrix*vec4(p,1.);
    gl_Position=projectionMatrix*mv;

    float nearFactor=1.-smoothstep(1.1,15.,-mv.z);
    float travelEnergy=uTravel*(.5+.5*aLayer);
    float pointSize=clamp(aSize*(560./max(.2,-mv.z))*(1.+travelEnergy*1.85+uRush*.28),2.1,66.);
    gl_PointSize=pointSize;
    vPointSize=pointSize;

    vFlow=vec2(0.,-1.);
    vStretch=clamp(.5+aLayer*.16+nearFactor*(.2+uTravel*.18),.48,.96);
    vAlpha=aAlpha*uIntensity*(.76+nearFactor*.48+uLightning*1.65+uRush*.16);
    float faceMask=smoothstep(1.18,.18,distance(p.xy,vec2(uWarmCenter,.62)));
    vAlpha*=1.-faceMask*uFaceClear*.9;
    vWarmth=uWarmth*smoothstep(3.,.15,abs(p.x-uWarmCenter))*smoothstep(3.2,.1,abs(p.y+.2));
  }
`;

const fragmentShader = `
  varying float vAlpha;
  varying float vWarmth;
  varying vec2 vFlow;
  varying float vStretch;
  varying float vPointSize;
  void main() {
    vec2 p=gl_PointCoord-.5;
    vec2 tangent=normalize(vFlow);
    vec2 normal=vec2(-tangent.y,tangent.x);
    float across=dot(p,normal);
    float along=dot(p,tangent);
    float width=mix(.07,.022,vStretch);
    float aa=max(.006,1.35/max(vPointSize,1.));
    float core=1.-smoothstep(max(0.,width-aa),width+aa,abs(across));
    float softEdge=(1.-smoothstep(width*.72,width*2.7+aa,abs(across)))*.18;
    float tail=smoothstep(.53,-.5,along);
    float head=smoothstep(.51,.2,along);
    float alpha=(core+softEdge)*tail*head*vAlpha;
    if(alpha<.006) discard;
    vec3 color=mix(vec3(.68,.82,.92),vec3(.98,.57,.29),vWarmth);
    gl_FragColor=vec4(color,alpha);
  }
`;

export class RainSystem {
  readonly points: Points;
  private readonly positions: Float32Array;
  private readonly speeds: Float32Array;
  private readonly material: ShaderMaterial;
  private progress = 0;
  private cameraZ = 6;
  private scrollShift = 0;
  private rush = 0;
  private intensity = 0.82;
  private visibility = 1;
  private activeCount: number;

  constructor(count: number, warmCenter: number) {
    this.activeCount = count;
    const geometry = new BufferGeometry();
    this.positions = new Float32Array(count * 3);
    this.speeds = new Float32Array(count);
    const sizes = new Float32Array(count);
    const alphas = new Float32Array(count);
    const layers = new Float32Array(count);

    for (let i = 0; i < count; i += 1) {
      const layer = (i % 5) / 4;
      const offset = i * 3;
      this.positions[offset] = (Math.random() - 0.5) * HALF_WIDTH * 2;
      this.positions[offset + 1] = BOTTOM + Math.random() * (TOP - BOTTOM);
      this.positions[offset + 2] = this.cameraZ - NEAR_DEPTH - Math.random() * FAR_DEPTH;
      this.speeds[i] = 2.7 + layer * 4.2 + Math.random() * 2.4;
      sizes[i] = 0.055 + layer * 0.085 + Math.random() * 0.055;
      alphas[i] = 0.2 + layer * 0.25 + Math.random() * 0.22;
      layers[i] = layer;
    }

    geometry.setAttribute("position", new BufferAttribute(this.positions, 3));
    geometry.setAttribute("aSize", new BufferAttribute(sizes, 1));
    geometry.setAttribute("aAlpha", new BufferAttribute(alphas, 1));
    geometry.setAttribute("aLayer", new BufferAttribute(layers, 1));
    this.material = new ShaderMaterial({
      uniforms: {
        uPointer: { value: new Vector2(20, 20) },
        uLightning: { value: 0 },
        uIntensity: { value: 0.82 },
        uWarmth: { value: 0 },
        uWarmCenter: { value: warmCenter },
        uFaceClear: { value: 0 },
        uTravel: { value: 0 },
        uRush: { value: 0 },
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
    const progressDelta = Math.max(-0.045, Math.min(0.045, progress - this.progress));
    this.scrollShift += progressDelta * 18;
    this.rush = Math.min(1.4, this.rush + Math.abs(progressDelta) * 42);
    this.progress = progress;
    const travel = 1 - this.range(0.26, 0.38, progress);
    this.material.uniforms.uTravel.value = 0.38 + travel * 0.62;
    this.intensity = 1.02 + this.range(0.06, 0.58, progress) * 0.58;
    this.material.uniforms.uIntensity.value = this.intensity * this.visibility;
  }

  setVisibility(value: number) {
    this.visibility = Math.min(1, Math.max(0, value));
    this.material.uniforms.uIntensity.value = this.intensity * this.visibility;
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

  setDensity(ratio: number) {
    this.activeCount = Math.max(
      400,
      Math.min(this.speeds.length, Math.round(this.speeds.length * ratio)),
    );
    this.points.geometry.setDrawRange(0, this.activeCount);
  }

  update(delta: number, elapsed: number, cameraZ: number) {
    const cameraDelta = this.cameraZ - cameraZ;
    this.cameraZ = cameraZ;
    const travel = 1 - this.range(0.26, 0.38, this.progress);
    const wind = Math.sin(elapsed * 0.34) * 0.2 + 0.24;

    for (let i = 0; i < this.activeCount; i += 1) {
      const offset = i * 3;
      const depth = cameraZ - this.positions[offset + 2];
      const near = 1 - Math.min(1, Math.max(0, (depth - NEAR_DEPTH) / FAR_DEPTH));
      this.positions[offset + 1] -= this.speeds[i] * delta * (0.82 + near * 0.62);
      this.positions[offset] += wind * delta * (0.7 + near * 0.45);
      this.positions[offset + 2] +=
        delta * (1.5 + this.speeds[i] * 0.18) * travel + this.scrollShift;

      if (
        this.positions[offset + 2] > cameraZ - NEAR_DEPTH ||
        this.positions[offset + 2] < cameraZ - FAR_DEPTH - Math.abs(cameraDelta) * 2
      ) {
        this.positions[offset + 2] = cameraZ - FAR_DEPTH + Math.random() * 4;
        this.positions[offset] = (Math.random() - 0.5) * HALF_WIDTH * 2;
        this.positions[offset + 1] = BOTTOM + Math.random() * (TOP - BOTTOM);
      }
      if (this.positions[offset + 1] < BOTTOM) {
        this.positions[offset + 1] = TOP;
        this.positions[offset] = (Math.random() - 0.5) * HALF_WIDTH * 2;
      }
      if (this.positions[offset] > HALF_WIDTH) this.positions[offset] = -HALF_WIDTH;
    }
    this.scrollShift = 0;
    this.rush *= Math.exp(-delta * 7.5);
    this.material.uniforms.uRush.value = this.rush;
    (this.points.geometry.getAttribute("position") as BufferAttribute).needsUpdate = true;
  }

  private range(start: number, end: number, value: number) {
    const t = Math.min(1, Math.max(0, (value - start) / (end - start)));
    return t * t * (3 - 2 * t);
  }

  dispose() {
    this.points.geometry.dispose();
    this.material.dispose();
  }
}
