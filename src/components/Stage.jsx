import { useEffect, useRef, useState } from 'react';
import { createRenderer, computeFit, stretchable, layoutRows } from '../gl/renderer.js';
import { cssGradient } from '../gl/field.js';
import { measureViewport, onViewportChange } from '../gl/viewport.js';
import { MOTION, INTRO } from '../config/art.js';


/**
 * Ease-in-out on the tilt → state curve, symmetric around upright.
 * x ∈ [-1, 1] → [-1, 1]; ±1 and 0 stay fixed.
 */
const EASE = {
  linear: (k) => k,
  sine: (k) => 0.5 - 0.5 * Math.cos(Math.PI * k),
  cubic: (k) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2),
};
function easeInOut(x) {
  const f = EASE[MOTION.easing] || EASE.linear;
  const k = (Math.min(1, Math.max(-1, x)) + 1) / 2;
  return f(k) * 2 - 1;
}

/**
 * Two cascaded frame-rate-independent low-pass stages per channel:
 * filters sensor jitter, follows the hand closely, never overshoots.
 */
function makeSmoother() {
  const s = { v1: 0, v2: 0, h1: 0, h2: 0 };
  return (t, dt) => {
    const a = 1 - Math.exp(-MOTION.stiffness * 2 * dt);
    s.v1 += (t.v - s.v1) * a; s.v2 += (s.v1 - s.v2) * a;
    s.h1 += (t.h - s.h1) * a; s.h2 += (s.h1 - s.h2) * a;
    return { v: s.v2, h: s.h2 };
  };
}

const smoothstep = (x) => {
  const k = Math.min(1, Math.max(0, x));
  return k * k * (3 - 2 * k);
};
/**
 * Entrance: background fades in from black, then the 8 rows fade in one
 * after another, top → bottom. Before the intro starts everything is black.
 */
function introState(introAt, now) {
  const rowAlpha = new Float32Array(8);
  if (introAt == null) return { fade: 0, rowAlpha };
  const t = now - introAt;
  for (let i = 0; i < 8; i++) {
    rowAlpha[i] = smoothstep((t - INTRO.rowDelayMs - i * INTRO.rowStaggerMs) / INTRO.rowFadeMs);
  }
  return { fade: smoothstep(t / INTRO.bgFadeMs), rowAlpha };
}

function useAnimationLoop(target, draw, introRef) {
  useEffect(() => {
    const smooth = makeSmoother();
    let raf = 0;
    let last = performance.now();
    const tick = (now) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      const { v, h } = smooth(target.current, dt);
      // front/back tilt (v) drives BOTH the row heights and the gradient field;
      // left/right tilt (h) is currently disabled (to restore: draw(layoutRows(v), h))
      const e = easeInOut(v);
      draw(layoutRows(e), e, introState(introRef.current, now));
      raf = requestAnimationFrame(tick);
    };
    const onVis = () => {
      cancelAnimationFrame(raf);
      if (!document.hidden) { last = performance.now(); raf = requestAnimationFrame(tick); }
    };
    raf = requestAnimationFrame(tick);
    document.addEventListener('visibilitychange', onVis);
    return () => { cancelAnimationFrame(raf); document.removeEventListener('visibilitychange', onVis); };
  }, [target, draw, introRef]);
}

function GLStage({ svgText, target, introRef, onFail }) {
  const canvasRef = useRef(null);
  const [renderer, setRenderer] = useState(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    let r = null;
    try { r = createRenderer(canvas, svgText); } catch (e) { console.error(e); }
    if (!r) { onFail(); return undefined; }
    const resize = () => r.resize(measureViewport(), Math.min(window.devicePixelRatio || 1, 2));
    resize();
    const offViewport = onViewportChange(resize);
    const onLost = (e) => { e.preventDefault(); onFail(); };
    canvas.addEventListener('webglcontextlost', onLost);
    setRenderer(r);
    return () => {
      offViewport();
      canvas.removeEventListener('webglcontextlost', onLost);
      r.dispose();
    };
  }, [svgText, onFail]);

  const drawRef = useRef(() => {});
  drawRef.current = renderer ? renderer.render : () => {};
  const draw = useRef((s, h, i) => drawRef.current(s, h, i)).current;
  useAnimationLoop(target, draw, introRef);

  return <canvas ref={canvasRef} className="stage" aria-hidden="true" />;
}

/** No-WebGL fallback: CSS gradients from the same field, SVG as a CSS mask. */
function CSSStage({ svgText, target, introRef }) {
  const bgRef = useRef(null);
  const fgRef = useRef(null);
  const maskUrl = useRef(`url("data:image/svg+xml;charset=utf-8,${encodeURIComponent(stretchable(svgText))}")`).current;

  const draw = useRef((rows, h, intro) => {
    bgRef.current.style.opacity = intro.fade;
    const view = measureViewport();
    const H = view.H;
    const fit = computeFit(view);
    const bg = cssGradient('background', h, fit, H);
    const fg = cssGradient('typography', h, fit, H);
    bgRef.current.style.background = bg;
    const s = fgRef.current.style;
    s.background = fg;
    // one mask layer per wordmark row: full width, its own top & height
    const sizes = [];
    const positions = [];
    for (let i = 0; i < rows.tops.length; i++) {
      sizes.push(`${fit.dw}px ${rows.heights[i] * fit.sy}px`);
      positions.push(`${fit.ox}px ${fit.oy + rows.tops[i] * fit.sy}px`);
    }
    s.webkitMaskImage = s.maskImage = Array(rows.tops.length).fill(maskUrl).join(',');
    s.webkitMaskSize = s.maskSize = sizes.join(',');
    s.webkitMaskPosition = s.maskPosition = positions.join(',');
  }).current;
  useAnimationLoop(target, draw, introRef);

  return (
    <div ref={bgRef} className="stage" aria-hidden="true">
      <div ref={fgRef} className="stage stage--fg" />
    </div>
  );
}

/** introAt: performance.now() timestamp when the entrance starts (null = black) */
export default function Stage({ introAt, ...props }) {
  const [gl, setGl] = useState(true);
  const fail = useRef(() => setGl(false)).current;
  const introRef = useRef(introAt);
  introRef.current = introAt;
  return gl
    ? <GLStage {...props} introRef={introRef} onFail={fail} />
    : <CSSStage {...props} introRef={introRef} />;
}
