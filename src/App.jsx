import { useRef, useState } from 'react';
import Stage from './components/Stage.jsx';
import Home from './components/Home.jsx';
import { useMotionControls } from './hooks/useMotionControls.js';
import { HOME } from './config/art.js';
// The IGNOTO wordmark — verbatim Figma export of one "Livello_1" row (2009:2127),
// inlined at build time. All 8 rows draw this same vector.
import typographySvg from './assets/figma/wordmark-row.svg?raw';

/**
 * Flow: home (tap text blinking) → tap: request motion permission (iOS needs
 * it inside the tap) and fade the whole home out → the animation enters:
 * background fades in, the 8 rows fade in staggered top → bottom.
 */
export default function App() {
  const { target, mode, requestPermission } = useMotionControls();
  const [phase, setPhase] = useState('home'); // 'home' | 'leaving' | 'stage'
  const [introAt, setIntroAt] = useState(null);
  const started = useRef(false);

  const start = () => {
    if (started.current) return;
    started.current = true;
    if (mode === 'needs-permission') requestPermission();
    setPhase('leaving');
    window.setTimeout(() => {
      setPhase('stage');
      setIntroAt(performance.now());
    }, HOME.fadeOutMs);
  };

  return (
    <main className="app">
      <Stage svgText={typographySvg} target={target} introAt={introAt} />
      {phase !== 'stage' && <Home leaving={phase === 'leaving'} onStart={start} />}
    </main>
  );
}
