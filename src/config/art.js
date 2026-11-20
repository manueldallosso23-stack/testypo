/**
 * ART DIRECTION CONFIG — transcribed from Figma
 * File "Crossfit-Team" (ed4xyxEfc0qkQlecHM9PAg), page "Test Cloude" (2005:2)
 *   gradients: frames "tilt +100" (2005:1698) · "tilt -100" (2005:2050)
 *   wordmark rows: updated frames "tilt +100" (2009:2102) · "tilt -100" (2009:2129)
 *
 * All coordinates are Figma frame units (y down), frame = 378.701 × 821.
 */

export const FRAME = { w: 378.701, h: 821 };

/**
 * Gradients exactly as in frame "tilt +100".
 * Frame "tilt -100" uses the SAME geometry with every stop list reversed,
 * i.e. state −100 = the ramp read at (1 − t). That lets both surfaces share
 * one field:  t_s = 0.5 + h · (t − 0.5)   (h = +1 → tilt +100, h = −1 → tilt −100)
 * and h = 0 is the exact 50 % midpoint of the two Figma states.
 */
export const GRADIENTS = {
  /** frame fill — vertical linear gradient, y 115.614 → 821 */
  background: {
    y0: 115.614,
    y1: 821,
    stops: [
      { pos: 0, color: '#000000' },
      { pos: 0.5, color: '#250A24' },
      { pos: 1, color: '#93278F' },
    ],
  },
  /** "Union" vector fill — vertical linear gradient, y 805.706 → −62.908 */
  typography: {
    y0: 805.706,
    y1: -62.908,
    stops: [
      { pos: 0, color: '#000000' },
      { pos: 1, color: '#93278F' },
    ],
  },
};

/**
 * The 8 IGNOTO wordmark rows — measured from the updated Figma frames
 * "tilt -100" (2009:2129) and "tilt +100" (2009:2102). Each row is a 379-wide
 * "Livello_1" frame holding the same wordmark vector (verified identical after
 * normalisation), only its height differs. [top, height] in frame units,
 * listed in on-screen order, top row first.
 *
 * FRONT/BACK tilt v interpolates every row's top and height independently:
 * v = −1 → "tilt -100" (left list), v = +1 → "tilt +100" (right list),
 * v = 0 (phone upright, perpendicular to the ground) → exact midpoint;
 * v = +1 at 30° forward (top away from the user), −1 at 30° backward.
 * Every row always spans the full composition width.
 */
export const ROWS = {
  /** frame "tilt -100" — all gaps 2 */
  left: [[1, 197], [200, 197], [399, 122], [523, 85], [610, 71], [683, 54], [739, 47], [788, 30]],
  /** frame "tilt +100" — gaps 2–3 as drawn */
  right: [[1, 30], [33, 47], [83, 54], [140, 71], [214, 85], [301, 122], [425, 197], [624, 197]],
};

/**
 * Home page (Figma frame "home page", 2013:3779) and the intro sequence.
 * Times in ms.
 */
export const HOME = {
  frame: { w: 378.701, h: 821 },
  /** "tap to enable motion" — Alpen-Trial Stencil Rounded Oblique, white */
  /** + 1 px white stroke, OUTSIDE (as in Figma). baselineNudge: measured offset
   *  (frame units) for the browser's vs Figma's reading of the font metrics. */
  tap: { x: 107.85, y: 779.578, size: 19.591, lineHeight: 28, stroke: 1, baselineNudge: 2.5, text: 'tap to enable motion' },
  /** one full blink cycle of the tap text */
  blinkMs: 1100,
  /** fade-out of the whole home after the tap */
  fadeOutMs: 700,
};
export const INTRO = {
  /** background gradient fade-in from black */
  bgFadeMs: 700,
  /** first row starts after this delay */
  rowDelayMs: 250,
  /** delay between consecutive rows (top → bottom) */
  rowStaggerMs: 120,
  /** fade-in duration of each row */
  rowFadeMs: 650,
};

/** Sensor mapping & smoothing */
export const MOTION = {
  /**
   * Front/back tilt → state (drives rows AND gradient).
   * Angle in degrees from UPRIGHT (phone perpendicular to the ground),
   * + = top tilted forward (away from the user).
   * State: +1 = Figma "tilt +100" (stato 1), −1 = "tilt -100" (stato 2).
   * Upright → stato 1; 50° forward → stato 2; held beyond both ends.
   */
  vertical: { fromAngle: 0, toAngle: 50, fromState: 1, toState: -1 },
  /** degrees of left/right tilt (from level) for the full −100…+100 range */
  horizontalRange: 60,
  /** invert if the (currently disabled) left/right direction feels backwards */
  invertHorizontal: false,
  /**
   * Ease-in-out applied to the tilt → state curve (rows and gradient alike):
   * 'sine' (gentle), 'cubic' (stronger), 'linear' (off).
   * Soft start from stato 1, faster mid-way, soft arrival at stato 2.
   */
  easing: 'sine',
  /** smoothing stiffness (1/s). Two cascaded stages → soft, no overshoot. */
  stiffness: 9,
  /** ms to wait for sensor data before falling back to pointer control */
  sensorTimeout: 1200,
};
