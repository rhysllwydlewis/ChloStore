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

// ── Bezier sampling ────────────────────────────────────────────────────────────
function sampleCubicBezier(
  p0x: number, p0y: number,
  cp1x: number, cp1y: number,
  cp2x: number, cp2y: number,
  p3x: number, p3y: number,
  numSamples: number,
): [number, number][] {
  const pts: [number, number][] = [];
  for (let i = 0; i <= numSamples; i++) {
    const t = i / numSamples;
    const mt = 1 - t;
    pts.push([
      mt * mt * mt * p0x + 3 * mt * mt * t * cp1x + 3 * mt * t * t * cp2x + t * t * t * p3x,
      mt * mt * mt * p0y + 3 * mt * mt * t * cp1y + 3 * mt * t * t * cp2y + t * t * t * p3y,
    ]);
  }
  return pts;
}

// ── Per-frame normal vectors in pixel space ────────────────────────────────────
function computeNormalsPixel(
  ptsNorm: [number, number][],
  w: number,
  h: number,
): [number, number][] {
  return ptsNorm.map((_, i) => {
    const prev = ptsNorm[Math.max(0, i - 1)];
    const next = ptsNorm[Math.min(ptsNorm.length - 1, i + 1)];
    const dx = (next[0] - prev[0]) * w;
    const dy = (next[1] - prev[1]) * h;
    const len = Math.hypot(dx, dy) || 1;
    return [-dy / len, dx / len];
  });
}

// ── Easing ─────────────────────────────────────────────────────────────────────
function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

// ── Hex → RGB ──────────────────────────────────────────────────────────────────
function hexToRgb(hex: string): [number, number, number] {
  return [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ];
}

// ── Stroke data ────────────────────────────────────────────────────────────────
const NUM_SAMPLES = 100;

// After all strokes are fully painted on (~2.94 s), we keep a small buffer then stop.
const ANIMATION_END_TIME = 3.2;

// Wet-blob leading-edge fade parameters
const BLOB_BASE_ALPHA = 0.50;
const BLOB_FADE_EXPONENT = 6;

// Fraction of bristle-offset amplitude added as random jitter per stroke
const BRISTLE_JITTER_AMPLITUDE = 0.06;

interface StrokeDef {
  p0x: number; p0y: number;
  cp1x: number; cp1y: number;
  cp2x: number; cp2y: number;
  p3x: number; p3y: number;
  color: string;
  widthFactor: number;  // stroke width as fraction of canvas width
  startTime: number;    // seconds from page load
  duration: number;     // seconds to fully paint this stroke
  // Precomputed normalised sample points (stable across resize)
  points: [number, number][];
  // Deterministic bristle texture offsets/opacities
  bristleOffsets: number[];
  bristleOpacities: number[];
}

function buildStrokeDefs(): StrokeDef[] {
  const rand = mulberry32(0x3c7f9e2a);

  const rawDefs = [
    // 1 · Grand diagonal sweep — bottom-left arc to upper-right
    {
      p0x: 0.02, p0y: 0.80,
      cp1x: 0.18, cp1y: 0.32,
      cp2x: 0.56, cp2y: 0.15,
      p3x: 0.94, p3y: 0.20,
      color: '#D4B5A0',
      widthFactor: 0.10,
      startTime: 0.00,
      duration: 1.00,
    },
    // 2 · Wavy sweep across the centre
    {
      p0x: 0.04, p0y: 0.54,
      cp1x: 0.26, cp1y: 0.30,
      cp2x: 0.70, cp2y: 0.76,
      p3x: 0.97, p3y: 0.48,
      color: '#C9A083',
      widthFactor: 0.085,
      startTime: 0.40,
      duration: 0.92,
    },
    // 3 · Upper diagonal from left toward centre-right
    {
      p0x: 0.10, p0y: 0.07,
      cp1x: 0.30, cp1y: 0.02,
      cp2x: 0.52, cp2y: 0.18,
      p3x: 0.80, p3y: 0.40,
      color: '#E0C8B8',
      widthFactor: 0.074,
      startTime: 0.78,
      duration: 0.84,
    },
    // 4 · Lower gentle sweep
    {
      p0x: 0.06, p0y: 0.90,
      cp1x: 0.28, cp1y: 0.94,
      cp2x: 0.64, cp2y: 0.83,
      p3x: 0.96, p3y: 0.70,
      color: '#B8906E',
      widthFactor: 0.090,
      startTime: 1.15,
      duration: 0.88,
    },
    // 5 · Top-right corner accent
    {
      p0x: 0.60, p0y: 0.03,
      cp1x: 0.76, cp1y: 0.07,
      cp2x: 0.88, cp2y: 0.22,
      p3x: 0.98, p3y: 0.46,
      color: '#D9BDA8',
      widthFactor: 0.068,
      startTime: 1.50,
      duration: 0.74,
    },
    // 6 · Left-side descending stroke
    {
      p0x: 0.03, p0y: 0.16,
      cp1x: 0.07, cp1y: 0.40,
      cp2x: 0.16, cp2y: 0.64,
      p3x: 0.30, p3y: 0.94,
      color: '#C4956B',
      widthFactor: 0.070,
      startTime: 1.82,
      duration: 0.80,
    },
    // 7 · Wide bottom sweep
    {
      p0x: 0.22, p0y: 0.97,
      cp1x: 0.46, cp1y: 0.84,
      cp2x: 0.73, cp2y: 0.90,
      p3x: 0.97, p3y: 0.97,
      color: '#D4B5A0',
      widthFactor: 0.080,
      startTime: 2.10,
      duration: 0.84,
    },
  ];

  return rawDefs.map((def) => {
    const points = sampleCubicBezier(
      def.p0x, def.p0y,
      def.cp1x, def.cp1y,
      def.cp2x, def.cp2y,
      def.p3x, def.p3y,
      NUM_SAMPLES,
    );
    // 4 bristle lines at symmetric perpendicular offsets with small deterministic jitter
    const bristleOffsets = [-0.40, -0.24, 0.24, 0.40]
      .map((o) => o + (rand() - 0.5) * BRISTLE_JITTER_AMPLITUDE);
    const bristleOpacities = bristleOffsets.map(() => 0.07 + rand() * 0.06);
    return { ...def, points, bristleOffsets, bristleOpacities };
  });
}

// ── Draw a single stroke at the given eased progress [0, 1] ───────────────────
function drawStrokeAtProgress(
  ctx: CanvasRenderingContext2D,
  stroke: StrokeDef,
  progress: number,
  w: number,
  h: number,
) {
  const count = Math.max(2, Math.round(progress * (stroke.points.length - 1)) + 1);
  const pts = stroke.points;

  // Normals computed once per call in pixel space
  const normals = computeNormalsPixel(pts.slice(0, count), w, h);

  const sw = stroke.widthFactor * w; // stroke width in pixels
  const [r, g, b] = hexToRgb(stroke.color);

  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // Helper: pixel-space coordinate for a normalised sample point
  const toPx = (i: number): [number, number] => [pts[i][0] * w, pts[i][1] * h];

  // Helper: pixel coordinate offset perpendicular to the stroke
  const offsetPx = (i: number, fraction: number): [number, number] => {
    const [nx, ny] = normals[i];
    const [px, py] = toPx(i);
    return [px + nx * fraction * sw, py + ny * fraction * sw];
  };

  // Draw a polyline through the first `count` points, using a transform fn
  function drawPath(
    getPoint: (i: number) => [number, number],
    lineWidth: number,
    style: string,
    shadowColor?: string,
    shadowBlur?: number,
    shadowOffsetY?: number,
  ) {
    if (count < 2) return;
    ctx.lineWidth = lineWidth;
    ctx.strokeStyle = style;
    if (shadowColor) {
      ctx.shadowColor = shadowColor;
      ctx.shadowBlur = shadowBlur ?? 0;
      ctx.shadowOffsetY = shadowOffsetY ?? 0;
    }
    ctx.beginPath();
    const [x0, y0] = getPoint(0);
    ctx.moveTo(x0, y0);
    for (let i = 1; i < count; i++) {
      const [x, y] = getPoint(i);
      ctx.lineTo(x, y);
    }
    ctx.stroke();
    if (shadowColor) {
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
      ctx.shadowOffsetY = 0;
    }
  }

  // Layer 1 · Outer soft feather halo (no shadow)
  drawPath(toPx, sw * 2.8, `rgba(${r},${g},${b},0.10)`);

  // Layer 2 · Main creamy body with a subtle drop-shadow beneath
  drawPath(
    toPx, sw, `rgba(${r},${g},${b},0.65)`,
    `rgba(${Math.max(0, r - 50)},${Math.max(0, g - 50)},${Math.max(0, b - 50)},0.28)`,
    sw * 0.35, sw * 0.18,
  );

  // Layer 3 · Slightly lighter inner core — gives a creamy raised appearance
  drawPath(
    toPx, sw * 0.30,
    `rgba(${Math.min(255, r + 20)},${Math.min(255, g + 18)},${Math.min(255, b + 15)},0.22)`,
  );

  // Layer 4 · Bristle texture ridges (4 thin lines offset perpendicularly)
  for (let bi = 0; bi < stroke.bristleOffsets.length; bi++) {
    drawPath(
      (i) => offsetPx(i, stroke.bristleOffsets[bi]),
      sw * 0.09,
      `rgba(${r},${g},${b},${stroke.bristleOpacities[bi]})`,
    );
  }

  // Layer 5 · Shimmer highlight — catches light like wet foundation
  const shR = Math.min(255, r + 52);
  const shG = Math.min(255, g + 44);
  const shB = Math.min(255, b + 38);
  drawPath(
    (i) => offsetPx(i, -0.30),
    sw * 0.16,
    `rgba(${shR},${shG},${shB},0.32)`,
  );

  // Layer 6 · Wet leading-edge blob (visible only mid-animation, fades near end)
  if (progress < 0.97 && count >= 2) {
    const [lx, ly] = toPx(count - 1);
    const blobAlpha = BLOB_BASE_ALPHA * (1 - Math.pow(progress, BLOB_FADE_EXPONENT));
    ctx.shadowColor = `rgba(${Math.max(0, r - 30)},${Math.max(0, g - 30)},${Math.max(0, b - 30)},0.3)`;
    ctx.shadowBlur = sw * 0.5;
    ctx.fillStyle = `rgba(${r},${g},${b},${blobAlpha})`;
    ctx.beginPath();
    ctx.arc(lx, ly, sw * 0.52, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.shadowColor = 'transparent';
  }

  ctx.restore();
}

// ── Full scene draw (called every animation frame and on resize) ───────────────
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
        // Clamp to end time so all strokes render at exactly progress=1
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
      // Show the completed painting immediately
      renderFrame(ANIMATION_END_TIME);
    } else {
      rafRef.current = requestAnimationFrame(loop);
    }

    const resizeObserver = new ResizeObserver(() => {
      setSize();
      if (isDoneRef.current || reducedMotion) {
        renderFrame(ANIMATION_END_TIME);
      } else if (startTimeRef.current !== null) {
        // Re-render current progress immediately to avoid a blank-canvas flash
        // while the RAF loop is between ticks.
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
