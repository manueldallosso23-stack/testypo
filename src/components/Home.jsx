import { useEffect, useState } from 'react';
import { measureViewport, onViewportChange } from '../gl/viewport.js';
import { HOME } from '../config/art.js';

/**
 * Home page — Figma frame "home page" (2013:3779), 378.7 × 821.
 *
 * Layout: the frame always spans the full safe-area WIDTH, so the side margins
 * are exactly Figma's. Title + top star stay at the top margin, bottom block +
 * "tap to enable motion" at the bottom margin. If the screen is shorter than
 * the frame, only the middle band (character, side stars) compresses —
 * uniformly, never distorted. Side stars are cut only by the screen edge.
 */
const urls = import.meta.glob('../assets/figma/home/*.svg', { eager: true, query: '?url', import: 'default' });
const raws = import.meta.glob('../assets/figma/home/*.svg', { eager: true, query: '?raw', import: 'default' });

const PARTS = HOME.parts
  .map((p) => {
    const key = `../assets/figma/home/${p.file}`;
    if (!urls[key]) return null;
    const root = raws[key].match(/<svg[^>]*>/)[0];
    const w = parseFloat(root.match(/\bwidth="([\d.]+)"/)[1]);
    const h = parseFloat(root.match(/\bheight="([\d.]+)"/)[1]);
    return { ...p, url: urls[key], w, h };
  })
  .filter(Boolean);

/** Frame-units → screen px layout for the current viewport. */
function computeLayout() {
  const { safe } = measureViewport();
  const F = HOME.frame;
  const { from, to } = HOME.middleBand;
  let s = safe.w / F.w; // full width
  const avail = safe.h / s; // available height in frame units
  let f = 1;
  let D = 0;
  let offY = 0;
  let offX = 0;
  if (avail >= F.h) {
    offY = (avail - F.h) / 2; // taller screen: centre vertically
  } else {
    D = F.h - avail;
    f = (to - from - D) / (to - from);
    if (f < HOME.minMiddleScale) {
      // extremely short screen (landscape): plain contain fit
      s = Math.min(safe.w / F.w, safe.h / F.h);
      f = 1;
      D = 0;
      offX = (safe.w / s - F.w) / 2;
      offY = (safe.h / s - F.h) / 2;
    }
  }
  /** frame y → laid-out frame y */
  const mapY = (y) => (y <= from ? y : y < to ? from + (y - from) * f : y - D);
  const toPx = (x, y) => ({ left: safe.x + (x + offX) * s, top: safe.y + (y + offY) * s });
  return { s, f, D, mapY, toPx };
}

function placePart(p, L) {
  if (p.role === 'top') return { ...L.toPx(p.x, p.y), width: p.w * L.s, height: p.h * L.s };
  if (p.role === 'bottom') return { ...L.toPx(p.x, p.y - L.D), width: p.w * L.s, height: p.h * L.s };
  if (p.role === 'middle') {
    const cx = p.x + p.w / 2;
    const w = p.w * L.f;
    return { ...L.toPx(cx - w / 2, L.mapY(p.y)), width: w * L.s, height: p.h * L.f * L.s };
  }
  // edge: keep size and x, follow the middle band with its centre
  const cy = L.mapY(p.y + p.h / 2);
  return { ...L.toPx(p.x, cy - p.h / 2), width: p.w * L.s, height: p.h * L.s };
}

function useLayout() {
  const [layout, setLayout] = useState(null);
  useEffect(() => {
    const update = () => setLayout(computeLayout());
    update();
    return onViewportChange(update);
  }, []);
  return layout;
}

export default function Home({ leaving, onStart }) {
  const L = useLayout();
  const tap = L && L.toPx(HOME.tap.x, HOME.tap.y + HOME.tap.baselineNudge - L.D);
  return (
    <button
      type="button"
      className={`home${leaving ? ' home--leaving' : ''}`}
      style={{ '--home-fade': `${HOME.fadeOutMs}ms`, '--home-blink': `${HOME.blinkMs}ms` }}
      onClick={onStart}
      aria-label={HOME.tap.text}
    >
      {L && PARTS.map((p) => (
        <img key={p.file} className="home__part" src={p.url} alt="" draggable="false" style={placePart(p, L)} />
      ))}
      {L && (
        <span
          className="home__tap"
          style={{
            left: tap.left,
            top: tap.top,
            fontSize: `${HOME.tap.size * L.s}px`,
            lineHeight: `${HOME.tap.lineHeight * L.s}px`, // Figma "auto" = 28
            // Figma: 1 px stroke OUTSIDE → centred 2 px stroke painted under the fill
            WebkitTextStroke: `${HOME.tap.stroke * 2 * L.s}px #fff`,
          }}
        >
          {HOME.tap.text}
        </span>
      )}
    </button>
  );
}
