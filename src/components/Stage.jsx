import { useEffect, useRef, useState } from 'react';
import { createRenderer, computeFit, stretchable, layoutRows } from '../gl/renderer.js';
import { cssGradient } from '../gl/field.js';
import { measureViewport, onViewportChange } from '../gl/viewport.js';
import { MOTION } from '../config/art.js';


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

function useAnimationLoop(target, draw) {
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
      draw(layoutRows(e), e);
      raf = requestAnimationFrame(tick);
    };
    const onVis = () => {
      cancelAnimationFrame(raf);
      if (!document.hidden) { last = performance.now(); raf = requestAnimationFrame(tick); }
    };
    raf = requestAnimationFrame(tick);
    document.addEventListener('visibilitychange', onVis);
    return () => { cancelAnimationFrame(raf); document.removeEventListener('visibilitychange', onVis); };
  }, [target, draw]);
}

function GLStage({ svgText, target, onFail }) {
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
  const draw = useRef((s, h) => drawRef.current(s, h)).current;
  useAnimationLoop(target, draw);

  return <canvas ref={canvasRef} className="stage" aria-hidden="true" />;
}

/** No-WebGL fallback: CSS gradients from the same field, SVG as a CSS mask. */
function CSSStage({ svgText, target }) {
  const bgRef = useRef(null);
  const fgRef = useRef(null);
  const maskUrl = useRef(`url("data:image/svg+xml;charset=utf-8,${encodeURIComponent(stretchable(svgText))}")`).current;

  const draw = useRef((rows, h) => {
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
  useAnimationLoop(target, draw);

  return (
    <div ref={bgRef} className="stage" aria-hidden="true">
      <div ref={fgRef} className="stage stage--fg" />
    </div>
  );
}

export default function Stage(props) {
  const [gl, setGl] = useState(true);
  const fail = useRef(() => setGl(false)).current;
  return gl ? <GLStage {...props} onFail={fail} /> : <CSSStage {...props} />;
}
