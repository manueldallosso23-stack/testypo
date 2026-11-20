# Gyro Type

Full-screen, gyroscope-driven SVG typography. React + Vite + a single-pass WebGL shader.

```
npm install
npm run dev        # https://<LAN-IP>:5173 — open on the phone (accept the self-signed cert)
npm run build      # static output in dist/ (serve over HTTPS)
```

## Controls
| Input | Drives |
|---|---|
| Phone front/back tilt (β) | `scaleX` of the lettering, pivoted at `TYPOGRAPHY.anchorX` |
| Phone left/right tilt (γ) | the shared gradient field (state −1 ↔ 0 ↔ +1) |
| Desktop / no sensor: pointer Y / X | same two values |
| Double-tap (sensor mode) | re-zero the vertical rest pose |

iOS shows one "Tap to enable motion" button (required by Safari's permission API); nowhere else has any UI.

## Source design
Figma "Crossfit-Team" → page "Test Cloude" (2005:2), frames **tilt +100** (2005:1698) and **tilt -100** (2005:2050).

- `src/assets/figma/tilt-minus-100.svg` — verbatim SVG export of frame 2005:2050 (checksum-verified against Figma).
- `src/assets/typography.svg` — the lettering mask, derived by `npm run mask-svg` (drops the frame fill and turns the gradient fills to white; geometry untouched).
- `src/config/art.js` — the Figma gradients (positions + stops) and the motion mapping.

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

Vertical tilt `v` (−1…1) only sets `scaleX = 1 + v · scaleAmount` (default 0.5 → 0.5×…1.5×),
pivoted at the frame centre; v = 0 is the untouched Figma artwork. The gradients are in frame space
along y, so scaling never touches them.
