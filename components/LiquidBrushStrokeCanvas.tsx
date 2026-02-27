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
function sampleCubicBezier(
  p0x: number, p0y: number,
  cp1x: number, cp1y: number,
  cp2x: number, cp2y: number,
  p3x: number, p3y: number,
  n: number,
): [number, number][] {
  const pts: [number, number][] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const mt = 1 - t;
    pts.push([
      mt * mt * mt * p0x + 3 * mt * mt * t * cp1x + 3 * mt * t * t * cp2x + t * t * t * p3x,
      mt * mt * mt * p0y + 3 * mt * mt * t * cp1y + 3 * mt * t * t * cp2y + t * t * t * p3y,
    ]);
  }
  return pts;
}

// ── Per-point perpendicular normals in pixel space ─────────────────────────────
function computeNormals(
  pts: [number, number][],
  w: number,
  h: number,
): [number, number][] {
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
function easeOutCubic(t: number): number {
  return 1 - (1 - t) ** 3;
}

// ── Half-width profile along a stroke ─────────────────────────────────────────
// t        – position along the *drawn* portion [0, 1]
// isLive   – stroke tip is still animating (not yet complete)
// maxHW    – maximum half-width in pixels
function halfWidthAt(t: number, isLive: boolean, maxHW: number): number {
  // Press-in at start: quick ramp over the first ~3 %
  const entry = t < 0.03 ? (t / 0.03) ** 0.65 : 1.0;

  // Lift-off at tip:
  //   during animation → thin wet-tip zone (last 6 %)
  //   when complete    → natural brush-lift taper (last 20 %)
  const tipLen = isLive ? 0.06 : 0.20;
  const tipPow = isLive ? 0.38 : 1.05;
  const tip =
    t > 1.0 - tipLen
      ? ((1.0 - t) / tipLen) ** tipPow
      : 1.0;

  return maxHW * entry * tip;
}

// ── Types ──────────────────────────────────────────────────────────────────────
interface BristleDef {
  perpFrac: number;  // lateral offset as fraction of half-width
  opacity: number;
  width: number;     // line width in pixels
}

interface StrokeDef {
  p0x: number; p0y: number;
  cp1x: number; cp1y: number;
  cp2x: number; cp2y: number;
  p3x: number; p3y: number;
  r: number; g: number; b: number;
  halfWidthFactor: number; // max half-width as fraction of canvas width
  startTime: number;       // seconds after page load
  duration: number;        // seconds to paint fully
  points: [number, number][];
  edgeNoiseL: number[];    // per-sample noise multiplier in (-1, 1), left edge
  edgeNoiseR: number[];    // per-sample noise multiplier in (-1, 1), right edge
  bristles: BristleDef[];
}

// ── Hex → RGB ──────────────────────────────────────────────────────────────────
function hexToRgb(hex: string): [number, number, number] {
  return [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ];
}

// ── Constants ──────────────────────────────────────────────────────────────────
const NUM_SAMPLES = 140;       // bezier sample count — high enough for smooth polygons
const ANIMATION_END_TIME = 3.6;
const BLOB_BASE_ALPHA = 0.52;
const BLOB_FADE_EXP = 2.2;

// ── Build stroke definitions (deterministic) ───────────────────────────────────
function buildStrokeDefs(): StrokeDef[] {
  const rand = mulberry32(0x9fa2c3e1);

  // Generate smooth low-frequency noise for organic edge texture.
  // Uses cosine interpolation between sparse random control points.
  function smoothNoise(n: number): number[] {
    const step = 10; // one control value every ~10 samples
    const nCtrl = Math.ceil(n / step) + 2;
    const ctrl = Array.from({ length: nCtrl }, () => (rand() - 0.5) * 2);
    return Array.from({ length: n }, (_, i) => {
      const fi = i / step;
      const lo = Math.floor(fi);
      const hi = Math.min(lo + 1, nCtrl - 1);
      const frac = fi - lo;
      // Hermite smoothstep
      const s = frac * frac * (3 - 2 * frac);
      return ctrl[lo] + (ctrl[hi] - ctrl[lo]) * s;
    });
  }

  // Stroke path definitions — carefully chosen to spread artfully across the canvas
  // and evoke the reference images (diagonal sweeps, wavy smears, corner accents).
  const rawDefs = [
    // 1 · Grand arc — lower-left sweeping up to upper-right
    { hex: '#D4B5A0', p0x: -0.02, p0y: 0.84, cp1x: 0.14, cp1y: 0.28, cp2x: 0.54, cp2y: 0.06, p3x: 1.02, p3y: 0.20, hw: 0.052, start: 0.00, dur: 1.05 },
    // 2 · Wavy S-curve sweeping across the middle third
    { hex: '#C9A083', p0x: -0.02, p0y: 0.54, cp1x: 0.30, cp1y: 0.20, cp2x: 0.66, cp2y: 0.80, p3x: 1.02, p3y: 0.46, hw: 0.044, start: 0.36, dur: 0.96 },
    // 3 · Upper diagonal, left side down to centre-right
    { hex: '#E0C8B8', p0x: 0.06, p0y: 0.04, cp1x: 0.28, cp1y: -0.02, cp2x: 0.52, cp2y: 0.22, p3x: 0.86, p3y: 0.44, hw: 0.038, start: 0.74, dur: 0.88 },
    // 4 · Lower broad sweep — base layer
    { hex: '#B8906E', p0x: -0.02, p0y: 0.90, cp1x: 0.28, cp1y: 0.96, cp2x: 0.64, cp2y: 0.78, p3x: 1.02, p3y: 0.74, hw: 0.048, start: 1.10, dur: 0.92 },
    // 5 · Top-right corner accent
    { hex: '#D9BDA8', p0x: 0.56, p0y: 0.00, cp1x: 0.74, cp1y: 0.06, cp2x: 0.88, cp2y: 0.24, p3x: 1.02, p3y: 0.50, hw: 0.034, start: 1.46, dur: 0.76 },
    // 6 · Left-side descending stroke
    { hex: '#C4956B', p0x: 0.00, p0y: 0.12, cp1x: 0.05, cp1y: 0.38, cp2x: 0.12, cp2y: 0.64, p3x: 0.26, p3y: 0.98, hw: 0.036, start: 1.78, dur: 0.82 },
    // 7 · Bottom anchoring sweep
    { hex: '#D4B5A0', p0x: 0.16, p0y: 1.02, cp1x: 0.42, cp1y: 0.84, cp2x: 0.72, cp2y: 0.94, p3x: 1.02, p3y: 0.98, hw: 0.042, start: 2.06, dur: 0.86 },
    // 8 · Short centre accent — adds focal complexity
    { hex: '#C9A083', p0x: 0.32, p0y: 0.28, cp1x: 0.50, cp1y: 0.14, cp2x: 0.68, cp2y: 0.32, p3x: 0.84, p3y: 0.56, hw: 0.030, start: 2.34, dur: 0.68 },
  ];

  return rawDefs.map((def) => {
    const [r, g, b] = hexToRgb(def.hex);
    const points = sampleCubicBezier(
      def.p0x, def.p0y,
      def.cp1x, def.cp1y,
      def.cp2x, def.cp2y,
      def.p3x, def.p3y,
      NUM_SAMPLES,
    );
    const edgeNoiseL = smoothNoise(NUM_SAMPLES + 1);
    const edgeNoiseR = smoothNoise(NUM_SAMPLES + 1);

    // 13–17 bristle lines spanning almost the full width of the stroke.
    // These create the characteristic parallel-ridge texture of a foundation brush.
    const bristleCount = 13 + Math.floor(rand() * 5);
    const bristles: BristleDef[] = Array.from({ length: bristleCount }, () => ({
      perpFrac: (rand() * 2 - 1) * 0.90,
      opacity: 0.045 + rand() * 0.075,
      width: 0.7 + rand() * 1.4,
    }));

    return {
      p0x: def.p0x, p0y: def.p0y,
      cp1x: def.cp1x, cp1y: def.cp1y,
      cp2x: def.cp2x, cp2y: def.cp2y,
      p3x: def.p3x, p3y: def.p3y,
      r, g, b,
      halfWidthFactor: def.hw,
      startTime: def.start,
      duration: def.dur,
      points,
      edgeNoiseL,
      edgeNoiseR,
      bristles,
    };
  });
}

// ── Draw a single stroke as a layered filled polygon ──────────────────────────
function drawStrokeAtProgress(
  ctx: CanvasRenderingContext2D,
  stroke: StrokeDef,
  progress: number,
  w: number,
  h: number,
) {
  const totalPts = stroke.points.length; // NUM_SAMPLES + 1
  const count = Math.max(3, Math.round(progress * (totalPts - 1)) + 1);
  const pts = stroke.points;

  const normals = computeNormals(pts.slice(0, count), w, h);
  const maxHW = stroke.halfWidthFactor * w;
  const { r, g, b } = stroke;
  const isLive = progress < 0.96;
  const noiseAmp = 0.11; // edge noise amplitude as fraction of local half-width

  // Pre-compute pixel-space spine + both edges ─────────────────────────────────
  const spX = new Float32Array(count);
  const spY = new Float32Array(count);
  const hwArr = new Float32Array(count);
  const lX = new Float32Array(count);
  const lY = new Float32Array(count);
  const rX = new Float32Array(count);
  const rY = new Float32Array(count);

  for (let i = 0; i < count; i++) {
    const tDrawn = (count < 2) ? 0 : i / (count - 1);
    const hw = halfWidthAt(tDrawn, isLive, maxHW);
    hwArr[i] = hw;

    const sx = pts[i][0] * w;
    const sy = pts[i][1] * h;
    spX[i] = sx;
    spY[i] = sy;

    const [nx, ny] = normals[i];
    // Edge noise scales with the local width — naturally fades to 0 at the tapered tips
    const nL = stroke.edgeNoiseL[i] * hw * noiseAmp;
    const nR = stroke.edgeNoiseR[i] * hw * noiseAmp;

    lX[i] = sx + nx * (hw + nL);
    lY[i] = sy + ny * (hw + nL);
    rX[i] = sx - nx * (hw + nR);
    rY[i] = sy - ny * (hw + nR);
  }

  // Helper — fill the polygon bounded by two edge arrays ───────────────────────
  function fillPoly(
    aX: Float32Array, aY: Float32Array,
    bX: Float32Array, bY: Float32Array,
    style: string,
  ) {
    if (count < 2) return;
    ctx.beginPath();
    ctx.moveTo(aX[0], aY[0]);
    for (let i = 1; i < count; i++) ctx.lineTo(aX[i], aY[i]);
    for (let i = count - 1; i >= 0; i--) ctx.lineTo(bX[i], bY[i]);
    ctx.closePath();
    ctx.fillStyle = style;
    ctx.fill();
  }

  ctx.save();

  // ── Layer 1 · Drop shadow (canvas native shadowBlur) ──────────────────────
  // Draw the main polygon with shadow enabled — gives genuine soft depth.
  {
    const sR = Math.max(0, r - 45);
    const sG = Math.max(0, g - 45);
    const sB = Math.max(0, b - 45);
    ctx.shadowColor = `rgba(${sR},${sG},${sB},0.30)`;
    ctx.shadowBlur = maxHW * 0.55;
    ctx.shadowOffsetY = maxHW * 0.16;
    fillPoly(lX, lY, rX, rY, `rgba(${r},${g},${b},0.72)`);
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
  }

  // ── Layer 2 · Edge darkening — thin strips along each outer edge ───────────
  // Simulates the shadow where the stroke thins toward the edges.
  {
    const edgeFrac = 0.24;
    const dR = Math.max(0, r - 16);
    const dG = Math.max(0, g - 16);
    const dB = Math.max(0, b - 16);

    const ilX = new Float32Array(count);
    const ilY = new Float32Array(count);
    const irX = new Float32Array(count);
    const irY = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      const [nx, ny] = normals[i];
      const innerHW = hwArr[i] * (1 - edgeFrac);
      ilX[i] = spX[i] + nx * (innerHW + stroke.edgeNoiseL[i] * hwArr[i] * noiseAmp);
      ilY[i] = spY[i] + ny * (innerHW + stroke.edgeNoiseL[i] * hwArr[i] * noiseAmp);
      irX[i] = spX[i] - nx * (innerHW + stroke.edgeNoiseR[i] * hwArr[i] * noiseAmp);
      irY[i] = spY[i] - ny * (innerHW + stroke.edgeNoiseR[i] * hwArr[i] * noiseAmp);
    }
    fillPoly(lX, lY, ilX, ilY, `rgba(${dR},${dG},${dB},0.14)`);
    fillPoly(irX, irY, rX, rY, `rgba(${dR},${dG},${dB},0.14)`);
  }

  // ── Layer 3 · Centre highlight ridge ──────────────────────────────────────
  // A lighter-toned inner strip along the spine gives a raised, creamy appearance.
  {
    const cFrac = 0.30;
    const hR = Math.min(255, r + 32);
    const hG = Math.min(255, g + 26);
    const hB = Math.min(255, b + 20);
    const cLX = new Float32Array(count);
    const cLY = new Float32Array(count);
    const cRX = new Float32Array(count);
    const cRY = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      const [nx, ny] = normals[i];
      const chw = hwArr[i] * cFrac;
      cLX[i] = spX[i] + nx * chw;
      cLY[i] = spY[i] + ny * chw;
      cRX[i] = spX[i] - nx * chw;
      cRY[i] = spY[i] - ny * chw;
    }
    fillPoly(cLX, cLY, cRX, cRY, `rgba(${hR},${hG},${hB},0.28)`);
  }

  // ── Layer 4 · Bristle texture lines ───────────────────────────────────────
  // Thin polylines running along the stroke at various perpendicular offsets
  // create the characteristic ridge pattern of a real foundation brush.
  ctx.lineCap = 'round';
  for (const bristle of stroke.bristles) {
    ctx.beginPath();
    for (let i = 0; i < count; i++) {
      const [nx, ny] = normals[i];
      const bx = spX[i] + nx * bristle.perpFrac * hwArr[i];
      const by = spY[i] + ny * bristle.perpFrac * hwArr[i];
      if (i === 0) ctx.moveTo(bx, by);
      else ctx.lineTo(bx, by);
    }
    ctx.lineWidth = bristle.width;
    ctx.strokeStyle = `rgba(${r},${g},${b},${bristle.opacity})`;
    ctx.stroke();
  }

  // ── Layer 5 · Shimmer highlight on the "lit" edge ─────────────────────────
  // A bright, thin line along the left edge catches light like wet foundation.
  {
    const shR = Math.min(255, r + 68);
    const shG = Math.min(255, g + 56);
    const shB = Math.min(255, b + 46);
    ctx.beginPath();
    ctx.moveTo(lX[0], lY[0]);
    for (let i = 1; i < count; i++) ctx.lineTo(lX[i], lY[i]);
    ctx.lineWidth = 1.6;
    ctx.strokeStyle = `rgba(${shR},${shG},${shB},0.50)`;
    ctx.stroke();
  }

  // ── Layer 6 · Wet leading-edge blob (mid-animation only) ──────────────────
  // A small pool of foundation at the paint front, fading as progress reaches 1.
  if (isLive && count >= 2) {
    const tipHW = hwArr[count - 1];
    const blobAlpha = BLOB_BASE_ALPHA * (1 - progress ** BLOB_FADE_EXP);
    const sR = Math.max(0, r - 40);
    const sG = Math.max(0, g - 40);
    const sB = Math.max(0, b - 40);
    ctx.shadowColor = `rgba(${sR},${sG},${sB},0.28)`;
    ctx.shadowBlur = tipHW * 0.7;
    ctx.fillStyle = `rgba(${r},${g},${b},${blobAlpha})`;
    ctx.beginPath();
    ctx.arc(spX[count - 1], spY[count - 1], tipHW * 0.85 + 1.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.shadowColor = 'transparent';
  }

  ctx.restore();
}

// ── Full scene ─────────────────────────────────────────────────────────────────
function drawScene(
  ctx: CanvasRenderingContext2D,
  strokes: StrokeDef[],
  elapsed: number,
  w: number,
  h: number,
) {
  ctx.fillStyle = '#F7F1E7';
  ctx.fillRect(0, 0, w, h);

  for (const stroke of strokes) {
    const strokeElapsed = elapsed - stroke.startTime;
    if (strokeElapsed <= 0) continue;
    const rawProgress = Math.min(1, strokeElapsed / stroke.duration);
    drawStrokeAtProgress(ctx, stroke, easeOutCubic(rawProgress), w, h);
  }
}

// ── Component ──────────────────────────────────────────────────────────────────
export default function LiquidBrushStrokeCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const strokesRef = useRef<StrokeDef[] | null>(null);
  const sizeRef = useRef({ w: 0, h: 0 });
  const isDoneRef = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    strokesRef.current = buildStrokeDefs();

    function setSize() {
      const cw = container!.offsetWidth;
      const ch = container!.offsetHeight;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas!.width = cw * dpr;
      canvas!.height = ch * dpr;
      canvas!.style.width = `${cw}px`;
      canvas!.style.height = `${ch}px`;
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      sizeRef.current = { w: cw, h: ch };
    }

    function renderFrame(elapsed: number) {
      const { w, h } = sizeRef.current;
      const strokes = strokesRef.current;
      if (!strokes) return;
      drawScene(ctx!, strokes, elapsed, w, h);
    }

    function loop(time: number) {
      if (startTimeRef.current === null) startTimeRef.current = time;
      const elapsed = (time - startTimeRef.current) / 1000;

      if (elapsed >= ANIMATION_END_TIME) {
        renderFrame(ANIMATION_END_TIME);
        isDoneRef.current = true;
        rafRef.current = null;
        return;
      }

      renderFrame(elapsed);
      rafRef.current = requestAnimationFrame(loop);
    }

    setSize();

    if (reducedMotion) {
      renderFrame(ANIMATION_END_TIME);
    } else {
      rafRef.current = requestAnimationFrame(loop);
    }

    const resizeObserver = new ResizeObserver(() => {
      setSize();
      if (isDoneRef.current || reducedMotion) {
        renderFrame(ANIMATION_END_TIME);
      } else if (startTimeRef.current !== null) {
        // Re-render at current progress to avoid a blank-canvas flash
        // between setSize() clearing the canvas and the next RAF tick.
        const elapsed = (performance.now() - startTimeRef.current) / 1000;
        renderFrame(Math.min(elapsed, ANIMATION_END_TIME));
      }
    });
    resizeObserver.observe(container);

    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      resizeObserver.disconnect();
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
