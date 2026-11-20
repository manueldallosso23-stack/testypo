/**
 * CPU twin of the shader's shared field — used only by the no-WebGL
 * fallback. Same Figma gradients, same single motion value h.
 */
import { GRADIENTS } from '../config/art.js';

const rgb = (hex) => {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

function ramp(stops, t) {
  t = Math.min(1, Math.max(0, t));
  let c = rgb(stops[0].color);
  for (let i = 1; i < stops.length; i++) {
    const span = Math.max(stops[i].pos - stops[i - 1].pos, 1e-4);
    const k = Math.min(1, Math.max(0, (t - stops[i - 1].pos) / span));
    const to = rgb(stops[i].color);
    c = c.map((v, j) => v + (to[j] - v) * k);
  }
  return `rgb(${c.map(Math.round).join(',')})`;
}

/** Colour of a surface at Figma-frame y, for shared motion value h. */
export function surfaceColor(surface, y, h) {
  const g = GRADIENTS[surface];
  const t = Math.min(1, Math.max(0, (y - g.y0) / (g.y1 - g.y0)));
  return ramp(g.stops, 0.5 + h * (t - 0.5));
}

/**
 * Vertical CSS gradient for a surface, with stops placed in screen px so it
 * lines up with the fitted frame (fit = { sy, oy }).
 */
export function cssGradient(surface, h, fit, viewH, samples = 12) {
  const parts = [];
  for (let i = 0; i <= samples; i++) {
    const py = (i / samples) * viewH;
    const y = (py - fit.oy) / fit.sy;
    parts.push(`${surfaceColor(surface, y, h)} ${py.toFixed(1)}px`);
  }
  return `linear-gradient(to bottom, ${parts.join(',')})`;
}
