/**
 * Single-pass WebGL renderer.
 *
 * ONE motion value h ∈ [-1, 1] drives ONE shared gradient field.
 * Both surfaces read it through the Figma gradients, which are each
 * other's complement (stops reversed between the "tilt +100" and
 * "tilt -100" frames):
 *     t_s(y)      = 0.5 + h · (t(y) − 0.5)          shared field reading
 *     background  = rampBg( t_s of the frame gradient  )
 *     typography  = rampFg( t_s of the Union gradient  )
 * h = +1 → frame "tilt +100", h = −1 → "tilt -100", h = 0 → exact 50 % midpoint.
 *
 * The gradients live in FRAME space along y; the lettering mask is sampled
 * with scaleX applied on x only, so scaling never touches the gradients.
 */
import { GRADIENTS, TYPOGRAPHY, FRAME } from '../config/art.js';

const STOPS = 4; // max stops per ramp (shorter ramps are padded)

const VERT = `
attribute vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }
`;

const FRAG = `
precision highp float;

uniform vec2  uRes;                 // drawing-buffer size (px)
uniform vec4  uFit;                 // screenUV -> frameUV : uv*xy + zw
uniform float uScaleX;              // horizontal scale of the lettering
uniform float uAnchorX;             // pivot of the scale, frame UV
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

float mask(vec2 uv) {
  if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) return 0.0;
  return texture2D(uMask, uv).a;
}

void main() {
  vec2 frag = gl_FragCoord.xy;
  vec2 p = vec2(frag.x / uRes.x, 1.0 - frag.y / uRes.y);   // y down, like Figma
  vec2 fuv = p * uFit.xy + uFit.zw;                         // frame UV (unscaled)
  float y = fuv.y * uFrameH;                                // Figma y

  // ---- shared field: one motion value, complementary Figma gradients ----
  float tBg = clamp((y - uBgSpan.x) / (uBgSpan.y - uBgSpan.x), 0.0, 1.0);
  float tFg = clamp((y - uBgSpan.z) / (uBgSpan.w - uBgSpan.z), 0.0, 1.0);
  vec3 bg = rampBg(0.5 + uH * (tBg - 0.5));
  vec3 fg = rampFg(0.5 + uH * (tFg - 0.5));

  // ---- lettering coverage (scaleX applied on x only) ----
  vec2 suv = fuv;
  suv.x = uAnchorX + (suv.x - uAnchorX) / uScaleX;
  // 4-tap horizontal box filter across the pixel footprint: clean edges
  // when the lettering is compressed.
  float fx = uFit.x / (uRes.x * uScaleX);
  float m = 0.25 * (mask(suv + vec2(-0.375 * fx, 0.0)) + mask(suv + vec2(-0.125 * fx, 0.0)) +
                    mask(suv + vec2( 0.125 * fx, 0.0)) + mask(suv + vec2( 0.375 * fx, 0.0)));

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

/** Parse the SVG's intrinsic size from viewBox (fallback width/height). */
export function svgSize(svgText) {
  const doc = new DOMParser().parseFromString(svgText, 'image/svg+xml');
  const el = doc.documentElement;
  const vb = el.getAttribute('viewBox');
  if (vb) {
    const [, , w, h] = vb.split(/[\s,]+/).map(Number);
    if (w > 0 && h > 0) return { w, h };
  }
  return { w: parseFloat(el.getAttribute('width')) || 1, h: parseFloat(el.getAttribute('height')) || 1 };
}

/** Allow non-uniform scaling of the artwork (needed for scaleX / 2× texture). */
export function stretchable(svgText) {
  return svgText.replace(/<svg\b([^>]*?)\s*preserveAspectRatio="[^"]*"/, '<svg$1')
    .replace(/<svg\b/, '<svg preserveAspectRatio="none"');
}

/** Rasterise the vector SVG at a given pixel size (vector → crisp). */
async function rasterise(svgText, w, h) {
  const url = URL.createObjectURL(new Blob([stretchable(svgText)], { type: 'image/svg+xml' }));
  try {
    const img = new Image();
    img.decoding = 'async';
    img.src = url;
    await img.decode();
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    c.getContext('2d').drawImage(img, 0, 0, w, h);
    return c;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * CONTAIN fit of the Figma frame inside the safe area.
 * Width is budgeted for the MAXIMUM horizontal stretch, so the lettering can
 * never overflow the screen at any tilt; the frame is centred in the safe area.
 *   view = { W, H, safe: { x, y, w, h } }   (CSS px)
 */
export function computeFit(view, svg) {
  const maxScale = 1 + TYPOGRAPHY.scaleAmount;
  // widest extent either side of the pivot at max stretch, in frame widths
  const widthFactor = 2 * Math.max(TYPOGRAPHY.anchorX, 1 - TYPOGRAPHY.anchorX) * maxScale;
  const { safe } = view;
  const scale = Math.min(safe.w / (svg.w * widthFactor), safe.h / svg.h);
  const dw = svg.w * scale;
  const dh = svg.h * scale;
  return { scale, dw, dh, ox: safe.x + (safe.w - dw) / 2, oy: safe.y + (safe.h - dh) / 2 };
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

  const svg = svgSize(svgText);
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
  for (const n of ['uRes', 'uFit', 'uScaleX', 'uAnchorX', 'uH', 'uFrameH', 'uBgSpan',
    'uBgCol', 'uBgPos', 'uFgCol', 'uFgPos', 'uMask']) U[n] = gl.getUniformLocation(prog, n);

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
  gl.uniform1f(U.uAnchorX, TYPOGRAPHY.anchorX);

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

    const fit = computeFit(view, svg);
    // screen uv (0..1) -> svg uv (0..1)
    gl.uniform4f(U.uFit, w / fit.dw, h / fit.dh, -fit.ox / fit.dw, -fit.oy / fit.dh);

    // 2× horizontal headroom so the stretched lettering stays sharp
    const tw = Math.min(maxTex, Math.round(fit.dw * dpr * 2));
    const th = Math.min(maxTex, Math.round(fit.dh * dpr));
    const token = ++rasterToken;
    const c = await rasterise(svgText, tw, th);
    if (token !== rasterToken || gl.isContextLost()) return;
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, c);
  }

  /** scaleX from the vertical tilt, h (−1..1) from the horizontal tilt */
  function render(scaleX, h) {
    gl.uniform1f(U.uScaleX, scaleX);
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
