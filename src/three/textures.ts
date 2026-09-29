import * as THREE from 'three';

export function canvasTex(w: number, h: number, draw: (c: CanvasRenderingContext2D, w: number, h: number) => void, srgb = true) {
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  const c = cv.getContext('2d')!;
  draw(c, w, h);
  const t = new THREE.CanvasTexture(cv);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

// deterministic-ish noise helper
function speckle(c: CanvasRenderingContext2D, w: number, h: number, n: number, colors: string[], rMin: number, rMax: number, alpha = 0.25) {
  c.save();
  for (let i = 0; i < n; i++) {
    c.globalAlpha = alpha * Math.random();
    c.fillStyle = colors[(Math.random() * colors.length) | 0];
    const r = rMin + Math.random() * (rMax - rMin);
    c.beginPath(); c.arc(Math.random() * w, Math.random() * h, r, 0, Math.PI * 2); c.fill();
  }
  c.restore();
}

/** Thailand top texture. pts in map coords (450x700). */
export function landTexture(pts: { x: number; y: number }[], proj: (lo: number, la: number) => { x: number; y: number }, fronts: { x: number; y: number }[]) {
  const S = 3.4;
  return canvasTex(Math.round(450 * S), Math.round(700 * S), (c, w, h) => {
    const P = (lo: number, la: number) => { const p = proj(lo, la); return [p.x * S, p.y * S] as const; };
    const g = c.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#5fb85a'); g.addColorStop(0.3, '#7cc862'); g.addColorStop(0.5, '#a8d866'); g.addColorStop(0.75, '#6cc46a'); g.addColorStop(1, '#4fb86a');
    c.fillStyle = g; c.fillRect(0, 0, w, h);
    const blob = (lo: number, la: number, r: number, col: string) => { const [x, y] = P(lo, la); const gr = c.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, col); gr.addColorStop(1, col.replace(/[\d.]+\)$/, '0)')); c.fillStyle = gr; c.fillRect(0, 0, w, h); };
    blob(103.3, 15.9, 280, 'rgba(236,208,120,.9)');  // Isan golden
    blob(100.3, 14.8, 200, 'rgba(200,230,110,.8)');  // rice plains
    blob(99.5, 19.0, 300, 'rgba(60,150,80,.7)');     // north forest
    blob(99.6, 8.5, 220, 'rgba(50,170,110,.6)');     // south jungle
    // watercolor blotches
    for (let i = 0; i < 900; i++) {
      c.globalAlpha = 0.05 + Math.random() * 0.08;
      c.fillStyle = ['#ffffff', '#3a9a4a', '#f0e090', '#8ad060', '#2f8a5a'][i % 5];
      const x = Math.random() * w, y = Math.random() * h, r = 12 + Math.random() * 60;
      c.beginPath(); c.ellipse(x, y, r, r * (0.5 + Math.random() * 0.5), Math.random() * 3, 0, Math.PI * 2); c.fill();
    }
    c.globalAlpha = 1;
    // rice field patchwork
    const [cx, cy] = P(100.3, 14.8);
    for (let i = 0; i < 220; i++) {
      c.fillStyle = ['rgba(240,230,120,.35)', 'rgba(150,210,90,.35)', 'rgba(210,235,140,.35)'][i % 3];
      c.save(); c.translate(cx + (Math.random() - 0.5) * 420, cy + (Math.random() - 0.5) * 380); c.rotate((Math.random() - 0.5) * 0.5);
      c.fillRect(0, 0, 14 + Math.random() * 20, 10 + Math.random() * 14); c.restore();
    }
    // rivers
    c.save(); c.lineCap = 'round'; c.lineJoin = 'round';
    const river = (ll: [number, number][], wd: number) => { for (const [col, k] of [['rgba(255,255,255,.7)', 1.8], ['#4ab8e8', 1]] as const) { c.strokeStyle = col; c.lineWidth = wd * k; c.beginPath(); ll.forEach(([lo, la], i) => { const [x, y] = P(lo, la); if (i) c.lineTo(x, y); else c.moveTo(x, y); }); c.stroke(); } };
    river([[98.9, 19.3], [99.0, 18.3], [99.3, 17.3], [99.8, 16.4], [100.1, 15.7], [100.2, 15.0], [100.5, 14.2], [100.55, 13.5]], 8);
    river([[100.8, 19.1], [100.4, 18.0], [100.3, 17.0], [100.15, 15.8]], 5.5);
    river([[101.2, 19.5], [101.8, 18.2], [102.7, 18.0], [103.6, 18.35], [104.3, 17.6], [104.75, 16.5], [105.3, 15.8], [105.5, 15.0]], 9);
    river([[102.1, 15.2], [103.2, 15.2], [104.3, 15.25], [105.3, 15.3]], 5.5);
    c.restore();
    // frontline (soft)
    c.save(); c.strokeStyle = 'rgba(220,60,50,.45)'; c.lineWidth = 4; c.setLineDash([14, 10]);
    c.beginPath(); fronts.forEach((p, i) => (i ? c.lineTo(p.x * S, p.y * S) : c.moveTo(p.x * S, p.y * S))); c.stroke(); c.restore();
    c.save(); c.font = '800 64px Kanit, sans-serif'; c.textAlign = 'center'; c.fillStyle = 'rgba(40,80,40,.28)';
    ([['ล้านนา', 99.4, 18.25], ['อีสาน', 103.3, 16.1], ['ภาคกลาง', 100.7, 14.6], ['ด้ามขวาน', 99.1, 9.9]] as const).forEach(([t, lo, la]) => { const [x, y] = P(lo, la); c.fillText(t, x, y); });
    c.restore();
    // sandy coast
    c.save(); c.strokeStyle = 'rgba(255,240,190,.95)'; c.lineWidth = 14; c.lineJoin = 'round';
    c.beginPath(); pts.forEach((p, i) => (i ? c.lineTo(p.x * S, p.y * S) : c.moveTo(p.x * S, p.y * S))); c.closePath(); c.stroke(); c.restore();
  });
}

export function neighbourTexture() {
  return canvasTex(512, 512, (c, w, h) => {
    c.fillStyle = '#4a4a38'; c.fillRect(0, 0, w, h);
    speckle(c, w, h, 2500, ['#3a3a2a', '#5a5a44', '#2f2f22'], 1, 5, 0.5);
  });
}

export function groundTexture(pal: string[] = ['#8fcf5a', '#7abf4a', '#a8dc6a', '#6aaf40', '#c8e888', '#b89a6a']) {
  const t = canvasTex(1024, 1024, (c, w, h) => {
    c.fillStyle = pal[0]; c.fillRect(0, 0, w, h);
    for (let i = 0; i < 1400; i++) {
      c.globalAlpha = 0.12 + Math.random() * 0.2; c.fillStyle = pal[1 + (i % (pal.length - 2))];
      const x = Math.random() * w, y = Math.random() * h, r = 6 + Math.random() * 38;
      c.beginPath(); c.ellipse(x, y, r, r * 0.6, Math.random() * 3, 0, Math.PI * 2); c.fill();
    }
    // dirt paths patches
    for (let i = 0; i < 14; i++) { c.globalAlpha = 0.35; c.fillStyle = pal[pal.length - 1]; const x = Math.random() * w, y = Math.random() * h; c.beginPath(); c.ellipse(x, y, 30 + Math.random() * 70, 16 + Math.random() * 30, Math.random() * 3, 0, Math.PI * 2); c.fill(); }
    // tiny flowers
    c.globalAlpha = 0.9;
    for (let i = 0; i < 500; i++) { c.fillStyle = ['#ffffff', '#ffe14a', '#ff9ac0', '#b0d0ff'][i % 4]; c.beginPath(); c.arc(Math.random() * w, Math.random() * h, 1.5 + Math.random() * 1.5, 0, Math.PI * 2); c.fill(); }
    c.globalAlpha = 1;
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

export function skyTexture() {
  return canvasTex(16, 512, (c, w, h) => {
    const g = c.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#2f7fd8'); g.addColorStop(0.3, '#5aa8ec'); g.addColorStop(0.46, '#a8d8f8'); g.addColorStop(0.52, '#fff4dc');
    g.addColorStop(0.58, '#cfe8c8'); g.addColorStop(1, '#8ac070');
    c.fillStyle = g; c.fillRect(0, 0, w, h);
  });
}

export function glowTexture(inner = 'rgba(255,255,255,1)', outer = 'rgba(255,255,255,0)') {
  return canvasTex(128, 128, (c, w) => {
    const g = c.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
    g.addColorStop(0, inner); g.addColorStop(0.3, inner.replace(/[\d.]+\)$/, '.5)')); g.addColorStop(1, outer);
    c.fillStyle = g; c.fillRect(0, 0, w, w);
  });
}

export function magicCircleTexture() {
  return canvasTex(512, 512, (c, w) => {
    c.translate(w / 2, w / 2);
    c.strokeStyle = '#fff'; c.shadowColor = '#fff'; c.shadowBlur = 12;
    c.lineWidth = 6; c.beginPath(); c.arc(0, 0, 240, 0, Math.PI * 2); c.stroke();
    c.lineWidth = 3; c.beginPath(); c.arc(0, 0, 205, 0, Math.PI * 2); c.stroke();
    c.beginPath(); c.arc(0, 0, 120, 0, Math.PI * 2); c.stroke();
    c.lineWidth = 4; c.beginPath();
    for (let i = 0; i <= 6; i++) { const a = (i * 2 * Math.PI * 2) / 6 - Math.PI / 2; const x = Math.cos(a) * 205, y = Math.sin(a) * 205; if (i) c.lineTo(x, y); else c.moveTo(x, y); }
    c.stroke();
    c.font = 'bold 26px serif'; c.fillStyle = '#fff'; c.textAlign = 'center';
    const runes = 'ᚠᚢᚦᚨᚱᚲᚷᚹᚺᚾᛁᛃᛇᛈᛉᛊᛏᛒᛖᛗᛚᛜᛞᛟ';
    for (let i = 0; i < 24; i++) { c.save(); c.rotate((i / 24) * Math.PI * 2); c.fillText(runes[i], 0, -214); c.restore(); }
  }, false);
}

export function dashTexture() {
  const t = canvasTex(64, 16, (c) => {
    c.clearRect(0, 0, 64, 16);
    c.fillStyle = '#ffd35a'; c.fillRect(0, 3, 38, 10);
    c.fillStyle = '#fff5c8'; c.fillRect(4, 6, 30, 4);
  });
  t.wrapS = THREE.RepeatWrapping;
  return t;
}

export function labelTexture(text: string, sub: string, subColor: string) {
  const w = sub.length > 14 ? 768 : 512, h = 160;
  const t = canvasTex(w, h, (c) => {
    c.textAlign = 'center';
    c.font = '800 64px Kanit, sans-serif';
    c.lineWidth = 12; c.strokeStyle = 'rgba(0,0,0,.9)'; c.lineJoin = 'round';
    c.strokeText(text, w / 2, 70); c.fillStyle = '#fff7d6'; c.fillText(text, w / 2, 70);
    c.font = '700 40px Kanit, sans-serif'; c.lineWidth = 8;
    c.strokeText(sub, w / 2, 128); c.fillStyle = subColor; c.fillText(sub, w / 2, 128);
  });
  return { tex: t, aspect: w / h };
}

export function textSprite(text: string, color = '#ef4444', size = 160) {
  return canvasTex(256, 256, (c) => {
    c.textAlign = 'center'; c.textBaseline = 'middle';
    c.font = `900 ${size}px Kanit, sans-serif`; c.lineWidth = 16; c.strokeStyle = '#000'; c.lineJoin = 'round';
    c.strokeText(text, 128, 138); c.fillStyle = color; c.fillText(text, 128, 138);
  });
}

export function bannerTexture(color: string) {
  return canvasTex(128, 96, (c) => {
    c.fillStyle = color; c.fillRect(0, 0, 128, 96);
    c.fillStyle = '#f6c453'; c.fillRect(0, 0, 128, 10); c.fillRect(0, 86, 128, 10);
    c.font = '900 56px Kanit'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('⚔', 64, 50);
  });
}
