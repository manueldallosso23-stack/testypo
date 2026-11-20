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
 * v = 0 (rest pose) → exact midpoint.
 * Every row always spans the full composition width.
 */
export const ROWS = {
  /** frame "tilt -100" — all gaps 2 */
  left: [[1, 197], [200, 197], [399, 122], [523, 85], [610, 71], [683, 54], [739, 47], [788, 30]],
  /** frame "tilt +100" — gaps 2–3 as drawn */
  right: [[1, 30], [33, 47], [83, 54], [140, 71], [214, 85], [301, 122], [425, 197], [624, 197]],
};

/**
 * Dithering layer (post-process inside the shader, on top of the gradients).
 * Each surface's position along its own Figma gradient is quantised to
 * `levels` steps with a static white-noise threshold per grain cell, so the
 * output only ever uses colours of the existing gradients.
 */
export const DITHER = {
  enabled: true,
  /** grain cell size in CSS px (1 = finest; 2–3 = chunkier raster) */
  cellSize: 1,
  /** colour steps per gradient (fewer = more posterised) */
  levels: 6,
  /** noise amplitude in steps: 1 = classic dither, >1 = grain even in flat areas */
  spread: 1.0,
};

/** Sensor mapping & smoothing */
export const MOTION = {
  /** degrees of front/back tilt (from the rest pose) for the full −100…+100 range */
  verticalRange: 30,
  /** degrees of left/right tilt (from level) for the full −100…+100 range */
  horizontalRange: 30,
  /** invert if a direction feels backwards on device */
  invertVertical: false,
  invertHorizontal: false,
  /** smoothing stiffness (1/s). Two cascaded stages → soft, no overshoot. */
  stiffness: 9,
  /** ms to wait for sensor data before falling back to pointer control */
  sensorTimeout: 1200,
};
