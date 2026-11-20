/**
 * Single-pass WebGL renderer.
 *
 * Left/right rotation → ONE motion value h ∈ [-1, 1] → ONE shared gradient field
 * (unchanged gradient logic). Front/back tilt independently sets the heights
 * of the 8 wordmark rows (typography only, never x). Both surfaces read it through the Figma gradients, which are each
 * other's complement (stops reversed between the "tilt +100" and
 * "tilt -100" frames):
 *     t_s(y)      = 0.5 + h · (t(y) − 0.5)          shared field reading
 *     background  = rampBg( t_s of the frame gradient  )
 *     typography  = rampFg( t_s of the Union gradient  )
 * h = +1 → frame "tilt +100", h = −1 → "tilt -100", h = 0 → exact 50 % midpoint.
 *
 * The gradients are pinned to the composition frame (= safe area); only the
 * lettering coverage changes with the row layout, so it never moves them.
 *
 * Lettering: the 8 rows are the SAME Figma wordmark (verified), each drawn at
 * full width with its own interpolated top/height (see layoutRows). The
 * wordmark is rasterised into a vertical "mip" atlas (one level per halving
 * of height, each rendered from the vector) so short rows stay crisp.
 */
import { GRADIENTS, ROWS, FRAME } from '../config/art.js';

const ROW_COUNT = 8;
const LEVELS = 6;

const STOPS = 4; // max stops per ramp (shorter ramps are padded)

const VERT = `
attribute vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }
`;

const FRAG = `
precision highp float;

uniform vec2  uRes;                 // drawing-buffer size (px)
uniform vec4  uFit;                 // screenUV -> frameUV : uv*xy + zw
uniform float uRowTop[${ROW_COUNT}];         // row tops    (Figma units)
uniform float uRowH[${ROW_COUNT}];           // row heights (Figma units)
uniform float uPxPerUnit;           // device px per Figma unit (vertical)
uniform float uLvlOff[${LEVELS}];          // atlas v offset of each level
uniform float uLvlH[${LEVELS}];            // atlas v height of each level
uniform float uLvlPx[${LEVELS}];           // pixel height of each level
uniform float uH;                   // shared motion value, -1..1
uniform float uFrameH;              // frame height (Figma units)
uniform vec4  uBgSpan;              // background y0, y1   | typography y0, y1
uniform vec3  uBgCol[${STOPS}];
uniform float uBgPos[${STOPS}];
uniform vec3  uFgCol[${STOPS}];
uniform float uFgPos[${STOPS}];
uniform sampler2D uMask;

vec3 rampBg(float t) {
  vec3 c = uBgCol[0];
  for (int i = 1; i < ${STOPS}; i++)
    c = mix(c, uBgCol[i], clamp((t - uBgPos[i - 1]) / max(uBgPos[i] - uBgPos[i - 1], 1e-4), 0.0, 1.0));
  return c;
}
vec3 rampFg(float t) {
  vec3 c = uFgCol[0];
  for (int i = 1; i < ${STOPS}; i++)
    c = mix(c, uFgCol[i], clamp((t - uFgPos[i - 1]) / max(uFgPos[i] - uFgPos[i - 1], 1e-4), 0.0, 1.0));
  return c;
}

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
}

// coverage of one wordmark row at (u, t) — t ∈ [0,1) inside the row —
// blending the two atlas levels closest to the row's on-screen height
float sampleRow(float u, float t, float rowPx) {
  float lvl = clamp(log2(uLvlPx[0] / max(rowPx, 1.0)), 0.0, ${LEVELS - 1}.0);
  float m = 0.0;
  for (int j = 0; j < ${LEVELS}; j++) {
    float w = max(0.0, 1.0 - abs(lvl - float(j)));
    if (w > 0.0) {
      float hp = 0.5 / uLvlPx[j];
      float v = uLvlOff[j] + clamp(t, hp, 1.0 - hp) * uLvlH[j];
      m += w * texture2D(uMask, vec2(u, v)).a;
    }
  }
  return m;
}

// coverage of the whole 8-row composition at frame position (u, y)
float letters(float u, float y) {
  if (u < 0.0 || u > 1.0) return 0.0;
  for (int i = 0; i < ${ROW_COUNT}; i++) {
    float t = (y - uRowTop[i]) / uRowH[i];
    if (t >= 0.0 && t < 1.0) return sampleRow(u, t, uRowH[i] * uPxPerUnit);
  }
  return 0.0;                                   // gap between rows
}

void main() {
  vec2 frag = gl_FragCoord.xy;
  vec2 p = vec2(frag.x / uRes.x, 1.0 - frag.y / uRes.y);   // y down, like Figma
  vec2 fuv = p * uFit.xy + uFit.zw;                         // frame UV over the safe area
  float y = fuv.y * uFrameH;                                // Figma y

  // ---- shared field: one motion value, complementary Figma gradients ----
  float tBg = clamp((y - uBgSpan.x) / (uBgSpan.y - uBgSpan.x), 0.0, 1.0);
  float tFg = clamp((y - uBgSpan.z) / (uBgSpan.w - uBgSpan.z), 0.0, 1.0);
  vec3 bg = rampBg(0.5 + uH * (tBg - 0.5));
  vec3 fg = rampFg(0.5 + uH * (tFg - 0.5));

  // ---- lettering: 8 rows, full width, individual heights (x never scaled) ----
  // two vertical sub-samples smooth the row edges (rows clip their wordmark)
  float dy = 0.25 / uPxPerUnit;
  float m = 0.5 * (letters(fuv.x, y - dy) + letters(fuv.x, y + dy));

  vec3 col = mix(bg, fg, m);
  col += (hash(frag) - 0.5) / 255.0;       // dither: no banding in dark ramps
  gl_FragColor = vec4(col, 1.0);
}
`;

const hexToRgb = (hex) => {
  const n = parseInt(hex.replace('#', ''), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
};

function compile(gl, type, src) {
  const s = gl.createShader(type);
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    throw new Error(gl.getShaderInfoLog(s) || 'shader compile failed');
  }
  return s;
}

/** Allow non-uniform scaling of the artwork (full-width frame, vertical stretch). */
export function stretchable(svgText) {
  return svgText.replace(/<svg\b([^>]*?)\s*preserveAspectRatio="[^"]*"/, '<svg$1')
    .replace(/<svg\b/, '<svg preserveAspectRatio="none"');
}

/**
 * Rasterise the wordmark (vector → crisp at every size) into a vertical
 * level atlas: level k is the full-width wordmark at height level0Px / 2^k,
 * stacked top to bottom with transparent padding between levels.
 */
async function rasteriseAtlas(svgText, w, level0Px) {
  const url = URL.createObjectURL(new Blob([stretchable(svgText)], { type: 'image/svg+xml' }));
  try {
    const img = new Image();
    img.decoding = 'async';
    img.src = url;
    await img.decode();
    const PAD = 4;
    const levels = [];
    let y = 0;
    for (let k = 0; k < LEVELS; k++) {
      const hpx = Math.max(2, Math.round(level0Px / 2 ** k));
      levels.push({ y, h: hpx });
      y += hpx + PAD;
    }
    const c = document.createElement('canvas');
    c.width = w;
    c.height = y;
    const ctx = c.getContext('2d');
    for (const l of levels) ctx.drawImage(img, 0, l.y, w, l.h);
    return { canvas: c, levels, height: y };
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Composition frame placement: the Figma frame (378.7 × 821) is mapped onto
 * the whole safe area — every row spans the full width; the frame's height
 * spans the safe height. Both Figma states fit inside 0…821, so every
 * interpolated layout does too: nothing can leave the safe area.
 *   view = { W, H, safe: { x, y, w, h } }   (CSS px)
 * sy = CSS px per Figma unit vertically (also places the gradients).
 */
export function computeFit(view) {
  const { safe } = view;
  return { dw: safe.w, dh: safe.h, ox: safe.x, oy: safe.y, sy: safe.h / FRAME.h };
}

/**
 * Row layout for front/back tilt v ∈ [−1, 1]: every row's top and height
 * are interpolated independently between the two Figma frames
 * (v = −1 → "tilt -100", v = +1 → "tilt +100", v = 0 → exact midpoint).
 * Linear interpolation of two gap-free stackings stays gap/overlap-free.
 */
export function layoutRows(v) {
  const k = Math.min(1, Math.max(0, (v + 1) / 2));
  const tops = new Float32Array(ROW_COUNT);
  const heights = new Float32Array(ROW_COUNT);
  for (let i = 0; i < ROW_COUNT; i++) {
    const [t0, h0] = ROWS.left[i];
    const [t1, h1] = ROWS.right[i];
    tops[i] = t0 + (t1 - t0) * k;
    heights[i] = h0 + (h1 - h0) * k;
  }
  return { tops, heights };
}

/** Pad a stop list to STOPS entries → flat [r,g,b,...] and positions. */
function rampUniforms(stops) {
  const padded = [...stops];
  while (padded.length < STOPS) padded.push({ ...stops[stops.length - 1], pos: 1 });
  return {
    cols: padded.flatMap((st) => hexToRgb(st.color)),
    pos: padded.map((st) => st.pos),
  };
}

export function createRenderer(canvas, svgText) {
  const gl = canvas.getContext('webgl', {
    alpha: false,
    antialias: false,
    depth: false,
    stencil: false,
    premultipliedAlpha: false,
    powerPreference: 'high-performance',
  });
  if (!gl) return null;

  const prog = gl.createProgram();
  gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, VERT));
  gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, FRAG));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
  gl.useProgram(prog);

  // full-screen triangle
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const aPos = gl.getAttribLocation(prog, 'aPos');
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

  const U = {};
  for (const n of ['uRes', 'uFit', 'uRowTop', 'uRowH', 'uPxPerUnit', 'uLvlOff', 'uLvlH', 'uLvlPx',
    'uH', 'uFrameH', 'uBgSpan', 'uBgCol', 'uBgPos', 'uFgCol', 'uFgPos', 'uMask']) U[n] = gl.getUniformLocation(prog, n);

  // ---- static uniforms from the Figma config ----
  const bg = rampUniforms(GRADIENTS.background.stops);
  const fg = rampUniforms(GRADIENTS.typography.stops);
  gl.uniform3fv(U.uBgCol, bg.cols);
  gl.uniform1fv(U.uBgPos, bg.pos);
  gl.uniform3fv(U.uFgCol, fg.cols);
  gl.uniform1fv(U.uFgPos, fg.pos);
  gl.uniform4f(U.uBgSpan, GRADIENTS.background.y0, GRADIENTS.background.y1,
    GRADIENTS.typography.y0, GRADIENTS.typography.y1);
  gl.uniform1f(U.uFrameH, FRAME.h);

  // mask texture
  const tex = gl.createTexture();
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(4));
  gl.uniform1i(U.uMask, 0);
  const maxTex = Math.min(gl.getParameter(gl.MAX_TEXTURE_SIZE), 4096);

  let rasterToken = 0;
  let cssW = 1;
  let cssH = 1;

  /** Resize drawing buffer & re-rasterise the lettering at screen resolution. */
  async function resize(view, dpr) {
    const { W: w, H: h } = view;
    cssW = w;
    cssH = h;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.uniform2f(U.uRes, canvas.width, canvas.height);

    const fit = computeFit(view);
    // screen uv (0..1) -> frame uv (0..1)
    gl.uniform4f(U.uFit, w / fit.dw, h / fit.dh, -fit.ox / fit.dw, -fit.oy / fit.dh);
    const pxPerUnit = fit.sy * dpr;
    gl.uniform1f(U.uPxPerUnit, pxPerUnit);

    // level 0 = tallest row height that can occur on screen
    const tallest = Math.max(...ROWS.left.map((r) => r[1]), ...ROWS.right.map((r) => r[1]));
    const tw = Math.min(maxTex, Math.round(fit.dw * dpr));
    const level0 = Math.min(maxTex / 2.2, Math.ceil(tallest * pxPerUnit));
    const token = ++rasterToken;
    const atlas = await rasteriseAtlas(svgText, tw, level0);
    if (token !== rasterToken || gl.isContextLost()) return;
    gl.uniform1fv(U.uLvlOff, atlas.levels.map((l) => l.y / atlas.height));
    gl.uniform1fv(U.uLvlH, atlas.levels.map((l) => l.h / atlas.height));
    gl.uniform1fv(U.uLvlPx, atlas.levels.map((l) => l.h));
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, atlas.canvas);
  }

  /** rows = layoutRows(h) for the typography; h (−1..1) for the gradient field */
  function render(rows, h) {
    gl.uniform1fv(U.uRowTop, rows.tops);
    gl.uniform1fv(U.uRowH, rows.heights);
    gl.uniform1f(U.uH, h);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  function dispose() {
    rasterToken++;
    gl.deleteTexture(tex);
    gl.deleteBuffer(buf);
    gl.deleteProgram(prog);
  }

  return { resize, render, dispose, gl, get size() { return [cssW, cssH]; } };
}
