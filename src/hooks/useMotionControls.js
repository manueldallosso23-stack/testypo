/**
 * Produces two independent normalised control targets, each in [-1, 1]:
 *   h — left/right rotation (γ, 0° = level)                 → shared gradient field
 *   v — front/back tilt (β, 0° = calibrated rest pose)        → the 8 row heights
 * Both are LINEAR over ±MOTION range degrees: −30° → −1, 0° → 0 (midpoint),
 * +30° → +1, clamped beyond.
 *
 * Sources, in priority order:
 *   1. DeviceOrientation (requests permission on iOS via a user tap)
 *   2. Pointer / touch position (desktop preview + sensor-less fallback)
 *
 * Targets are written to a ref (no React re-render per sensor event);
 * smoothing happens in the render loop.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { MOTION } from '../config/art.js';

const clamp = (x, a, b) => Math.min(b, Math.max(a, x));

const needsPermission = () =>
  typeof window !== 'undefined' &&
  typeof window.DeviceOrientationEvent !== 'undefined' &&
  typeof window.DeviceOrientationEvent.requestPermission === 'function' &&
  // only phones/tablets get the gate; desktops go straight to pointer control
  window.matchMedia('(pointer: coarse)').matches;

function screenAngle() {
  const a = screen.orientation?.angle ?? window.orientation ?? 0;
  return ((a % 360) + 360) % 360;
}

/** Device beta/gamma → (vertical, horizontal) tilt relative to the screen. */
function remap(beta, gamma) {
  switch (screenAngle()) {
    case 90: return [gamma * -1, beta];
    case 270: return [gamma, -beta];
    case 180: return [-beta, -gamma];
    default: return [beta, gamma];
  }
}

export function useMotionControls() {
  const target = useRef({ v: 0, h: 0 });
  // 'pointer' | 'needs-permission' | 'starting' | 'sensor'
  const [mode, setMode] = useState(() => (needsPermission() ? 'needs-permission' : 'pointer'));
  const sensorLive = useRef(false);
  const rest = useRef(null); // calibrated rest pose for vertical tilt

  const onOrientation = useCallback((e) => {
    if (e.beta == null || e.gamma == null) return;
    const [vert, horiz] = remap(e.beta, e.gamma);
    // rest pose = how the phone is held when motion starts (double-tap re-zeroes);
    // fixed afterwards so a held tilt keeps its state
    if (rest.current == null) rest.current = vert;

    let v = (vert - rest.current) / MOTION.verticalRange;
    let h = horiz / MOTION.horizontalRange;
    if (MOTION.invertVertical) v = -v;
    if (MOTION.invertHorizontal) h = -h;
    target.current.v = clamp(v, -1, 1);
    target.current.h = clamp(h, -1, 1);
    if (!sensorLive.current) {
      sensorLive.current = true;
      setMode('sensor');
    }
  }, []);

  const startSensor = useCallback(() => {
    window.addEventListener('deviceorientation', onOrientation);
    // no data (desktop, blocked sensor, insecure origin) → pointer fallback
    window.setTimeout(() => {
      if (!sensorLive.current) setMode('pointer');
    }, MOTION.sensorTimeout);
  }, [onOrientation]);

  /** Must be called from a user gesture on iOS. */
  const requestPermission = useCallback(async () => {
    try {
      const res = await window.DeviceOrientationEvent.requestPermission();
      if (res === 'granted') {
        setMode('starting'); // hide the gate immediately
        startSensor();
      } else setMode('pointer');
    } catch {
      setMode('pointer');
    }
  }, [startSensor]);

  /** Re-zero the vertical rest pose (double tap). */
  const recalibrate = useCallback(() => {
    rest.current = null;
  }, []);

  useEffect(() => {
    if (!needsPermission() && window.isSecureContext !== false) startSensor();
    return () => window.removeEventListener('deviceorientation', onOrientation);
  }, [startSensor, onOrientation]);

  // Pointer / touch control — active whenever the sensor isn't.
  useEffect(() => {
    const onMove = (e) => {
      if (sensorLive.current) return;
      const x = (e.clientX / window.innerWidth) * 2 - 1;
      const y = (e.clientY / window.innerHeight) * 2 - 1;
      target.current.h = clamp(x, -1, 1);
      target.current.v = clamp(-y, -1, 1); // up = stretch
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('pointerdown', onMove, { passive: true });
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerdown', onMove);
    };
  }, []);

  return { target, mode, requestPermission, recalibrate };
}
