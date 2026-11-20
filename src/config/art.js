/**
 * ART DIRECTION CONFIG — transcribed from Figma
 * File "Crossfit-Team" (ed4xyxEfc0qkQlecHM9PAg), page "Test Cloude" (2005:2)
 *   frame "tilt +100" (2005:1698)  ·  frame "tilt -100" (2005:2050)
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
 * Typography layout & stretch (LEFT/RIGHT rotation).
 *
 * The wordmark always spans the full safe-area WIDTH (never scaled on x).
 * Its height is a fraction of the safe-area height:
 *   heightFraction = minHeight + (1 − minHeight) · (s + 1) / 2,  s ∈ [−1, 1]
 *   s = −1 (rotated fully left)  → minHeight   (compressed)
 *   s = +1 (rotated fully right) → 1.0         (all rows fill the safe height)
 *   s =  0 (level)               → exact midpoint
 * Vertical pivot anchorY (0.5 = centred), so the layout stays centred.
 */
export const TYPOGRAPHY = {
  minHeight: 0.5,
  anchorY: 0.5,
};

/** Sensor mapping & smoothing */
export const MOTION = {
  /** degrees of front/back tilt (from the calibrated rest pose) for full range */
  verticalRange: 32,
  /** degrees of left/right tilt for full range */
  horizontalRange: 35,
  /** invert if a direction feels backwards on device */
  invertVertical: false,
  invertHorizontal: false,
  /** smoothing stiffness (1/s). Two cascaded stages → soft, no overshoot. */
  stiffness: 9,
  /** ms to wait for sensor data before falling back to pointer control */
  sensorTimeout: 1200,
};
