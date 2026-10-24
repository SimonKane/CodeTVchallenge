export interface InteractionSnapshot {
  pointerX: number;
  pointerY: number;
  pointerVelocityX: number;
  pointerVelocityY: number;
  dragging: boolean;
  scrollVelocity: number;
  scrollDirection: -1 | 0 | 1;
}

const clamp = (value: number, minimum: number, maximum: number) =>
  Math.min(maximum, Math.max(minimum, value));

const damp = (current: number, target: number, response: number, delta: number) =>
  current + (target - current) * (1 - Math.exp(-response * delta));

export class InteractionField {
  readonly snapshot: InteractionSnapshot = {
    pointerX: 0.5,
    pointerY: 0.5,
    pointerVelocityX: 0,
    pointerVelocityY: 0,
    dragging: false,
    scrollVelocity: 0,
    scrollDirection: 0,
  };

  private pointerTargetX = 0.5;
  private pointerTargetY = 0.5;
  private pointerVelocityTargetX = 0;
  private pointerVelocityTargetY = 0;
  private scrollVelocityTarget = 0;
  private previousPointerX = 0.5;
  private previousPointerY = 0.5;
  private previousPointerTime = performance.now();
  private previousScrollY = scrollY;
  private previousScrollTime = performance.now();
  private previousSampleTime = performance.now();
  private previousSampleFrame = -1;
  private activePointerId: number | undefined;

  constructor(private readonly root: HTMLElement) {
    addEventListener("pointermove", this.handlePointerMove, { passive: true });
    addEventListener("pointerdown", this.handlePointerDown, { passive: true });
    addEventListener("pointerup", this.handlePointerUp, { passive: true });
    addEventListener("pointercancel", this.handlePointerUp, { passive: true });
    addEventListener("blur", this.handleLeave);
    document.addEventListener("visibilitychange", this.handleVisibility);
  }

  private readonly handlePointerMove = (event: PointerEvent) => {
    const bounds = this.root.getBoundingClientRect();
    const nextX = clamp((event.clientX - bounds.left) / Math.max(1, bounds.width), 0, 1);
    const nextY = clamp((event.clientY - bounds.top) / Math.max(1, bounds.height), 0, 1);
    const now = performance.now();
    const delta = Math.max(8, now - this.previousPointerTime);
    this.pointerVelocityTargetX = clamp((nextX - this.previousPointerX) / delta * 1000, -3, 3);
    this.pointerVelocityTargetY = clamp((nextY - this.previousPointerY) / delta * 1000, -3, 3);
    this.pointerTargetX = nextX;
    this.pointerTargetY = nextY;
    this.previousPointerX = nextX;
    this.previousPointerY = nextY;
    this.previousPointerTime = now;
  };

  private readonly handlePointerDown = (event: PointerEvent) => {
    if (!this.root.contains(event.target as Node)) return;
    this.activePointerId = event.pointerId;
    this.snapshot.dragging = true;
  };

  private readonly handlePointerUp = (event: PointerEvent) => {
    if (this.activePointerId !== undefined && event.pointerId !== this.activePointerId) return;
    this.activePointerId = undefined;
    this.snapshot.dragging = false;
  };

  private readonly handleLeave = () => {
    this.pointerTargetX = 0.5;
    this.pointerTargetY = 0.5;
    this.pointerVelocityTargetX = 0;
    this.pointerVelocityTargetY = 0;
    this.snapshot.dragging = false;
  };

  private readonly handleVisibility = () => {
    if (document.hidden) this.handleLeave();
  };

  updateScroll(nextScrollY: number, time = performance.now()) {
    const deltaSeconds = Math.max(1 / 240, (time - this.previousScrollTime) / 1000);
    const pixelsPerSecond = (nextScrollY - this.previousScrollY) / deltaSeconds;
    this.scrollVelocityTarget = clamp(pixelsPerSecond / Math.max(640, innerHeight * 2.4), -1.5, 1.5);
    this.snapshot.scrollDirection =
      Math.abs(pixelsPerSecond) < 4 ? 0 : pixelsPerSecond > 0 ? 1 : -1;
    this.previousScrollY = nextScrollY;
    this.previousScrollTime = time;
  }

  sample(time = performance.now()) {
    const frame = Math.floor(time);
    if (frame === this.previousSampleFrame) return this.snapshot;
    const delta = clamp((time - this.previousSampleTime) / 1000, 1 / 240, 0.05);
    this.previousSampleTime = time;
    this.previousSampleFrame = frame;
    this.snapshot.pointerX = damp(this.snapshot.pointerX, this.pointerTargetX, 9, delta);
    this.snapshot.pointerY = damp(this.snapshot.pointerY, this.pointerTargetY, 9, delta);
    this.snapshot.pointerVelocityX = damp(
      this.snapshot.pointerVelocityX,
      this.pointerVelocityTargetX,
      this.snapshot.dragging ? 15 : 8,
      delta,
    );
    this.snapshot.pointerVelocityY = damp(
      this.snapshot.pointerVelocityY,
      this.pointerVelocityTargetY,
      this.snapshot.dragging ? 15 : 8,
      delta,
    );
    this.snapshot.scrollVelocity = damp(
      this.snapshot.scrollVelocity,
      this.scrollVelocityTarget,
      this.scrollVelocityTarget === 0 ? 7 : 13,
      delta,
    );
    this.pointerVelocityTargetX = damp(this.pointerVelocityTargetX, 0, 11, delta);
    this.pointerVelocityTargetY = damp(this.pointerVelocityTargetY, 0, 11, delta);
    this.scrollVelocityTarget = damp(this.scrollVelocityTarget, 0, 9, delta);
    if (Math.abs(this.snapshot.scrollVelocity) < 0.001) {
      this.snapshot.scrollVelocity = 0;
      if (Math.abs(this.scrollVelocityTarget) < 0.001) this.snapshot.scrollDirection = 0;
    }
    return this.snapshot;
  }

  destroy() {
    removeEventListener("pointermove", this.handlePointerMove);
    removeEventListener("pointerdown", this.handlePointerDown);
    removeEventListener("pointerup", this.handlePointerUp);
    removeEventListener("pointercancel", this.handlePointerUp);
    removeEventListener("blur", this.handleLeave);
    document.removeEventListener("visibilitychange", this.handleVisibility);
  }
}
