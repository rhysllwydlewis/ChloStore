'use client';

import { useEffect, useRef } from 'react';

// ── Constants ─────────────────────────────────────────────────────────────────
const SEED = 0xa4c2e971;
const SMOOTH_FACTOR = 0.055;
const PHASE_DELTA_THRESHOLD = 0.0004;
const PTR_DELTA_THRESHOLD = 0.5;

// Stroke animation speed (full sine cycle per second)
const STROKE_SWAY_SPEED = 0.18;
// Blob pulse speed
const BLOB_PULSE_SPEED = 0.22;
// Particle drift speed (canvas-heights per second)
const PARTICLE_SPEED = 0.025;
// Mobile beauty-light sway parameters
const MOBILE_SWAY_IDLE_MS = 2000;      // ms of no-touch before sway takes over
const MOBILE_SWAY_FREQ_X = 0.35;       // horizontal oscillation frequency (Hz)
const MOBILE_SWAY_FREQ_Y = 0.22;       // vertical oscillation frequency (Hz)
const MOBILE_SWAY_AMP_X = 0.06;        // horizontal amplitude (fraction of canvas width)
const MOBILE_SWAY_AMP_Y = 0.04;        // vertical amplitude (fraction of canvas height)

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

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

// ── Cosmetics palette ─────────────────────────────────────────────────────────
const STROKE_COLOURS = [
  'rgba(214,186,163,0.25)',
  'rgba(196,164,140,0.3)',
  'rgba(199,155,148,0.22)',
  'rgba(183,133,137,0.2)',
  'rgba(228,210,186,0.28)',
  'rgba(237,224,206,0.2)',
  'rgba(176,146,154,0.18)',
];

// ── Data types ────────────────────────────────────────────────────────────────
interface BrushStroke {
  // Base control points (normalised 0–1 relative to canvas)
  p0x: number; p0y: number;
  cp1x: number; cp1y: number;
  cp2x: number; cp2y: number;
  p3x: number; p3y: number;
  colour: string;
  baseWidth: number;
  // Animation phase offsets
  swayPhase: number;
  swayAmpX: number;
  swayAmpY: number;
}

interface DewyBlob {
  cx: number; cy: number; // normalised 0–1
  r: number;              // normalised radius
  pulsePhase: number;
  driftPhase: number;
  driftAmp: number;
  colour: string;
}

interface ShimmerParticle {
  x: number; y: number; // normalised 0–1
  radius: number;
  opacityPhase: number;
  driftPhase: number;
  speed: number;       // normalised per frame
  colour: string;
}

interface SceneData {
  strokes: BrushStroke[];
  blobs: DewyBlob[];
  particles: ShimmerParticle[];
}

/** Pre-built static (resize-dependent) canvas resources to avoid per-frame allocation */
interface StaticResources {
  vignette: CanvasGradient;
  noisePattern: CanvasPattern | null;
}

// ── Build scene data (deterministic, seed-based) ──────────────────────────────
function buildSceneData(): SceneData {
  const rand = mulberry32(SEED);

  // 5–8 brush strokes
  const strokeCount = 5 + Math.floor(rand() * 4); // 5–8
  const strokes: BrushStroke[] = [];
  for (let i = 0; i < strokeCount; i++) {
    // Advance PRNG to consume variety seeds (influence implicit via sequence)
    rand(); rand(); rand();
    const p0x = rand() < 0.6 ? -0.05 + rand() * 0.25 : rand() * 0.3;
    const p0y = 0.05 + rand() * 0.9;
    const p3x = 0.7 + rand() * 0.35;
    const p3y = 0.05 + rand() * 0.9;
    const perpX = -(p3y - p0y);
    const perpY = p3x - p0x;
    const perpLen = Math.hypot(perpX, perpY) || 1;
    const bow = (rand() - 0.5) * 0.35;
    strokes.push({
      p0x,
      p0y,
      cp1x: p0x + (p3x - p0x) * 0.3 + perpX / perpLen * bow + (rand() - 0.5) * 0.12,
      cp1y: p0y + (p3y - p0y) * 0.3 + perpY / perpLen * bow + (rand() - 0.5) * 0.12,
      cp2x: p0x + (p3x - p0x) * 0.7 + perpX / perpLen * bow + (rand() - 0.5) * 0.12,
      cp2y: p0y + (p3y - p0y) * 0.7 + perpY / perpLen * bow + (rand() - 0.5) * 0.12,
      p3x,
      p3y,
      colour: STROKE_COLOURS[Math.floor(rand() * STROKE_COLOURS.length)],
      baseWidth: 0.025 + rand() * 0.045, // normalised to canvas width
      swayPhase: rand() * Math.PI * 2,
      swayAmpX: 0.012 + rand() * 0.02,
      swayAmpY: 0.008 + rand() * 0.015,
    });
  }

  // 10–15 dewy blobs
  const blobCount = 10 + Math.floor(rand() * 6); // 10–15
  const blobColours = [
    'rgba(210,180,165,0.12)',
    'rgba(220,195,175,0.10)',
    'rgba(215,185,160,0.13)',
    'rgba(205,175,155,0.11)',
    'rgba(225,200,180,0.09)',
  ];
  const blobs: DewyBlob[] = [];
  for (let i = 0; i < blobCount; i++) {
    blobs.push({
      cx: rand(),
      cy: rand(),
      r: 0.06 + rand() * 0.12,
      pulsePhase: rand() * Math.PI * 2,
      driftPhase: rand() * Math.PI * 2,
      driftAmp: 0.008 + rand() * 0.012,
      colour: blobColours[Math.floor(rand() * blobColours.length)],
    });
  }

  // 30–50 shimmer particles
  const particleCount = 30 + Math.floor(rand() * 21); // 30–50
  const particleColours = [
    'rgba(255,248,235,0.5)',
    'rgba(220,195,180,0.4)',
    'rgba(245,235,220,0.45)',
  ];
  const particles: ShimmerParticle[] = [];
  for (let i = 0; i < particleCount; i++) {
    particles.push({
      x: rand(),
      y: rand(),
      radius: 0.5 + rand() * 2.5,
      opacityPhase: rand() * Math.PI * 2,
      driftPhase: rand() * Math.PI * 2,
      speed: PARTICLE_SPEED * (0.4 + rand() * 0.8),
      colour: particleColours[Math.floor(rand() * particleColours.length)],
    });
  }

  return { strokes, blobs, particles };
}

// ── Noise grain texture (built once, tiled at draw time) ──────────────────────
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
    d[i + 3] = 13;
  }
  tctx.putImageData(img, 0, 0);
  return tc;
}

// ── Main draw function ────────────────────────────────────────────────────────
function drawScene(
  ctx: CanvasRenderingContext2D,
  scene: SceneData,
  staticRes: StaticResources,
  w: number,
  h: number,
  elapsed: number,
  ptrX: number,
  ptrY: number,
) {
  // ── 1. Base cream fill ──────────────────────────────────────────────────────
  ctx.fillStyle = '#F7F1E7';
  ctx.fillRect(0, 0, w, h);

  // ── 2. Brush strokes ────────────────────────────────────────────────────────
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const s of scene.strokes) {
    const sway = elapsed * STROKE_SWAY_SPEED;
    const dx = Math.sin(sway + s.swayPhase) * s.swayAmpX * w;
    const dy = Math.cos(sway * 0.7 + s.swayPhase + 1.2) * s.swayAmpY * h;

    const p0x = s.p0x * w + dx * 0.4;
    const p0y = s.p0y * h + dy * 0.4;
    const cp1x = s.cp1x * w + dx;
    const cp1y = s.cp1y * h + dy;
    const cp2x = s.cp2x * w + dx * 0.8;
    const cp2y = s.cp2y * h + dy * 0.8;
    const p3x = s.p3x * w + dx * 0.3;
    const p3y = s.p3y * h + dy * 0.3;

    const bw = s.baseWidth * w;

    // Feathered brush stroke: three passes on the same path with decreasing
    // width and varying alpha — creates a soft outer halo fading into a denser
    // core, giving the look of a real foundation swatch.
    ctx.strokeStyle = s.colour;
    const strokePasses: [number, number][] = [
      [bw * 2.0, 0.28],  // wide soft halo
      [bw * 1.1, 0.55],  // medium body
      [bw * 0.35, 0.30], // narrow crisp inner highlight
    ];
    for (const [lw, ga] of strokePasses) {
      ctx.lineWidth = lw;
      ctx.globalAlpha = ga;
      ctx.beginPath();
      ctx.moveTo(p0x, p0y);
      ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, p3x, p3y);
      ctx.stroke();
    }
  }
  ctx.globalAlpha = 1;
  ctx.restore();

  // ── 3. Dewy blobs ───────────────────────────────────────────────────────────
  for (const blob of scene.blobs) {
    const pulse = 1 + 0.08 * Math.sin(elapsed * BLOB_PULSE_SPEED * Math.PI * 2 + blob.pulsePhase);
    const drift = Math.sin(elapsed * 0.15 + blob.driftPhase) * blob.driftAmp;
    const cx = (blob.cx + drift) * w;
    const cy = (blob.cy + drift * 0.6) * h;
    const r = blob.r * Math.min(w, h) * pulse;

    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    grad.addColorStop(0, blob.colour);
    grad.addColorStop(1, 'rgba(247,241,231,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // ── 4. Shimmer particles ────────────────────────────────────────────────────
  ctx.save();
  ctx.shadowBlur = 6;
  for (const p of scene.particles) {
    // Particles drift slowly upward with gentle sine lateral sway
    const t = (elapsed * p.speed) % 1;
    const drift = Math.sin(elapsed * 0.4 + p.driftPhase) * 0.02 * w;
    const px = p.x * w + drift;
    const py = ((p.y - t + 1) % 1) * h;

    const opacity = 0.3 + 0.7 * (0.5 + 0.5 * Math.sin(elapsed * 1.2 + p.opacityPhase));
    ctx.globalAlpha = opacity;
    ctx.shadowColor = p.colour;
    ctx.fillStyle = p.colour;
    ctx.beginPath();
    ctx.arc(px, py, p.radius, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.shadowBlur = 0;
  ctx.restore();

  // ── 5. Pointer-reactive beauty light ───────────────────────────────────────
  const lightR = w * 0.25;
  const beautyGrad = ctx.createRadialGradient(ptrX, ptrY, 0, ptrX, ptrY, lightR);
  beautyGrad.addColorStop(0, 'rgba(255,250,240,0.15)');
  beautyGrad.addColorStop(1, 'rgba(255,250,240,0)');
  ctx.fillStyle = beautyGrad;
  ctx.fillRect(0, 0, w, h);

  // ── 6. Grain texture overlay ────────────────────────────────────────────────
  if (staticRes.noisePattern) {
    ctx.fillStyle = staticRes.noisePattern;
    ctx.fillRect(0, 0, w, h);
  }

  // ── 7. Vignette overlay ─────────────────────────────────────────────────────
  ctx.fillStyle = staticRes.vignette;
  ctx.fillRect(0, 0, w, h);
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function LiquidVelvetCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number | null>(null);
  const sizeRef = useRef({ w: 0, h: 0 });
  const sceneRef = useRef<SceneData | null>(null);
  const noiseTexRef = useRef<HTMLCanvasElement | null>(null);
  const staticResRef = useRef<StaticResources | null>(null);
  const ptrRef = useRef({ x: 0, y: 0 });
  const smoothPtrRef = useRef({ x: 0, y: 0 });
  const isOnScreenRef = useRef(false);
  const reducedMotionRef = useRef(false);
  const lastDrawTimeRef = useRef<number | null>(null);
  const lastDrawElapsedRef = useRef(0);
  const lastDrawPtrRef = useRef({ x: 0, y: 0 });
  const lastTouchTimeRef = useRef<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    reducedMotionRef.current = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const isMobile = 'ontouchstart' in window || window.matchMedia('(pointer: coarse)').matches;
    const targetFrameMs = isMobile ? 1000 / 30 : 1000 / 60;

    noiseTexRef.current = buildNoiseTexture();
    sceneRef.current = buildSceneData();

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

      const vignette = ctx!.createRadialGradient(
        w / 2, h / 2, Math.min(w, h) * 0.28,
        w / 2, h / 2, Math.hypot(w, h) / 2,
      );
      vignette.addColorStop(0, 'rgba(59,47,42,0)');
      vignette.addColorStop(1, 'rgba(59,47,42,0.14)');
      const noisePattern = noiseTexRef.current ? ctx!.createPattern(noiseTexRef.current, 'repeat') : null;
      staticResRef.current = { vignette, noisePattern };

      ptrRef.current = { x: w / 2, y: h / 2 };
      smoothPtrRef.current = { x: w / 2, y: h / 2 };
    }

    function startLoop() {
      if (rafRef.current !== null) return;
      // Preserve startTimeRef so elapsed continues from where it was — avoids
      // particles snapping to their initial positions when the user scrolls back.
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

      const dt = lastTimeRef.current === null ? 16.67 : Math.min(time - lastTimeRef.current, 50);
      lastTimeRef.current = time;
      const alpha = 1 - Math.pow(1 - SMOOTH_FACTOR, dt / 16.67);

      const sp = smoothPtrRef.current;
      const tp = ptrRef.current;

      // Mobile sway: when no touch has happened recently, gently oscillate the
      // beauty-light target around centre (spec: "center it and gently sway").
      if (isMobile) {
        const { w: sw, h: sh } = sizeRef.current;
        const lastTouch = lastTouchTimeRef.current;
        if (lastTouch === null || time - lastTouch > MOBILE_SWAY_IDLE_MS) {
          tp.x = sw / 2 + Math.sin(elapsed * MOBILE_SWAY_FREQ_X) * sw * MOBILE_SWAY_AMP_X;
          tp.y = sh / 2 + Math.cos(elapsed * MOBILE_SWAY_FREQ_Y) * sh * MOBILE_SWAY_AMP_Y;
        }
      }

      sp.x += (tp.x - sp.x) * alpha;
      sp.y += (tp.y - sp.y) * alpha;

      const sinceLastDraw = lastDrawTimeRef.current === null ? Infinity : time - lastDrawTimeRef.current;
      if (sinceLastDraw >= targetFrameMs) {
        const elapsedDelta = Math.abs(elapsed - lastDrawElapsedRef.current);
        const lpx = lastDrawPtrRef.current.x;
        const lpy = lastDrawPtrRef.current.y;
        if (
          elapsedDelta > PHASE_DELTA_THRESHOLD ||
          Math.abs(sp.x - lpx) > PTR_DELTA_THRESHOLD ||
          Math.abs(sp.y - lpy) > PTR_DELTA_THRESHOLD
        ) {
          const { w, h } = sizeRef.current;
          const sc = sceneRef.current;
          const sr = staticResRef.current;
          if (sc && sr) {
            drawScene(ctx!, sc, sr, w, h, elapsed, sp.x, sp.y);
            lastDrawTimeRef.current = time;
            lastDrawElapsedRef.current = elapsed;
            lastDrawPtrRef.current = { x: sp.x, y: sp.y };
          }
        }
      }

      rafRef.current = requestAnimationFrame(loop);
    }

    function drawStaticFrame() {
      const { w, h } = sizeRef.current;
      const sc = sceneRef.current;
      const sr = staticResRef.current;
      if (sc && sr) {
        drawScene(ctx!, sc, sr, w, h, 2.5, w / 2, h / 2);
      }
    }

    setSize();

    if (reducedMotionRef.current) {
      drawStaticFrame();
    }

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
        lastTouchTimeRef.current = performance.now();
      }
    }
    if (!reducedMotionRef.current) {
      window.addEventListener('pointermove', onPointerMove, { passive: true });
      window.addEventListener('touchmove', onTouchMove, { passive: true });
    }

    const resizeObserver = new ResizeObserver(() => {
      setSize();
      if (reducedMotionRef.current) drawStaticFrame();
    });
    resizeObserver.observe(container);

    const intersectionObserver = new IntersectionObserver((entries) => {
      isOnScreenRef.current = entries[0].isIntersecting;
      if (entries[0].isIntersecting) {
        if (!reducedMotionRef.current) startLoop();
      } else {
        stopLoop();
      }
    });
    intersectionObserver.observe(container);

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
