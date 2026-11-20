/**
 * Live viewport + safe-area measurement.
 *
 * - Viewport: window.innerWidth/innerHeight, which on iOS Safari / Chrome
 *   track the dynamic toolbars (the canvas itself is `position: fixed; inset: 0`).
 * - Safe area: a hidden fixed probe inset by env(safe-area-inset-*), so notch,
 *   Dynamic Island, home indicator and landscape insets are excluded.
 */
let probe = null;

function getProbe() {
  if (!probe) {
    probe = document.createElement('div');
    probe.className = 'safe-area-probe';
    probe.setAttribute('aria-hidden', 'true');
    document.body.appendChild(probe);
  }
  return probe;
}

export function measureViewport() {
  const W = window.innerWidth;
  const H = window.innerHeight;
  const r = getProbe().getBoundingClientRect();
  const safe = r.width > 0 && r.height > 0
    ? { x: r.left, y: r.top, w: r.width, h: r.height }
    : { x: 0, y: 0, w: W, h: H };
  return { W, H, safe };
}

/** Subscribe to every event that can change the visible area. */
export function onViewportChange(cb) {
  let t = 0;
  const run = () => { clearTimeout(t); t = setTimeout(cb, 80); };
  window.addEventListener('resize', run);
  window.addEventListener('orientationchange', run);
  window.visualViewport?.addEventListener('resize', run);
  return () => {
    clearTimeout(t);
    window.removeEventListener('resize', run);
    window.removeEventListener('orientationchange', run);
    window.visualViewport?.removeEventListener('resize', run);
  };
}
