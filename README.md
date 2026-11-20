# Gyro Type

Full-screen, gyroscope-driven SVG typography. React + Vite + a single-pass WebGL shader.

```
npm install
npm run dev        # https://<LAN-IP>:5173 — open on the phone (accept the self-signed cert)
npm run build      # static output in dist/ (serve over HTTPS)
```

## Controls
The tilt is absolute over ±60°: −60° → −100 %, 0° → neutral (50 % midpoint), +60° → +100 %, held at the
extreme beyond ±60°. An ease-in-out curve (`MOTION.easing`: 'sine' | 'cubic' | 'linear') shapes the transition:
soft out of and into the extremes, faster through upright.

| Input | Drives |
|---|---|
| Front/back tilt — 0° = phone **upright** (perpendicular to the ground); +60° = top tilted forward (away from you) → "tilt +100", −60° = tilted back → "tilt -100" | **both** the individual heights of the 8 wordmark rows **and** the shared gradient field |
| Left/right tilt | currently disabled (restore in `Stage.jsx`: `draw(layoutRows(v), h)`) |
| Desktop / no sensor: pointer Y | both effects |

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
