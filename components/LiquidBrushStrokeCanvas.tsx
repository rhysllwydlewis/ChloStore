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
// Returns a [0,1] multiplier at normalised position t along the drawn portion.
// isLive: stroke is still animating (tip kept slightly fatter for wet-bead look)
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
  return [parseInt(hex.slice(1,3),16), parseInt(hex.slice(3,5),16), parseInt(hex.slice(5,7),16)];
}

// ── Types ──────────────────────────────────────────────────────────────────────
interface Bristle {
  frac: number;      // perpendicular offset as fraction of hw, in [-1, 1]
  alpha: number;
  lw: number;        // line-width in px
  isRidge: boolean;  // true = bright ridge, false = dark valley
}

interface Stroke {
  r: number; g: number; b: number;
  pts: [number, number][];
  maxHW: number;         // max half-width as fraction of canvas width
  t0: number;            // animation start (s)
  dt: number;            // animation duration (s)
  noiseL: Float32Array;
  noiseR: Float32Array;
  bristles: Bristle[];
  specFrac: number;      // lateral position of specular, fraction of hw (negative = left/lit side)
}

// ── Constants ─────────────────────────────────────────────────────────────────
const N_PTS = 200;      // bezier sample count — more = smoother polygon edges
const ANIM_END = 4.4;   // total animation duration (s)
const NOISE_AMP = 0.11; // edge noise amplitude relative to local hw
// Blob alpha multipliers — control how much brighter/darker the highlight and
// meniscus rim appear relative to the base blob alpha.
const BLOB_HIGHLIGHT_FACTOR = 1.18;  // inner highlight: slightly over-exposed
const BLOB_MENISCUS_FACTOR  = 0.82;  // outer meniscus rim: slightly under-exposed

// ── Build stroke data (deterministic via PRNG seed) ───────────────────────────
function buildStrokes(): Stroke[] {
  const rng = mulberry32(0xd3a7f1c9);

  // Slightly more saturated warm-beige/tan palette — real liquid foundation tones.
  const defs = [
    // 1 · Grand diagonal arc, bottom-left → upper-right
    { hex:'#C8956A', p0x:-0.03, p0y:0.86, c1x:0.12, c1y:0.26, c2x:0.52, c2y:0.04, p3x:1.03, p3y:0.18, hw:0.050, t0:0.00, dt:1.10 },
    // 2 · Wavy S-curve across the middle
    { hex:'#BE8A5E', p0x:-0.03, p0y:0.52, c1x:0.28, c1y:0.18, c2x:0.64, c2y:0.80, p3x:1.03, p3y:0.44, hw:0.042, t0:0.38, dt:1.00 },
    // 3 · Upper diagonal, left → centre-right
    { hex:'#D9BEA0', p0x: 0.04, p0y:0.06, c1x:0.26, c1y:0.00, c2x:0.50, c2y:0.18, p3x:0.88, p3y:0.42, hw:0.036, t0:0.76, dt:0.90 },
    // 4 · Lower broad base sweep
    { hex:'#AD7A52', p0x:-0.03, p0y:0.88, c1x:0.26, c1y:0.96, c2x:0.64, c2y:0.76, p3x:1.03, p3y:0.72, hw:0.046, t0:1.12, dt:0.94 },
    // 5 · Top-right corner accent
    { hex:'#D0B296', p0x: 0.54, p0y:0.00, c1x:0.74, c1y:0.04, c2x:0.88, c2y:0.22, p3x:1.03, p3y:0.48, hw:0.033, t0:1.50, dt:0.78 },
    // 6 · Left-side descending stroke
    { hex:'#BC8A62', p0x: 0.00, p0y:0.10, c1x:0.04, c1y:0.36, c2x:0.12, c2y:0.62, p3x:0.28, p3y:1.02, hw:0.034, t0:1.82, dt:0.84 },
    // 7 · Bottom anchoring sweep
    { hex:'#C8956A', p0x: 0.14, p0y:1.03, c1x:0.40, c1y:0.82, c2x:0.70, c2y:0.94, p3x:1.03, p3y:0.96, hw:0.040, t0:2.12, dt:0.88 },
    // 8 · Mid-canvas accent
    { hex:'#BE8A5E', p0x: 0.30, p0y:0.30, c1x:0.46, c1y:0.12, c2x:0.66, c2y:0.28, p3x:0.82, p3y:0.54, hw:0.029, t0:2.42, dt:0.72 },
  ];

  return defs.map(d => {
    const [r, g, b] = toRgb(d.hex);
    const pts = sampleBezier(d.p0x,d.p0y, d.c1x,d.c1y, d.c2x,d.c2y, d.p3x,d.p3y, N_PTS);
    const noiseL = bakeNoise(N_PTS + 1, rng, 7);
    const noiseR = bakeNoise(N_PTS + 1, rng, 7);

    // 28–38 bristle lines — roughly equal split between light ridges and dark valleys.
    // Ridges: slightly brighter, alpha 0.06–0.16.  Valleys: slightly darker, alpha 0.04–0.10.
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
      // Specular sits on the "lit" side: ~-34% to -44% of hw from spine centre.
      specFrac: -(0.34 + rng() * 0.10),
    };
  });
}

// ── Render one stroke at eased progress [0, 1] ────────────────────────────────
function renderStroke(
  ctx: CanvasRenderingContext2D,
  s: Stroke,
  progress: number,
  cw: number,
  ch: number,
) {
  const nPts  = s.pts.length;
  const count = Math.max(3, Math.round(progress * (nPts - 1)) + 1);
  const { r, g, b } = s;
  const nrm = computeNormals(s.pts.slice(0, count), cw, ch);
  const isLive = progress < 0.96;
  const maxHW = s.maxHW * cw;

  // ── Pre-compute geometry arrays ──────────────────────────────────────────────
  const spX = new Float32Array(count);
  const spY = new Float32Array(count);
  const hwA = new Float32Array(count);
  const lX  = new Float32Array(count);
  const lY  = new Float32Array(count);
  const rX  = new Float32Array(count);
  const rY  = new Float32Array(count);

  for (let i = 0; i < count; i++) {
    const t = count < 2 ? 0 : i / (count - 1);
    const hw = maxHW * widthProfile(t, isLive);
    hwA[i] = hw;
    spX[i] = s.pts[i][0] * cw;
    spY[i] = s.pts[i][1] * ch;
    const [nx, ny] = nrm[i];
    const nL = s.noiseL[i] * hw * NOISE_AMP;
    const nR = s.noiseR[i] * hw * NOISE_AMP;
    lX[i] = spX[i] + nx * (hw + nL);
    lY[i] = spY[i] + ny * (hw + nL);
    rX[i] = spX[i] - nx * (hw + nR);
    rY[i] = spY[i] - ny * (hw + nR);
  }

  // Fill a closed polygon between two parallel edge arrays.
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

  // Smooth inner-edge array at given fraction of hw from spine (positive = left).
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

  // ── A · Soft drop-shadow beneath the stroke ────────────────────────────────
  // Canvas native shadowBlur on a near-invisible fill → realistic soft depth.
  ctx.shadowColor   = `rgba(${Math.max(0,r-70)},${Math.max(0,g-64)},${Math.max(0,b-56)},0.32)`;
  ctx.shadowBlur    = maxHW * 0.72;
  ctx.shadowOffsetY = maxHW * 0.14;
  fillBetween(lX, lY, rX, rY, `rgba(${r},${g},${b},0.01)`);
  ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;

  // ── B · Main semi-transparent foundation body ──────────────────────────────
  // 0.74 opacity: you can slightly see the cream background — the "glass" look.
  fillBetween(lX, lY, rX, rY, `rgba(${r},${g},${b},0.74)`);

  // ── C · Volumetric depth — the centre is thicker so slightly more opaque ──
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

  // ── D · Surface-tension meniscus bead at each edge ────────────────────────
  // This darker outer strip is the single most distinctive visual property
  // of a liquid sitting on glass — surface tension thickens the edge.
  {
    const dr = Math.max(0, r - 32);
    const dg = Math.max(0, g - 26);
    const db = Math.max(0, b - 20);
    const [iLX, iLY] = makeInner(0.78);
    const [iRX, iRY] = makeInner(-0.78);
    fillBetween(lX, lY, iLX, iLY, `rgba(${dr},${dg},${db},0.30)`);
    fillBetween(iRX, iRY, rX, rY, `rgba(${dr},${dg},${db},0.30)`);
  }

  // ── E · Bristle micro-texture (foundation brush ridge/valley pattern) ──────
  // Light lines = raised bristle ridges   Dark lines = recessed bristle valleys
  // The combination creates the characteristic tactile look of foundation.
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
      if (i === 0) {
        ctx.moveTo(bx, by);
      } else {
        ctx.lineTo(bx, by);
      }
    }
    ctx.lineWidth   = br.lw;
    ctx.strokeStyle = `rgba(${tr},${tg},${tb},${br.alpha})`;
    ctx.stroke();
  }

  // ── F · Specular highlights — 'screen' blend for physically accurate gloss ─
  // The 'screen' composite operation models how light actually reflects off a
  // wet glossy surface: it brightens the destination without clamping.
  // This is the single technique that makes liquid look genuinely photorealistic.
  ctx.globalCompositeOperation = 'screen';

  // Secondary halo — broad, soft, low opacity
  ctx.beginPath();
  for (let i = 0; i < count; i++) {
    const [nx, ny] = nrm[i];
    const ox = spX[i] + nx * s.specFrac * hwA[i] * 0.80;
    const oy = spY[i] + ny * s.specFrac * hwA[i] * 0.80;
    if (i === 0) {
      ctx.moveTo(ox, oy);
    } else {
      ctx.lineTo(ox, oy);
    }
  }
  ctx.lineWidth   = 6.0;
  ctx.strokeStyle = 'rgba(255, 244, 228, 0.16)';
  ctx.stroke();

  // Primary specular — narrow, sharp, bright: the "wet glint"
  ctx.beginPath();
  for (let i = 0; i < count; i++) {
    const [nx, ny] = nrm[i];
    const ox = spX[i] + nx * s.specFrac * hwA[i];
    const oy = spY[i] + ny * s.specFrac * hwA[i];
    if (i === 0) {
      ctx.moveTo(ox, oy);
    } else {
      ctx.lineTo(ox, oy);
    }
  }
  ctx.lineWidth   = 1.7;
  ctx.strokeStyle = 'rgba(255, 252, 248, 0.86)';
  ctx.stroke();

  ctx.globalCompositeOperation = 'source-over';

  // ── G · Animated wet blob at the leading edge ──────────────────────────────
  // Models the bead of fresh, viscous liquid at the brush tip.
  // Uses a radial gradient: lighter highlight centre → foundation colour → dark
  // meniscus rim → transparent, exactly as a droplet looks under studio light.
  if (isLive && count >= 2) {
    const tx  = spX[count - 1];
    const ty  = spY[count - 1];
    const tHW = hwA[count - 1];
    // Blob alpha fades from strong at start to gone as stroke nears completion.
    const blobA = 0.64 * Math.max(0, 1 - (progress / 0.92) ** 2.4);

    if (blobA > 0.015) {
      // Highlight is offset toward upper-left of the blob (simulated key light).
      const hlX = tx - tHW * 0.24;
      const hlY = ty - tHW * 0.24;
      const grad = ctx.createRadialGradient(hlX, hlY, tHW * 0.04, tx, ty, tHW * 1.20);
      grad.addColorStop(0.00, `rgba(${Math.min(255, r + 35)},${Math.min(255, g + 28)},${Math.min(255, b + 20)},${+(blobA * BLOB_HIGHLIGHT_FACTOR).toFixed(3)})`);
      grad.addColorStop(0.40, `rgba(${r},${g},${b},${+blobA.toFixed(3)})`);
      grad.addColorStop(0.80, `rgba(${Math.max(0, r - 14)},${Math.max(0, g - 10)},${Math.max(0, b - 7)},${+(blobA * BLOB_MENISCUS_FACTOR).toFixed(3)})`);
      grad.addColorStop(1.00, `rgba(${r},${g},${b},0)`);

      ctx.shadowColor = `rgba(${Math.max(0, r - 65)},${Math.max(0, g - 58)},${Math.max(0, b - 50)},0.30)`;
      ctx.shadowBlur  = tHW * 1.0;
      ctx.fillStyle   = grad;
      ctx.beginPath();
      ctx.arc(tx, ty, tHW * 1.20, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0; ctx.shadowColor = 'transparent';

      // Tiny screen-blend specular dot on the blob surface — the "glint" on the bead.
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

// ── Full scene render ──────────────────────────────────────────────────────────
function renderScene(
  ctx: CanvasRenderingContext2D,
  strokes: Stroke[],
  elapsed: number,
  cw: number,
  ch: number,
) {
  ctx.fillStyle = '#F7F1E7';
  ctx.fillRect(0, 0, cw, ch);
  for (const s of strokes) {
    const se = elapsed - s.t0;
    if (se <= 0) continue;
    renderStroke(ctx, s, easeOutCubic(Math.min(1, se / s.dt)), cw, ch);
  }
}

// ── Component ──────────────────────────────────────────────────────────────────
export default function LiquidBrushStrokeCanvas() {
  const canvasRef    = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const rafRef       = useRef<number | null>(null);
  const t0Ref        = useRef<number | null>(null);
  const strokesRef   = useRef<Stroke[] | null>(null);
  const sizeRef      = useRef({ w: 0, h: 0 });
  const doneRef      = useRef(false);

  useEffect(() => {
    const canvas    = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    strokesRef.current = buildStrokes();

    function resize() {
      const cw  = container!.offsetWidth;
      const ch  = container!.offsetHeight;
      const dpr = Math.min(window.devicePixelRatio ?? 1, 2);
      canvas!.width  = cw * dpr;
      canvas!.height = ch * dpr;
      canvas!.style.width  = `${cw}px`;
      canvas!.style.height = `${ch}px`;
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      sizeRef.current = { w: cw, h: ch };
    }

    function frame(elapsed: number) {
      const { w, h } = sizeRef.current;
      if (strokesRef.current) renderScene(ctx!, strokesRef.current, elapsed, w, h);
    }

    function loop(ts: number) {
      if (t0Ref.current === null) t0Ref.current = ts;
      const elapsed = (ts - t0Ref.current) / 1000;
      if (elapsed >= ANIM_END) {
        frame(ANIM_END);
        doneRef.current = true;
        rafRef.current  = null;
        return;
      }
      frame(elapsed);
      rafRef.current = requestAnimationFrame(loop);
    }

    resize();

    if (prefersReduced) {
      frame(ANIM_END);
    } else {
      rafRef.current = requestAnimationFrame(loop);
    }

    const ro = new ResizeObserver(() => {
      resize();
      if (doneRef.current || prefersReduced) {
        frame(ANIM_END);
      } else if (t0Ref.current !== null) {
        // Redraw at current progress immediately so there is no blank-canvas flash.
        frame(Math.min((performance.now() - t0Ref.current) / 1000, ANIM_END));
      }
    });
    ro.observe(container);

    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      ro.disconnect();
    };
  }, []);

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
