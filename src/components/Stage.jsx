import { useEffect, useRef, useState } from 'react';
import { createRenderer, computeFit, svgSize, stretchable, toScaleY } from '../gl/renderer.js';
import { cssGradient } from '../gl/field.js';
import { measureViewport, onViewportChange } from '../gl/viewport.js';
import { MOTION, TYPOGRAPHY } from '../config/art.js';


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
      // left/right rotation (h) → vertical stretch; front/back tilt (v) → gradient
      draw(toScaleY(h), v);
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
  const svg = useRef(svgSize(svgText)).current;
  const maskUrl = useRef(`url("data:image/svg+xml;charset=utf-8,${encodeURIComponent(stretchable(svgText))}")`).current;

  const draw = useRef((scaleY, g) => {
    const view = measureViewport();
    const H = view.H;
    const fit = computeFit(view, svg);
    const bg = cssGradient('background', g, fit, H);
    const fg = cssGradient('typography', g, fit, H);
    const ay = fit.oy + fit.dh * TYPOGRAPHY.anchorY;
    const h = fit.dh * scaleY;
    bgRef.current.style.background = bg;
    const s = fgRef.current.style;
    s.background = fg;
    s.webkitMaskImage = s.maskImage = maskUrl;
    s.webkitMaskSize = s.maskSize = `${fit.dw}px ${h}px`;
    s.webkitMaskPosition = s.maskPosition = `${fit.ox}px ${ay - h * TYPOGRAPHY.anchorY}px`;
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
