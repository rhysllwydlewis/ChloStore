'use client';

import { useEffect, useRef } from 'react';

// ── Constants ─────────────────────────────────────────────────────────────────
const CYCLE_SECS = 22;
const SEED = 0xb3ef7a1c;
const CRACK_SEGS = 6; // polyline segments per crack edge
const MAX_CRACK_SEP = 7; // max shard separation pixels
const MAX_PARALLAX = 4; // max parallax pixels from pointer
const SMOOTH_FACTOR = 0.055; // pointer smooth lerp per frame
const SHIMMER_BASE = 0.82;
const SHIMMER_SPEED = 2.2;
const SHIMMER_PHASE_A = 0.137;
const SHIMMER_PHASE_B = 0.073;
const SHIMMER_AMPLITUDE = 0.3;
const PHASE_DELTA_THRESHOLD = 0.0005;
const PTR_DELTA_THRESHOLD = 0.5;

// ── Seeded PRNG (mulberry32) ──────────────────────────────────────────────────
function mulberry32(a: number): () => number {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ── Math helpers ──────────────────────────────────────────────────────────────
function smoothstep(t: number): number {
  return t * t * (3 - 2 * t);
}
function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}
function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}
function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
}

// ── Value noise (no external dependency) ─────────────────────────────────────
function ihash(x: number, y: number): number {
  let n = Math.imul(x * 1619 + y * 31337, 1376312589);
  n = Math.imul((n >> 16) ^ n, 0x45d9f3b);
  n = Math.imul((n >> 16) ^ n, 0x45d9f3b);
  return ((n >> 16) ^ n) & 0x7fffffff;
}
function valueNoise(x: number, y: number): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const ux = smoothstep(fx);
  const uy = smoothstep(fy);
  const toFloat = (n: number) => (n >>> 0) / 0x7fffffff;
  return lerp(
    lerp(toFloat(ihash(ix, iy)), toFloat(ihash(ix + 1, iy)), ux),
    lerp(toFloat(ihash(ix, iy + 1)), toFloat(ihash(ix + 1, iy + 1)), ux),
    uy,
  );
}

// ── Fracture data types ───────────────────────────────────────────────────────
interface Edge {
  pts: Float32Array; // flat [x0,y0, x1,y1, …] — (CRACK_SEGS+1)*2 values
  siteA: number;
  siteB: number;
  widthMultiplier: number;
  midX: number;
  midY: number;
  /** 0 = fully inside calm-center zone, 1 = full intensity at edges */
  centerFactor: number;
}

interface Shard {
  /** Unit outward displacement direction from fracture centroid */
  dx: number;
  dy: number;
  /** 0..1 — how far this shard is from canvas center */
  distFrac: number;
}

interface FractureData {
  edges: Edge[];
  shards: Shard[];
}

/** Pre-built static (resize-dependent) canvas gradients to avoid per-frame allocation */
interface StaticGrads {
  centerLight: CanvasGradient;
  vignette: CanvasGradient;
  noisePattern: CanvasPattern | null;
}

// ── Build fracture graph ──────────────────────────────────────────────────────
function buildFracture(w: number, h: number): FractureData {
  const rand = mulberry32(SEED);

  // Adaptive site count (45–80 based on viewport area)
  const N = clamp(Math.round(45 + ((w * h) / (1440 * 900)) * 35), 45, 80);
  const cols = Math.max(5, Math.round(Math.sqrt((N * w) / h)));
  const rows = Math.max(4, Math.round((cols * h) / w));
  const cellW = w / cols;
  const cellH = h / rows;

  // Jittered grid sites
  const siteX = new Float32Array(cols * rows);
  const siteY = new Float32Array(cols * rows);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const i = r * cols + c;
      siteX[i] = (c + 0.15 + rand() * 0.7) * cellW;
      siteY[i] = (r + 0.15 + rand() * 0.7) * cellH;
    }
  }

  // Shards — precompute outward direction and depth fraction
  // Fracture "centroid" is slightly above true center for hero composition
  const cx0 = w / 2;
  const cy0 = h * 0.45;
  const halfDiag = Math.hypot(w, h) / 2;
  const shards: Shard[] = [];
  for (let i = 0; i < cols * rows; i++) {
    const dcx = siteX[i] - cx0;
    const dcy = siteY[i] - cy0;
    const d = Math.hypot(dcx, dcy) || 0.001;
    shards.push({
      dx: dcx / d,
      dy: dcy / d,
      distFrac: Math.min(1, d / halfDiag),
    });
  }

  // Build crack edges from adjacent grid cells (4-connectivity + 2 diagonals)
  const noiseFreq = 0.019;
  const noiseAmpX = cellW * 0.38;
  const noiseAmpY = cellH * 0.38;
  const seen = new Set<string>();
  const edges: Edge[] = [];

  function addEdge(a: number, b: number) {
    if (a === b) return;
    const key = a < b ? `${a}:${b}` : `${b}:${a}`;
    if (seen.has(key)) return;
    seen.add(key);

    const ax = siteX[a];
    const ay = siteY[a];
    const bx = siteX[b];
    const by = siteY[b];
    const edx = bx - ax;
    const edy = by - ay;
    const elen = Math.hypot(edx, edy);
    if (elen < 0.001) return; // degenerate edge: sites too close, skip
    // Unit perpendicular for noise offset
    const pnx = -edy / elen;
    const pny = edx / elen;

    // Build polyline with value-noise jitter
    const pts = new Float32Array((CRACK_SEGS + 1) * 2);
    for (let i = 0; i <= CRACK_SEGS; i++) {
      const t = i / CRACK_SEGS;
      const px = ax + edx * t;
      const py = ay + edy * t;
      const n = valueNoise(px * noiseFreq, py * noiseFreq) * 2 - 1;
      const env = Math.sin(t * Math.PI); // zero at endpoints for smooth join
      pts[i * 2] = px + pnx * n * noiseAmpX * env;
      pts[i * 2 + 1] = py + pny * n * noiseAmpY * env;
    }

    const midX = (ax + bx) / 2;
    const midY = (ay + by) / 2;
    const dmx = midX - cx0;
    const dmy = midY - cy0;
    const midDist = Math.hypot(dmx, dmy) / halfDiag;
    // Calm-center mask: 0 in inner ~18%, ramps to 1 by ~63% radius
    const centerFactor = clamp(smoothstep(clamp((midDist - 0.18) / 0.45, 0, 1)), 0, 1);

    const widthMultiplier = 0.72 + (((ihash(a, b) & 1023) / 1023) * 0.9);
    edges.push({ pts, siteA: a, siteB: b, widthMultiplier, midX, midY, centerFactor });
  }

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const i = r * cols + c;
      if (c + 1 < cols) addEdge(i, i + 1);
      if (r + 1 < rows) addEdge(i, i + cols);
      if (c + 1 < cols && r + 1 < rows) addEdge(i, i + cols + 1);
      if (c > 0 && r + 1 < rows) addEdge(i, i + cols - 1);
    }
  }

  return { edges, shards };
}

// ── Noise grain texture (built once, tiled at draw time) ──────────────────────
// Uses unseeded Math.random() intentionally: fresh grain on each page load adds
// to the "live film" aesthetic without affecting the deterministic crack network.
function buildNoiseTexture(): HTMLCanvasElement {
  const sz = 256;
  const tc = document.createElement('canvas');
  tc.width = sz;
  tc.height = sz;
  const tctx = tc.getContext('2d')!;
  const img = tctx.createImageData(sz, sz);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const v = (Math.random() * 255) | 0;
    d[i] = d[i + 1] = d[i + 2] = v;
    d[i + 3] = 13; // ~5% opacity per grain pixel
  }
  tctx.putImageData(img, 0, 0);
  return tc;
}

// ── Phase → scalar helpers ────────────────────────────────────────────────────
// Phase 0→1 over CYCLE_SECS
//  0.00–0.20  pristine → cracks appear
//  0.20–0.50  cracks + seams intensify
//  0.50–0.75  shards separate (minimal, cinematic)
//  0.75–1.00  reverse to pristine

function crackAlpha(p: number): number {
  if (p < 0.2) return easeInOut(p / 0.2);
  if (p < 0.75) return 1;
  return easeInOut(1 - (p - 0.75) / 0.25);
}

function seamAlpha(p: number): number {
  if (p < 0.15) return 0;
  if (p < 0.35) return easeInOut((p - 0.15) / 0.2);
  if (p < 0.65) return 1;
  if (p < 0.85) return easeInOut(1 - (p - 0.65) / 0.2);
  return 0;
}

function shardSep(p: number): number {
  if (p < 0.45) return 0;
  if (p < 0.6) return easeInOut((p - 0.45) / 0.15);
  if (p < 0.7) return 1;
  if (p < 0.85) return easeInOut(1 - (p - 0.7) / 0.15);
  return 0;
}

// ── Main draw function ────────────────────────────────────────────────────────
function drawScene(
  ctx: CanvasRenderingContext2D,
  data: FractureData,
  staticGrads: StaticGrads,
  w: number,
  h: number,
  phase: number,
  ptrX: number,
  ptrY: number,
  elapsed: number,
) {
  const ca = crackAlpha(phase);
  const sa = seamAlpha(phase);
  const ss = shardSep(phase);

  // Pointer in normalized device coords (−1…+1)
  const npx = (ptrX / w - 0.5) * 2;
  const npy = (ptrY / h - 0.5) * 2;

  // ── 1. Base cream fill ────────────────────────────────────────────────────
  ctx.fillStyle = '#F7F1E7';
  ctx.fillRect(0, 0, w, h);

  // ── 2. Centre radial lighting (warm white glow) ───────────────────────────
  ctx.fillStyle = staticGrads.centerLight;
  ctx.fillRect(0, 0, w, h);

  const { edges, shards } = data;

  // ── 3. Shard separation gap fill ─────────────────────────────────────────
  // Draws cream-coloured ribbons between offset shard edges to simulate glass
  // shards drifting apart. The gap widens with `ss` and is suppressed near centre.
  if (ss > 0.005) {
    ctx.fillStyle = '#EDE5D9'; // slightly shadowed cream for gap interior
    for (let ei = 0; ei < edges.length; ei++) {
      const e = edges[ei];
      const sep = ss * e.centerFactor;
      if (sep < 0.006) continue;

      const shA = shards[e.siteA];
      const shB = shards[e.siteB];
      // Per-shard: separation displacement + pointer parallax
      const palA = MAX_PARALLAX * shA.distFrac * 0.45;
      const palB = MAX_PARALLAX * shB.distFrac * 0.45;
      const sax = shA.dx * sep * MAX_CRACK_SEP - npx * palA;
      const say = shA.dy * sep * MAX_CRACK_SEP - npy * palA;
      const sbx = shB.dx * sep * MAX_CRACK_SEP - npx * palB;
      const sby = shB.dy * sep * MAX_CRACK_SEP - npy * palB;

      const pts = e.pts;
      const n = pts.length >> 1; // point count
      ctx.beginPath();
      ctx.moveTo(pts[0] + sax, pts[1] + say);
      for (let i = 1; i < n; i++) ctx.lineTo(pts[i * 2] + sax, pts[i * 2 + 1] + say);
      ctx.lineTo(pts[(n - 1) * 2] + sbx, pts[(n - 1) * 2 + 1] + sby);
      for (let i = n - 2; i >= 0; i--) ctx.lineTo(pts[i * 2] + sbx, pts[i * 2 + 1] + sby);
      ctx.closePath();
      ctx.fill();
    }
  }

  // ── 4. Crack lines (dark brown, thin) ─────────────────────────────────────
  if (ca > 0.005) {
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    const baseCrackWidth = clamp(w / 1440, 0.5, 1.1) * 0.72;
    ctx.strokeStyle = '#3B2F2A';

    for (let ei = 0; ei < edges.length; ei++) {
      const e = edges[ei];
      const alpha = ca * e.centerFactor * 0.17;
      if (alpha < 0.004) continue;
      ctx.lineWidth = baseCrackWidth * e.widthMultiplier;

      const shA = shards[e.siteA];
      const shB = shards[e.siteB];
      const sep = ss * e.centerFactor;
      const palA = MAX_PARALLAX * shA.distFrac * 0.45;
      const palB = MAX_PARALLAX * shB.distFrac * 0.45;
      // Crack line follows average shard offset
      const ox =
        ((shA.dx * sep * MAX_CRACK_SEP - npx * palA) +
          (shB.dx * sep * MAX_CRACK_SEP - npx * palB)) /
        2;
      const oy =
        ((shA.dy * sep * MAX_CRACK_SEP - npy * palA) +
          (shB.dy * sep * MAX_CRACK_SEP - npy * palB)) /
        2;

      ctx.globalAlpha = alpha;
      const pts = e.pts;
      ctx.beginPath();
      ctx.moveTo(pts[0] + ox, pts[1] + oy);
      for (let i = 1; i < pts.length >> 1; i++) {
        ctx.lineTo(pts[i * 2] + ox, pts[i * 2 + 1] + oy);
      }
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  // ── 5. Gold kintsugi seams ────────────────────────────────────────────────
  // Pointer-reactive linear gradient creates fake specular highlight.
  // Warm champagne palette: #A37E4A → #C9A983 → #F2E6C9 → #D9C08C → #A37E4A
  if (sa > 0.005) {
    const angle = Math.atan2(npy, npx);
    const cos = Math.cos(angle + Math.PI / 2);
    const sin = Math.sin(angle + Math.PI / 2);
    const gl = Math.hypot(w, h) * 0.56;
    const goldGrad = ctx.createLinearGradient(
      w / 2 - cos * gl,
      h / 2 - sin * gl,
      w / 2 + cos * gl,
      h / 2 + sin * gl,
    );
    goldGrad.addColorStop(0, 'rgba(163,126,74,0.82)');
    goldGrad.addColorStop(0.28, 'rgba(201,169,131,0.92)');
    goldGrad.addColorStop(0.5, 'rgba(242,230,201,1.0)');
    goldGrad.addColorStop(0.72, 'rgba(217,192,140,0.92)');
    goldGrad.addColorStop(1, 'rgba(163,126,74,0.82)');

    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    const baseGoldWidth = clamp(w / 1440, 0.6, 1.2) * 1.25;
    ctx.strokeStyle = goldGrad;
    ctx.shadowColor = 'rgba(201,169,131,0.38)';
    ctx.shadowBlur = 2.5;

    for (let ei = 0; ei < edges.length; ei++) {
      const e = edges[ei];
      const shimmer =
        SHIMMER_BASE +
        (Math.sin(
          elapsed * SHIMMER_SPEED + (e.siteA * SHIMMER_PHASE_A + e.siteB * SHIMMER_PHASE_B) * Math.PI * 2,
        ) *
          0.5 +
          0.5) *
          SHIMMER_AMPLITUDE;
      const alpha = sa * e.centerFactor * shimmer;
      if (alpha < 0.012) continue;
      ctx.lineWidth = baseGoldWidth * e.widthMultiplier;

      const shA = shards[e.siteA];
      const shB = shards[e.siteB];
      const sep = ss * e.centerFactor;
      const palA = MAX_PARALLAX * shA.distFrac * 0.45;
      const palB = MAX_PARALLAX * shB.distFrac * 0.45;
      const ox =
        ((shA.dx * sep * MAX_CRACK_SEP - npx * palA) +
          (shB.dx * sep * MAX_CRACK_SEP - npx * palB)) /
        2;
      const oy =
        ((shA.dy * sep * MAX_CRACK_SEP - npy * palA) +
          (shB.dy * sep * MAX_CRACK_SEP - npy * palB)) /
        2;

      ctx.globalAlpha = alpha;
      const pts = e.pts;
      ctx.beginPath();
      ctx.moveTo(pts[0] + ox, pts[1] + oy);
      for (let i = 1; i < pts.length >> 1; i++) {
        ctx.lineTo(pts[i * 2] + ox, pts[i * 2 + 1] + oy);
      }
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  // ── 6. Specular glints at edge midpoints ─────────────────────────────────
  // Small bright champagne dots that sparkle along the seam network.
  if (sa > 0.25) {
    ctx.save();
    const glintR = clamp(w / 1440, 0.7, 1.4) * 1.5;
    for (let ei = 0; ei < edges.length; ei++) {
      const e = edges[ei];
      if (e.centerFactor < 0.3) continue;
      // Stagger glints per-edge using a hash of site indices
      const phaseOffset = (e.siteA * 0.137 + e.siteB * 0.073) % 1;
      const glintCycle = Math.sin((elapsed + phaseOffset * CYCLE_SECS) * 1.6) * 0.5 + 0.5;
      const glintA = glintCycle * 0.55 * sa * e.centerFactor;
      if (glintA < 0.06) continue;

      const shA = shards[e.siteA];
      const shB = shards[e.siteB];
      const sep = ss * e.centerFactor;
      const palA = MAX_PARALLAX * shA.distFrac * 0.45;
      const palB = MAX_PARALLAX * shB.distFrac * 0.45;
      const ox =
        ((shA.dx * sep * MAX_CRACK_SEP - npx * palA) +
          (shB.dx * sep * MAX_CRACK_SEP - npx * palB)) /
        2;
      const oy =
        ((shA.dy * sep * MAX_CRACK_SEP - npy * palA) +
          (shB.dy * sep * MAX_CRACK_SEP - npy * palB)) /
        2;

      ctx.globalAlpha = glintA;
      ctx.fillStyle = '#F2E6C9';
      ctx.beginPath();
      ctx.arc(e.midX + ox, e.midY + oy, glintR, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  // ── 7. Grain texture overlay (tiled 256×256, editorial feel) ─────────────
  if (staticGrads.noisePattern) {
    ctx.fillStyle = staticGrads.noisePattern;
    ctx.fillRect(0, 0, w, h);
  }

  // ── 8. Vignette overlay ───────────────────────────────────────────────────
  ctx.fillStyle = staticGrads.vignette;
  ctx.fillRect(0, 0, w, h);
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function KintsugiGlassCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number | null>(null);
  const sizeRef = useRef({ w: 0, h: 0 });
  const fractureRef = useRef<FractureData | null>(null);
  const noiseTexRef = useRef<HTMLCanvasElement | null>(null);
  const staticGradsRef = useRef<StaticGrads | null>(null);
  // Raw pointer position in canvas-local pixels
  const ptrRef = useRef({ x: 0, y: 0 });
  // Smoothed pointer (EMA) used for rendering
  const smoothPtrRef = useRef({ x: 0, y: 0 });
  const isOnScreenRef = useRef(false);
  const reducedMotionRef = useRef(false);
  const lastDrawTimeRef = useRef<number | null>(null);
  const lastDrawPhaseRef = useRef(0);
  const lastDrawPtrRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    reducedMotionRef.current = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const isMobile = 'ontouchstart' in window || window.matchMedia('(pointer: coarse)').matches;
    const targetFrameMs = isMobile ? 1000 / 30 : 1000 / 60;

    // Build the noise texture once — it is stable for the lifetime of the component
    noiseTexRef.current = buildNoiseTexture();

    function setSize() {
      const w = container!.offsetWidth;
      const h = container!.offsetHeight;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas!.width = w * dpr;
      canvas!.height = h * dpr;
      canvas!.style.width = `${w}px`;
      canvas!.style.height = `${h}px`;
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      sizeRef.current = { w, h };
      // Rebuild fracture graph — deterministic with fixed seed
      fractureRef.current = buildFracture(w, h);
      // Build static (resize-dependent) gradients — cached to avoid per-frame allocation
      const centerLight = ctx!.createRadialGradient(
        w * 0.5, h * 0.42, 0,
        w * 0.5, h * 0.42, w * 0.65,
      );
      centerLight.addColorStop(0, 'rgba(255,252,247,0.58)');
      centerLight.addColorStop(1, 'rgba(247,241,231,0)');
      const vignette = ctx!.createRadialGradient(
        w / 2, h / 2, Math.min(w, h) * 0.28,
        w / 2, h / 2, Math.hypot(w, h) / 2,
      );
      vignette.addColorStop(0, 'rgba(59,47,42,0)');
      vignette.addColorStop(1, 'rgba(59,47,42,0.14)');
      const noisePattern = noiseTexRef.current ? ctx!.createPattern(noiseTexRef.current, 'repeat') : null;
      staticGradsRef.current = { centerLight, vignette, noisePattern };
      // Centre the pointer for initial specular position
      ptrRef.current = { x: w / 2, y: h / 2 };
      smoothPtrRef.current = { x: w / 2, y: h / 2 };
    }

    function startLoop() {
      if (rafRef.current !== null) return;
      startTimeRef.current = null;
      lastTimeRef.current = null;
      rafRef.current = requestAnimationFrame(loop);
    }

    function stopLoop() {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    }

    function loop(time: number) {
      if (startTimeRef.current === null) startTimeRef.current = time;
      const elapsed = (time - startTimeRef.current) / 1000;
      const phase = (elapsed % CYCLE_SECS) / CYCLE_SECS;

      // Frame-rate-independent EMA: alpha scales with dt so 60 fps and 30 fps
      // feel identical (at 60 fps dt≈16.67 ms → alpha≈SMOOTH_FACTOR).
      const dt = lastTimeRef.current === null ? 16.67 : Math.min(time - lastTimeRef.current, 50);
      lastTimeRef.current = time;
      const alpha = 1 - Math.pow(1 - SMOOTH_FACTOR, dt / 16.67);

      // Smooth pointer towards raw target
      const sp = smoothPtrRef.current;
      const tp = ptrRef.current;
      sp.x += (tp.x - sp.x) * alpha;
      sp.y += (tp.y - sp.y) * alpha;

      // FPS throttle: skip draw if not enough time has passed since last draw
      const sinceLastDraw = lastDrawTimeRef.current === null ? Infinity : time - lastDrawTimeRef.current;
      if (sinceLastDraw >= targetFrameMs) {
        const phaseDelta = Math.abs(phase - lastDrawPhaseRef.current);
        const lpx = lastDrawPtrRef.current.x;
        const lpy = lastDrawPtrRef.current.y;
        if (phaseDelta > PHASE_DELTA_THRESHOLD || Math.abs(sp.x - lpx) > PTR_DELTA_THRESHOLD || Math.abs(sp.y - lpy) > PTR_DELTA_THRESHOLD) {
          const { w, h } = sizeRef.current;
          const fr = fractureRef.current;
          const nt = noiseTexRef.current;
          const sg = staticGradsRef.current;
          if (fr && nt && sg) {
            drawScene(ctx!, fr, sg, w, h, phase, sp.x, sp.y, elapsed);
            lastDrawTimeRef.current = time;
            lastDrawPhaseRef.current = phase;
            lastDrawPtrRef.current = { x: sp.x, y: sp.y };
          }
        }
      }

      rafRef.current = requestAnimationFrame(loop);
    }

    function drawStaticFrame() {
      const { w, h } = sizeRef.current;
      const fr = fractureRef.current;
      const nt = noiseTexRef.current;
      const sg = staticGradsRef.current;
      if (fr && nt && sg) {
        // Phase 0.35 — cracks visible + gold seams, no shard separation
        drawScene(ctx!, fr, sg, w, h, 0.35, w / 2, h / 2, 0);
      }
    }

    // ── Initialise size and fracture ────────────────────────────────────────
    setSize();

    if (reducedMotionRef.current) {
      // Render a single premium static frame; no RAF started
      drawStaticFrame();
    }

    // ── Pointer / touch tracking ────────────────────────────────────────────
    // Listen on window so events reach even with pointer-events:none on canvas
    // Skip listeners entirely when reduced motion is active (static frame, no parallax)
    function onPointerMove(e: PointerEvent) {
      const rect = container!.getBoundingClientRect();
      ptrRef.current = {
        x: clamp(e.clientX - rect.left, 0, rect.width),
        y: clamp(e.clientY - rect.top, 0, rect.height),
      };
    }
    function onTouchMove(e: TouchEvent) {
      if (e.touches.length > 0) {
        const rect = container!.getBoundingClientRect();
        ptrRef.current = {
          x: clamp(e.touches[0].clientX - rect.left, 0, rect.width),
          y: clamp(e.touches[0].clientY - rect.top, 0, rect.height),
        };
      }
    }
    if (!reducedMotionRef.current) {
      window.addEventListener('pointermove', onPointerMove, { passive: true });
      window.addEventListener('touchmove', onTouchMove, { passive: true });
    }

    // ── ResizeObserver ──────────────────────────────────────────────────────
    const resizeObserver = new ResizeObserver(() => {
      setSize();
      if (reducedMotionRef.current) drawStaticFrame();
    });
    resizeObserver.observe(container);

    // ── IntersectionObserver — pause RAF when hero is off-screen ───────────
    const intersectionObserver = new IntersectionObserver((entries) => {
      isOnScreenRef.current = entries[0].isIntersecting;
      if (entries[0].isIntersecting) {
        if (!reducedMotionRef.current) startLoop();
      } else {
        stopLoop();
      }
    });
    intersectionObserver.observe(container);

    // ── Pause / resume on tab visibility ───────────────────────────────────
    function onVisibilityChange() {
      if (document.hidden) {
        stopLoop();
      } else if (!reducedMotionRef.current && isOnScreenRef.current) {
        startLoop();
      }
    }
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      stopLoop();
      resizeObserver.disconnect();
      intersectionObserver.disconnect();
      document.removeEventListener('visibilitychange', onVisibilityChange);
      if (!reducedMotionRef.current) {
        window.removeEventListener('pointermove', onPointerMove);
        window.removeEventListener('touchmove', onTouchMove);
      }
    };
  }, []);

  return (
    <div ref={containerRef} className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true" style={{ willChange: 'transform' }}>
      <canvas ref={canvasRef} className="absolute inset-0" />
    </div>
  );
}
