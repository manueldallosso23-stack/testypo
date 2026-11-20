# Gyro Type

Full-screen, gyroscope-driven SVG typography. React + Vite + a single-pass WebGL shader.

```
npm install
npm run dev        # https://<LAN-IP>:5173 — open on the phone (accept the self-signed cert)
npm run build      # static output in dist/ (serve over HTTPS)
```

## Flow
1. **Home** (Figma frame "home page", 2013:3779): artwork `src/assets/figma/home.svg` (contain-fitted, never distorted)
   + "tap to enable motion" as live text in Alpen-Trial Stencil Rounded Oblique, blinking.
2. **Tap** anywhere: motion permission is requested (iOS needs it inside the tap) and the whole home fades out.
3. **Intro**: the gradient fades in from black, then the 8 IGNOTO rows fade in staggered, top → bottom.
Timings: `HOME` and `INTRO` in `src/config/art.js`.

## Controls
The front/back tilt is absolute: phone **upright** (perpendicular to the ground) = stato 1 (Figma "tilt +100"),
**50° forward** (top away from you) = stato 2 ("tilt -100"); held beyond both ends (`MOTION.vertical`).
An ease-in-out curve (`MOTION.easing`: 'sine' | 'cubic' | 'linear') shapes the transition: soft out of stato 1,
faster mid-way, soft arrival at stato 2.

| Input | Drives |
|---|---|
| Front/back tilt — upright = stato 1 ("tilt +100"), 50° forward = stato 2 ("tilt -100") | **both** the individual heights of the 8 wordmark rows **and** the shared gradient field |
| Left/right tilt | currently disabled (restore in `Stage.jsx`: `draw(layoutRows(v), h)`) |
| Desktop / no sensor: pointer Y (top = stato 1, bottom = stato 2) | both effects |

Both angles are computed from the direction of gravity in the phone (derived from β/γ), so they stay stable
when the phone is upright, where the raw γ angle is degenerate and jumps. Lying flat, left/right equals γ.

Each of the 8 IGNOTO rows always spans the full safe-area width (never scaled on x). Its top and height are
interpolated independently between the two Figma frames (`ROWS` in `src/config/art.js`), so full left reproduces
"tilt -100", full right reproduces "tilt +100", and level is the exact midpoint of every row. The composition
frame (821 units) is mapped onto the safe-area height, so all 8 rows are always visible.

iOS shows one "Tap to enable motion" button (required by Safari's permission API); nowhere else has any UI.

## Source design
Figma "Crossfit-Team" → page "Test Cloude" (2005:2).

- `src/assets/figma/wordmark-row.svg` — verbatim SVG export of one "Livello_1" wordmark row (2009:2127),
  checksum-verified against Figma. All 8 rows use this same vector (verified identical after normalisation).
- Row layout (`ROWS`): measured from frames **tilt -100** (2009:2129) and **tilt +100** (2009:2102).
- Gradients (`GRADIENTS`): from the original frames 2005:1698 / 2005:2050 — locked, unchanged.

## How the reciprocal gradient works
The two Figma frames share geometry; "tilt -100" is "tilt +100" with every gradient's stops reversed.
So one motion value `h` (horizontal tilt, −1…1) drives one shared field that both surfaces read:

```
t_s(y)     = 0.5 + h · (t(y) − 0.5)
background = rampBg(t_s)   // frame gradient,  y 115.6 → 821,  #000 → #250A24 → #93278F
lettering  = rampFg(t_s)   // Union gradient,  y 805.7 → −62.9, #000 → #93278F
```

h = +1 reproduces "tilt +100", h = −1 "tilt -100", h = 0 is the exact 50 % midpoint
(background #250A24, lettering #4A1448). Renders at ±1 match Figma's own frame renders to ±1 RGB level
(only anti-aliasing on letter edges differs).

Here `h` is the left/right rotation. The gradients are pinned to the composition frame (the safe area),
so the changing row heights never move them.
