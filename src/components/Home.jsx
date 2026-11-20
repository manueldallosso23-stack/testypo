import { useEffect, useState } from 'react';
import { measureViewport, onViewportChange } from '../gl/viewport.js';
import { HOME } from '../config/art.js';

/**
 * Home page — Figma frame "home page" (2013:3779), 378.7 × 821.
 * The artwork (title, character, stars, bottom block) is the Figma SVG export
 * src/assets/figma/home.svg; "tap to enable motion" is live text in the
 * Alpen-Trial Stencil Rounded Oblique font so it can blink.
 * The frame is contain-fitted (uniform scale, never distorted) and centred in
 * the safe area; the rest of the screen is the frame's black.
 */
const artModules = import.meta.glob('../assets/figma/home.svg', { eager: true, query: '?url', import: 'default' });
const homeArt = Object.values(artModules)[0] || null;

function useFrameBox() {
  const [box, setBox] = useState(null);
  useEffect(() => {
    const fit = () => {
      const { safe } = measureViewport();
      const scale = Math.min(safe.w / HOME.frame.w, safe.h / HOME.frame.h);
      const w = HOME.frame.w * scale;
      const h = HOME.frame.h * scale;
      setBox({ scale, w, h, x: safe.x + (safe.w - w) / 2, y: safe.y + (safe.h - h) / 2 });
    };
    fit();
    return onViewportChange(fit);
  }, []);
  return box;
}

export default function Home({ leaving, onStart }) {
  const box = useFrameBox();
  return (
    <button
      type="button"
      className={`home${leaving ? ' home--leaving' : ''}`}
      style={{ '--home-fade': `${HOME.fadeOutMs}ms`, '--home-blink': `${HOME.blinkMs}ms` }}
      onClick={onStart}
      aria-label={HOME.tap.text}
    >
      {box && (
        <span className="home__frame" style={{ left: box.x, top: box.y, width: box.w, height: box.h }}>
          {homeArt && <img className="home__art" src={homeArt} alt="" draggable="false" />}
          <span
            className="home__tap"
            style={{
              left: `${(HOME.tap.x / HOME.frame.w) * 100}%`,
              top: `${((HOME.tap.y + HOME.tap.baselineNudge) / HOME.frame.h) * 100}%`,
              fontSize: `${HOME.tap.size * box.scale}px`,
              lineHeight: `${HOME.tap.lineHeight * box.scale}px`, // Figma "auto" = 28
              // Figma: 1 px stroke OUTSIDE → centred 2 px stroke painted under the fill
              WebkitTextStroke: `${HOME.tap.stroke * 2 * box.scale}px #fff`,
            }}
          >
            {HOME.tap.text}
          </span>
        </span>
      )}
    </button>
  );
}
