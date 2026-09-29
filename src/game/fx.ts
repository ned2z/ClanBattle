interface P { x: number; y: number; vx: number; vy: number; life: number; max: number; size: number; color: string; g: number; shape: 0 | 1 | 2 }

const parts: P[] = [];
let shakeT = 0;
let shakeMag = 0;
let shakeEl: HTMLElement | null = null;
let canvas: HTMLCanvasElement | null = null;
let ctx: CanvasRenderingContext2D | null = null;
let raf = 0;
let running = false;
const MAX = 500;

function loop() {
  if (!canvas || !ctx) { running = false; return; }
  const dpr = canvas.width / canvas.clientWidth || 1;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight);
  ctx.globalCompositeOperation = 'lighter';
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i];
    p.life -= 1;
    if (p.life <= 0) { parts[i] = parts[parts.length - 1]; parts.pop(); continue; }
    p.vy += p.g; p.vx *= 0.96; p.vy *= 0.96;
    p.x += p.vx; p.y += p.vy;
    const a = p.life / p.max;
    ctx.globalAlpha = a;
    ctx.fillStyle = p.color;
    if (p.shape === 1) {
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    } else if (p.shape === 2) {
      ctx.save(); ctx.strokeStyle = p.color; ctx.lineWidth = 2; ctx.beginPath();
      ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.vx * 3, p.y - p.vy * 3); ctx.stroke(); ctx.restore();
    } else {
      ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (0.4 + a * 0.6), 0, Math.PI * 2); ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  if (shakeEl) {
    if (shakeT > 0) {
      shakeT--;
      const m = shakeMag * (shakeT / 20);
      shakeEl.style.transform = `translate3d(${(Math.random() - 0.5) * m}px, ${(Math.random() - 0.5) * m}px, 0)`;
    } else if (shakeEl.style.transform) shakeEl.style.transform = '';
  }
  if (parts.length || shakeT > 0) raf = requestAnimationFrame(loop);
  else running = false;
}

function kick() { if (!running) { running = true; raf = requestAnimationFrame(loop); } }

type BurstOpts = { speed?: number; g?: number; size?: number; life?: number; shape?: 0 | 1 | 2; up?: boolean };

export const fx = {
  attach(c: HTMLCanvasElement | null) {
    canvas = c; ctx = c ? c.getContext('2d') : null;
    if (!c) cancelAnimationFrame(raf);
  },
  resize() {
    if (!canvas) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = canvas.clientWidth * dpr; canvas.height = canvas.clientHeight * dpr;
  },
  setShake(el: HTMLElement | null) { shakeEl = el; },
  shake(mag = 8, frames = 18) { shakeMag = Math.max(shakeMag * (shakeT / 20), mag); shakeT = Math.max(shakeT, frames); kick(); },
  burst(x: number, y: number, color: string, n = 16, o: BurstOpts = {}) {
    const sp = o.speed ?? 5;
    for (let i = 0; i < n && parts.length < MAX; i++) {
      const a = o.up ? -Math.PI / 2 + (Math.random() - 0.5) * 1.2 : Math.random() * Math.PI * 2;
      const v = sp * (0.3 + Math.random() * 0.9);
      const life = (o.life ?? 36) * (0.6 + Math.random() * 0.6);
      parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life, max: life, size: (o.size ?? 3.5) * (0.6 + Math.random() * 0.8), color, g: o.g ?? 0.12, shape: o.shape ?? 0 });
    }
    kick();
  },
  burstAt(el: Element | null | undefined, color: string, n = 16, o: BurstOpts = {}) {
    if (!el) return;
    const r = el.getBoundingClientRect();
    fx.burst(r.left + r.width / 2, r.top + r.height / 2, color, n, o);
  },
};
