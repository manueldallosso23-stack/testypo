/**
 * Produces two independent normalised control targets, each in [-1, 1]:
 *   v — front/back tilt, 0° = phone UPRIGHT (perpendicular to the ground),
 *       + = top tilted forward (away from the user)          → the 8 row heights
 *   h — left/right tilt, 0° = level, + = right side down      → shared gradient field
 * Both are LINEAR over ±MOTION range degrees: −30° → −1, 0° → 0 (midpoint),
 * +30° → +1, clamped beyond.
 *
 * Both angles are derived from the direction of gravity in the device frame
 * (computed from β/γ), not from raw β/γ: near upright β ≈ 90° the Euler angle γ
 * is degenerate and jumps, whereas the gravity vector stays continuous in
 * every pose. Lying flat, h equals γ exactly (same as before).
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

const RAD = Math.PI / 180;

/**
 * Device β/γ → (pitch, roll) in degrees, relative to the screen.
 * u = world "up" expressed in device coordinates (x right, y top, z out of
 * the screen), from the W3C Z-X'-Y'' Euler order:
 *   u = (−sinγ·cosβ, sinβ, cosγ·cosβ)
 * pitch = atan2(u.z, u.y): 0 upright, +30 with the top tilted 30° away.
 * roll  = asin(−u.x):     0 level, + right side down (= γ when lying flat).
 */
function tiltAngles(beta, gamma) {
  const b = beta * RAD;
  const g = gamma * RAD;
  let ux = -Math.sin(g) * Math.cos(b);
  let uy = Math.sin(b);
  const uz = Math.cos(g) * Math.cos(b);
  // landscape: rotate into screen coordinates
  const a = screenAngle() * RAD;
  if (a) {
    const x = ux * Math.cos(a) - uy * Math.sin(a);
    const y = ux * Math.sin(a) + uy * Math.cos(a);
    ux = x;
    uy = y;
  }
  const pitch = Math.atan2(uz, uy) / RAD;
  const roll = Math.asin(clamp(-ux, -1, 1)) / RAD;
  return [pitch, roll];
}

export function useMotionControls() {
  const target = useRef({ v: 0, h: 0 });
  // 'pointer' | 'needs-permission' | 'starting' | 'sensor'
  const [mode, setMode] = useState(() => (needsPermission() ? 'needs-permission' : 'pointer'));
  const sensorLive = useRef(false);

  const onOrientation = useCallback((e) => {
    if (e.beta == null || e.gamma == null) return;
    const [pitch, roll] = tiltAngles(e.beta, e.gamma);
    let v = pitch / MOTION.verticalRange;   // absolute: upright = 0
    let h = roll / MOTION.horizontalRange;
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

  return { target, mode, requestPermission };
}
