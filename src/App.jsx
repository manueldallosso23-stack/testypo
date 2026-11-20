import Stage from './components/Stage.jsx';
import { useMotionControls } from './hooks/useMotionControls.js';
// The IGNOTO wordmark — verbatim Figma export of one "Livello_1" row (2009:2127),
// inlined at build time. All 8 rows draw this same vector.
import typographySvg from './assets/figma/wordmark-row.svg?raw';

export default function App() {
  const { target, mode, requestPermission } = useMotionControls();

  return (
    <main className="app">
      <Stage svgText={typographySvg} target={target} />
      {mode === 'needs-permission' && (
        <button type="button" className="gate" onClick={requestPermission}>
          <span>Tap to enable motion</span>
        </button>
      )}
    </main>
  );
}
