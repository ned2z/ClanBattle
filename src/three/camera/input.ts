import { CameraDirector } from './director';

const YAW_RATE = 0.0032; // rad per px
const PITCH_RATE = 0.0022;

/**
 * Lets the player nudge the battle camera: drag to orbit, pinch to dolly.
 *
 * Listens on the WebGL canvas only (never on the DOM overlay), so it can never
 * swallow taps meant for HUD buttons. Input is ignored while the director runs
 * a cinematic sequence, and the camera auto-recenters after a short idle.
 */
export class CameraInput {
  private dir: CameraDirector;
  private on = true;
  private detach: (() => void) | null = null;
  private readonly pointers = new Map<number, { x: number; y: number }>();
  private lastPinch = 0;

  constructor(private el: HTMLElement, dir: CameraDirector, enabled = true) {
    this.dir = dir;
    this.on = enabled;
    if (this.on) this.attach();
  }

  private attach() {
    const down = (e: PointerEvent) => {
      if (!this.on || !this.dir.acceptsUserInput) return;
      this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (this.pointers.size === 2) this.lastPinch = this.pinchDist();
    };
    const move = (e: PointerEvent) => {
      if (!this.on) return;
      const p = this.pointers.get(e.pointerId);
      if (!p || !this.dir.acceptsUserInput) return;
      const dx = e.clientX - p.x;
      const dy = e.clientY - p.y;
      p.x = e.clientX;
      p.y = e.clientY;
      if (this.pointers.size === 1) {
        this.dir.addUserInput(-dx * YAW_RATE, -dy * PITCH_RATE);
      } else if (this.pointers.size === 2) {
        const d = this.pinchDist();
        if (this.lastPinch > 0 && d > 0) this.dir.addUserInput(0, 0, d / this.lastPinch);
        this.lastPinch = d;
      }
    };
    const up = (e: PointerEvent) => {
      this.pointers.delete(e.pointerId);
      if (this.pointers.size < 2) this.lastPinch = 0;
      if (this.pointers.size === 0) this.dir.resetUserInput();
    };
    this.el.addEventListener('pointerdown', down);
    window.addEventListener('pointermove', move, { passive: true });
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    this.detach = () => {
      this.el.removeEventListener('pointerdown', down);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
    };
  }

  private pinchDist() {
    const p = [...this.pointers.values()];
    if (p.length < 2) return 0;
    return Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y);
  }

  /** enable/disable drag control without tearing listeners down */
  setEnabled(on: boolean) {
    if (this.on === on) return;
    this.on = on;
    if (on) this.attach();
    else this.release();
  }

  private release() {
    this.detach?.();
    this.detach = null;
    this.pointers.clear();
    this.lastPinch = 0;
  }

  dispose() { this.release(); }
}
