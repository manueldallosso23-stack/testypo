import { useRef } from 'react';
import Stage from './components/Stage.jsx';
import { useMotionControls } from './hooks/useMotionControls.js';
// The original vector artwork, inlined at build time.
// Replace src/assets/typography.svg with the Figma export.
import typographySvg from './assets/typography.svg?raw';

export default function App() {
  const { target, mode, requestPermission, recalibrate } = useMotionControls();
  const lastTap = useRef(0);

  // double-tap re-centres the vertical rest pose (sensor mode only)
  const onPointerUp = () => {
    const now = performance.now();
    if (mode === 'sensor' && now - lastTap.current < 300) recalibrate();
    lastTap.current = now;
  };

  return (
    <main className="app" onPointerUp={onPointerUp}>
      <Stage svgText={typographySvg} target={target} />
      {mode === 'needs-permission' && (
        <button type="button" className="gate" onClick={requestPermission}>
          <span>Tap to enable motion</span>
        </button>
      )}
    </main>
  );
}
