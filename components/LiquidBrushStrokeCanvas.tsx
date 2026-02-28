'use client';

import { useEffect, useRef } from 'react';

// ── PRNG (mulberry32) ──────────────────────────────────────────────────────────
function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ── Cubic bezier sampling ──────────────────────────────────────────────────────
function sampleBezier(
  p0x: number, p0y: number,
  c1x: number, c1y: number,
  c2x: number, c2y: number,
  p3x: number, p3y: number,
  n: number,
): [number, number][] {
  const out: [number, number][] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const u = 1 - t;
    out.push([
      u * u * u * p0x + 3 * u * u * t * c1x + 3 * u * t * t * c2x + t * t * t * p3x,
      u * u * u * p0y + 3 * u * u * t * c1y + 3 * u * t * t * c2y + t * t * t * p3y,
    ]);
  }
  return out;
}

// ── Per-point perpendicular normals ───────────────────────────────────────────
function computeNormals(pts: [number, number][], w: number, h: number): [number, number][] {
  const last = pts.length - 1;
  return pts.map((_, i) => {
    const prev = pts[Math.max(0, i - 1)];
    const next = pts[Math.min(last, i + 1)];
    const dx = (next[0] - prev[0]) * w;
    const dy = (next[1] - prev[1]) * h;
    const len = Math.hypot(dx, dy) || 1;
    return [-dy / len, dx / len];
  });
}

// ── Easing ─────────────────────────────────────────────────────────────────────
function easeOutCubic(t: number): number { return 1 - (1 - t) ** 3; }

// ── Width profile along the drawn stroke ──────────────────────────────────────
function widthProfile(t: number, isLive: boolean): number {
  const entry = t < 0.04 ? (t / 0.04) ** 0.55 : 1.0;
  const exitLen = isLive ? 0.07 : 0.20;
  const exitPow = isLive ? 0.45 : 1.15;
  const exit = t > 1 - exitLen ? ((1 - t) / exitLen) ** exitPow : 1.0;
  return entry * exit;
}

// ── Pre-baked Hermite-smoothed edge noise ─────────────────────────────────────
function bakeNoise(n: number, rng: () => number, step = 8): Float32Array {
  const nc = Math.ceil(n / step) + 2;
  const ctrl = Array.from({ length: nc }, () => rng() - 0.5);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const fi = i / step;
    const lo = Math.floor(fi);
    const hi = Math.min(lo + 1, nc - 1);
    const f = fi - lo;
    const s = f * f * (3 - 2 * f);
    out[i] = ctrl[lo] + (ctrl[hi] - ctrl[lo]) * s;
  }
  return out;
}

// ── Hex → RGB ──────────────────────────────────────────────────────────────────
function toRgb(hex: string): [number, number, number] {
  return [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
}

// ── Types ──────────────────────────────────────────────────────────────────────
interface Bristle {
  frac: number;
  alpha: number;
  lw: number;
  isRidge: boolean;
}

interface Stroke {
  r: number; g: number; b: number;
  pts: [number, number][];
  maxHW: number;
  t0: number;
  dt: number;
  noiseL: Float32Array;
  noiseR: Float32Array;
  bristles: Bristle[];
  specFrac: number;
}

// ── Props ─────────────────────────────────────────────────────────────────────
type Props = {
  /** Path to a photoreal brush texture in /public. Example: "/brush-texture.webp" */
  textureSrc?: string;
  /** 0..1 — strength of the texture projection */
  textureStrength?: number;
  /** Background fill for the canvas */
  background?: string;
};

// ── Constants ─────────────────────────────────────────────────────────────────
const N_PTS = 200;
const ANIM_END = 4.4;
const NOISE_AMP = 0.11;

// Blob + highlight tuning
const BLOB_HIGHLIGHT_FACTOR = 1.18;
const BLOB_MENISCUS_FACTOR = 0.82;

// ── Build stroke data (deterministic via PRNG seed) ───────────────────────────
function buildStrokes(): Stroke[] {
  const rng = mulberry32(0xd3a7f1c9);

  const defs = [
    { hex: '#C8956A', p0x: -0.03, p0y: 0.86, c1x: 0.12, c1y: 0.26, c2x: 0.52, c2y: 0.04, p3x: 1.03, p3y: 0.18, hw: 0.050, t0: 0.00, dt: 1.10 },
    { hex: '#BE8A5E', p0x: -0.03, p0y: 0.52, c1x: 0.28, c1y: 0.18, c2x: 0.64, c2y: 0.80, p3x: 1.03, p3y: 0.44, hw: 0.042, t0: 0.38, dt: 1.00 },
    { hex: '#D9BEA0', p0x: 0.04, p0y: 0.06, c1x: 0.26, c1y: 0.00, c2x: 0.50, c2y: 0.18, p3x: 0.88, p3y: 0.42, hw: 0.036, t0: 0.76, dt: 0.90 },
    { hex: '#AD7A52', p0x: -0.03, p0y: 0.88, c1x: 0.26, c1y: 0.96, c2x: 0.64, c2y: 0.76, p3x: 1.03, p3y: 0.72, hw: 0.046, t0: 1.12, dt: 0.94 },
    { hex: '#D0B296', p0x: 0.54, p0y: 0.00, c1x: 0.74, c1y: 0.04, c2x: 0.88, c2y: 0.22, p3x: 1.03, p3y: 0.48, hw: 0.033, t0: 1.50, dt: 0.78 },
    { hex: '#BC8A62', p0x: 0.00, p0y: 0.10, c1x: 0.04, c1y: 0.36, c2x: 0.12, c2y: 0.62, p3x: 0.28, p3y: 1.02, hw: 0.034, t0: 1.82, dt: 0.84 },
    { hex: '#C8956A', p0x: 0.14, p0y: 1.03, c1x: 0.40, c1y: 0.82, c2x: 0.70, c2y: 0.94, p3x: 1.03, p3y: 0.96, hw: 0.040, t0: 2.12, dt: 0.88 },
    { hex: '#BE8A5E', p0x: 0.30, p0y: 0.30, c1x: 0.46, c1y: 0.12, c2x: 0.66, c2y: 0.28, p3x: 0.82, p3y: 0.54, hw: 0.029, t0: 2.42, dt: 0.72 },
  ];

  return defs.map((d) => {
    const [r, g, b] = toRgb(d.hex);
    const pts = sampleBezier(d.p0x, d.p0y, d.c1x, d.c1y, d.c2x, d.c2y, d.p3x, d.p3y, N_PTS);
    const noiseL = bakeNoise(N_PTS + 1, rng, 7);
    const noiseR = bakeNoise(N_PTS + 1, rng, 7);

    const bCount = 28 + Math.floor(rng() * 11);
    const bristles: Bristle[] = Array.from({ length: bCount }, () => {
      const isRidge = rng() > 0.40;
      return {
        frac: (rng() * 2 - 1) * 0.93,
        alpha: isRidge ? 0.06 + rng() * 0.10 : 0.04 + rng() * 0.06,
        lw: 0.45 + rng() * 1.30,
        isRidge,
      };
    });

    return {
      r, g, b, pts,
      maxHW: d.hw, t0: d.t0, dt: d.dt,
      noiseL, noiseR, bristles,
      specFrac: -(0.34 + rng() * 0.10),
    };
  });
}

function clamp(n: number, a: number, b: number) { return Math.max(a, Math.min(b, n)); }

function buildStrokeClipPath(
  aX: Float32Array, aY: Float32Array,
  bX: Float32Array, bY: Float32Array,
  count: number,
): Path2D {
  const p = new Path2D();
  p.moveTo(aX[0], aY[0]);
  for (let i = 1; i < count; i++) p.lineTo(aX[i], aY[i]);
  for (let i = count - 1; i >= 0; i--) p.lineTo(bX[i], bY[i]);
  p.closePath();
  return p;
}

function drawTextureProjected(
  ctx: CanvasRenderingContext2D,
  texture: HTMLImageElement,
  clipPath: Path2D,
  bbox: { minX: number; minY: number; maxX: number; maxY: number },
  angle: number,
  strength: number,
) {
  if (!texture.complete || texture.naturalWidth === 0) return;

  const w = bbox.maxX - bbox.minX;
  const h = bbox.maxY - bbox.minY;
  if (w < 2 || h < 2) return;

  const cx = (bbox.minX + bbox.maxX) * 0.5;
  const cy = (bbox.minY + bbox.maxY) * 0.5;

  ctx.save();
  ctx.clip(clipPath);

  // Make sure we fully cover even after rotation
  const cover = Math.hypot(w, h) * 1.25;
  const aspect = texture.naturalWidth / texture.naturalHeight;

  let dw = cover;
  let dh = cover / aspect;
  if (dh < cover) { dh = cover; dw = cover * aspect; }

  ctx.translate(cx, cy);
  ctx.rotate(angle);

  // PASS 1: Multiply (adds realistic density/grooves)
  ctx.globalCompositeOperation = 'multiply';
  ctx.globalAlpha = clamp(0.12 + strength * 0.25, 0, 0.60);
  ctx.filter = 'contrast(110%) saturate(106%)';
  ctx.drawImage(texture, -dw / 2, -dh / 2, dw, dh);

  // PASS 2: Soft-light (adds subtle fiber + sheen variation)
  ctx.globalCompositeOperation = 'soft-light';
  ctx.globalAlpha = clamp(0.06 + strength * 0.17, 0, 0.42);
  ctx.filter = 'contrast(104%) saturate(112%)';
  ctx.drawImage(texture, -dw / 2 + dw * 0.05, -dh / 2 - dh * 0.02, dw * 0.98, dh * 0.98);

  // PASS 3: Overlay (tiny micro-contrast, helps photoreal feel)
  ctx.globalCompositeOperation = 'overlay';
  ctx.globalAlpha = clamp(0.02 + strength * 0.08, 0, 0.22);
  ctx.filter = 'contrast(112%) saturate(102%)';
  ctx.drawImage(texture, -dw / 2 - dw * 0.02, -dh / 2 + dh * 0.03, dw, dh);

  ctx.filter = 'none';
  ctx.restore();
}

function renderStroke(
  ctx: CanvasRenderingContext2D,
  s: Stroke,
  progress: number,
  cw: number,
  ch: number,
  texture: HTMLImageElement | null,
  textureStrength: number,
) {
  const nPts = s.pts.length;
  const count = Math.max(3, Math.round(progress * (nPts - 1)) + 1);
  const { r, g, b } = s;

  const pts = s.pts.slice(0, count);
  const nrm = computeNormals(pts, cw, ch);

  const isLive = progress < 0.96;
  const maxHW = s.maxHW * cw;

  const spX = new Float32Array(count);
  const spY = new Float32Array(count);
  const hwA = new Float32Array(count);
  const lX = new Float32Array(count);
  const lY = new Float32Array(count);
  const rX = new Float32Array(count);
  const rY = new Float32Array(count);

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

  for (let i = 0; i < count; i++) {
    const t = count < 2 ? 0 : i / (count - 1);
    const hw = maxHW * widthProfile(t, isLive);
    hwA[i] = hw;

    spX[i] = pts[i][0] * cw;
    spY[i] = pts[i][1] * ch;

    const [nx, ny] = nrm[i];
    const nL = s.noiseL[i] * hw * NOISE_AMP;
    const nR = s.noiseR[i] * hw * NOISE_AMP;

    lX[i] = spX[i] + nx * (hw + nL);
    lY[i] = spY[i] + ny * (hw + nL);
    rX[i] = spX[i] - nx * (hw + nR);
    rY[i] = spY[i] - ny * (hw + nR);

    minX = Math.min(minX, lX[i], rX[i]);
    minY = Math.min(minY, lY[i], rY[i]);
    maxX = Math.max(maxX, lX[i], rX[i]);
    maxY = Math.max(maxY, lY[i], rY[i]);
  }

  // Stroke direction angle for texture projection
  const dx = spX[count - 1] - spX[0];
  const dy = spY[count - 1] - spY[0];
  const angle = Math.atan2(dy, dx);

  const fillBetween = (
    aX: Float32Array, aY: Float32Array,
    bX: Float32Array, bY: Float32Array,
    style: string,
  ) => {
    ctx.beginPath();
    ctx.moveTo(aX[0], aY[0]);
    for (let i = 1; i < count; i++) ctx.lineTo(aX[i], aY[i]);
    for (let i = count - 1; i >= 0; i--) ctx.lineTo(bX[i], bY[i]);
    ctx.closePath();
    ctx.fillStyle = style;
    ctx.fill();
  };

  const makeInner = (frac: number): [Float32Array, Float32Array] => {
    const ex = new Float32Array(count);
    const ey = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      const [nx, ny] = nrm[i];
      ex[i] = spX[i] + nx * frac * hwA[i];
      ey[i] = spY[i] + ny * frac * hwA[i];
    }
    return [ex, ey];
  };

  ctx.save();

  // A · Soft drop-shadow under the body
  ctx.shadowColor = `rgba(${Math.max(0, r - 70)},${Math.max(0, g - 64)},${Math.max(0, b - 56)},0.32)`;
  ctx.shadowBlur = maxHW * 0.72;
  ctx.shadowOffsetY = maxHW * 0.14;
  fillBetween(lX, lY, rX, rY, `rgba(${r},${g},${b},0.01)`);
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;

  // B · Main semi-transparent foundation body
  fillBetween(lX, lY, rX, rY, `rgba(${r},${g},${b},0.78)`);

  // C · Volumetric depth
  {
    const [iLX, iLY] = makeInner(0.62);
    const [iRX, iRY] = makeInner(-0.62);
    fillBetween(iLX, iLY, iRX, iRY, `rgba(${r},${g},${b},0.12)`);
  }
  {
    const [iLX, iLY] = makeInner(0.26);
    const [iRX, iRY] = makeInner(-0.26);
    fillBetween(iLX, iLY, iRX, iRY, `rgba(${r},${g},${b},0.07)`);
  }

  // Photoreal texture projection clipped to the stroke shape
  if (texture && textureStrength > 0.001) {
    const clipPath = buildStrokeClipPath(lX, lY, rX, rY, count);
    drawTextureProjected(
      ctx,
      texture,
      clipPath,
      { minX, minY, maxX, maxY },
      angle,
      textureStrength,
    );
  }

  // D · Surface-tension meniscus bead at each edge
  {
    const dr = Math.max(0, r - 32);
    const dg = Math.max(0, g - 26);
    const db = Math.max(0, b - 20);
    const [iLX, iLY] = makeInner(0.78);
    const [iRX, iRY] = makeInner(-0.78);
    fillBetween(lX, lY, iLX, iLY, `rgba(${dr},${dg},${db},0.30)`);
    fillBetween(iRX, iRY, rX, rY, `rgba(${dr},${dg},${db},0.30)`);
  }

  // E · Procedural bristle micro-lines (reduced so the real texture dominates)
  ctx.lineCap = 'round';
  for (const br of s.bristles) {
    const tr = br.isRidge ? Math.min(255, r + 28) : Math.max(0, r - 24);
    const tg = br.isRidge ? Math.min(255, g + 22) : Math.max(0, g - 19);
    const tb = br.isRidge ? Math.min(255, b + 16) : Math.max(0, b - 14);
    ctx.beginPath();
    for (let i = 0; i < count; i++) {
      const [nx, ny] = nrm[i];
      const bx = spX[i] + nx * br.frac * hwA[i];
      const by = spY[i] + ny * br.frac * hwA[i];
      if (i === 0) ctx.moveTo(bx, by);
      else ctx.lineTo(bx, by);
    }
    ctx.lineWidth = br.lw;
    ctx.strokeStyle = `rgba(${tr},${tg},${tb},${br.alpha * 0.72})`;
    ctx.stroke();
  }

  // F · Specular highlights — 'screen' blend
  ctx.globalCompositeOperation = 'screen';

  ctx.beginPath();
  for (let i = 0; i < count; i++) {
    const [nx, ny] = nrm[i];
    const ox = spX[i] + nx * s.specFrac * hwA[i] * 0.80;
    const oy = spY[i] + ny * s.specFrac * hwA[i] * 0.80;
    if (i === 0) ctx.moveTo(ox, oy);
    else ctx.lineTo(ox, oy);
  }
  ctx.lineWidth = 6.0;
  ctx.strokeStyle = 'rgba(255, 244, 228, 0.16)';
  ctx.stroke();

  ctx.beginPath();
  for (let i = 0; i < count; i++) {
    const [nx, ny] = nrm[i];
    const ox = spX[i] + nx * s.specFrac * hwA[i];
    const oy = spY[i] + ny * s.specFrac * hwA[i];
    if (i === 0) ctx.moveTo(ox, oy);
    else ctx.lineTo(ox, oy);
  }
  ctx.lineWidth = 1.7;
  ctx.strokeStyle = 'rgba(255, 252, 248, 0.86)';
  ctx.stroke();

  ctx.globalCompositeOperation = 'source-over';

  // G · Animated wet blob at the leading edge
  if (isLive && count >= 2) {
    const tx = spX[count - 1];
    const ty = spY[count - 1];
    const tHW = hwA[count - 1];
    const blobA = 0.64 * Math.max(0, 1 - (progress / 0.92) ** 2.4);

    if (blobA > 0.015) {
      const hlX = tx - tHW * 0.24;
      const hlY = ty - tHW * 0.24;
      const grad = ctx.createRadialGradient(hlX, hlY, tHW * 0.04, tx, ty, tHW * 1.20);
      grad.addColorStop(0.00, `rgba(${Math.min(255, r + 35)},${Math.min(255, g + 28)},${Math.min(255, b + 20)},${+(blobA * BLOB_HIGHLIGHT_FACTOR).toFixed(3)})`);
      grad.addColorStop(0.40, `rgba(${r},${g},${b},${+blobA.toFixed(3)})`);
      grad.addColorStop(0.80, `rgba(${Math.max(0, r - 14)},${Math.max(0, g - 10)},${Math.max(0, b - 7)},${+(blobA * BLOB_MENISCUS_FACTOR).toFixed(3)})`);
      grad.addColorStop(1.00, `rgba(${r},${g},${b},0)`);

      ctx.shadowColor = `rgba(${Math.max(0, r - 65)},${Math.max(0, g - 58)},${Math.max(0, b - 50)},0.30)`;
      ctx.shadowBlur = tHW * 1.0;

      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(tx, ty, tHW * 1.20, 0, Math.PI * 2);
      ctx.fill();

      ctx.shadowBlur = 0;
      ctx.shadowColor = 'transparent';

      ctx.globalCompositeOperation = 'screen';
      ctx.fillStyle = `rgba(255, 251, 244, ${+(blobA * 0.80).toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(hlX, hlY, tHW * 0.30, 0, Math.PI * 2);
      ctx.fill();

      ctx.globalCompositeOperation = 'source-over';
    }
  }

  ctx.restore();
}

function renderScene(
  ctx: CanvasRenderingContext2D,
  strokes: Stroke[],
  elapsed: number,
  cw: number,
  ch: number,
  texture: HTMLImageElement | null,
  textureStrength: number,
  background: string,
) {
  ctx.clearRect(0, 0, cw, ch);
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, cw, ch);

  for (const s of strokes) {
    const se = elapsed - s.t0;
    if (se <= 0) continue;
    renderStroke(ctx, s, easeOutCubic(Math.min(1, se / s.dt)), cw, ch, texture, textureStrength);
  }
}

export default function LiquidBrushStrokeCanvas({
  textureSrc = '/brush-texture.webp',
  textureStrength = 0.70,
  background = '#F7F1E7',
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const rafRef = useRef<number | null>(null);
  const t0Ref = useRef<number | null>(null);

  const strokesRef = useRef<Stroke[] | null>(null);
  const sizeRef = useRef({ w: 0, h: 0 });

  const doneRef = useRef(false);

  const textureRef = useRef<HTMLImageElement | null>(null);
  const textureReadyRef = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Crisp rendering; clamp DPR for performance.
    const computeDpr = () => Math.min(window.devicePixelRatio ?? 1, 2);

    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    strokesRef.current = buildStrokes();
    doneRef.current = false;
    t0Ref.current = null;

    let cancelled = false;

    // Load photoreal texture (from /public)
    const img = new Image();
    img.decoding = 'async';
    img.loading = 'eager';
    img.src = textureSrc;

    img.onload = () => {
      if (cancelled) return;
      textureRef.current = img;
      textureReadyRef.current = true;

      // Redraw immediately with texture if already rendered
      const { w, h } = sizeRef.current;
      if (w && h && strokesRef.current) {
        const now = performance.now();
        const elapsed = prefersReduced
          ? ANIM_END
          : Math.min(((now - (t0Ref.current ?? now)) / 1000), ANIM_END);

        renderScene(ctx, strokesRef.current, elapsed, w, h, textureRef.current, textureStrength, background);
      }
    };

    img.onerror = () => {
      if (cancelled) return;
      textureRef.current = null;
      textureReadyRef.current = false;
      // Keep rendering without texture (still looks good, just less photoreal)
    };

    const resize = () => {
      const cw = container.offsetWidth;
      const ch = container.offsetHeight;
      const dpr = computeDpr();

      canvas.width = Math.max(1, Math.floor(cw * dpr));
      canvas.height = Math.max(1, Math.floor(ch * dpr));
      canvas.style.width = `${cw}px`;
      canvas.style.height = `${ch}px`;

      // Draw in CSS pixels
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      sizeRef.current = { w: cw, h: ch };
    };

    const drawFrame = (elapsed: number) => {
      const { w, h } = sizeRef.current;
      if (!strokesRef.current) return;

      renderScene(
        ctx,
        strokesRef.current,
        elapsed,
        w,
        h,
        textureReadyRef.current ? textureRef.current : null,
        textureStrength,
        background,
      );
    };

    const loop = (ts: number) => {
      if (cancelled) return;
      if (t0Ref.current === null) t0Ref.current = ts;

      const elapsed = (ts - t0Ref.current) / 1000;

      if (elapsed >= ANIM_END) {
        drawFrame(ANIM_END);
        doneRef.current = true;
        rafRef.current = null;
        return;
      }

      drawFrame(elapsed);
      rafRef.current = requestAnimationFrame(loop);
    };

    resize();

    if (prefersReduced) {
      drawFrame(ANIM_END);
      doneRef.current = true;
    } else {
      rafRef.current = requestAnimationFrame(loop);
    }

    const ro = new ResizeObserver(() => {
      resize();
      if (prefersReduced || doneRef.current) {
        drawFrame(ANIM_END);
      } else {
        const now = performance.now();
        const base = t0Ref.current ?? now;
        drawFrame(Math.min((now - base) / 1000, ANIM_END));
      }
    });

    ro.observe(container);

    return () => {
      cancelled = true;
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      ro.disconnect();
    };
  }, [textureSrc, textureStrength, background]);

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 overflow-hidden pointer-events-none"
      aria-hidden="true"
      style={{ willChange: 'transform' }}
    >
      <canvas ref={canvasRef} className="absolute inset-0" />
    </div>
  );
}
