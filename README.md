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
| Phone left/right rotation (γ) | vertical stretch of the wordmark only: full left = 50 % of the safe height, level = 75 %, full right = 100 % |
| Phone front/back tilt (β, vs. rest pose) | the shared gradient field only: back = "tilt -100", rest = 50 % midpoint, forward = "tilt +100" |
| Desktop / no sensor: pointer X / Y | same two values |
| Double-tap (sensor mode) | re-zero the front/back rest pose |

The wordmark always spans the full safe-area width and is never scaled horizontally; it stays centred
vertically inside the safe area (notch / Dynamic Island / home indicator excluded).

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

Here `h` is the **front/back** tilt. Left/right rotation `s` only sets the wordmark height,
`minHeight + (1 − minHeight) · (s + 1)/2` of the safe area (`TYPOGRAPHY.minHeight`, default 0.5), pivoted at
the vertical centre. The gradients are pinned to the safe area, so stretching never moves them.
