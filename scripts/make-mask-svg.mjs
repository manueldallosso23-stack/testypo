// Derives the lettering MASK from the verbatim Figma export
// (src/assets/figma/tilt-minus-100.svg, frame "tilt -100", node 2005:2050).
// Geometry is untouched; only paint is removed:
//   - the frame background <rect> is dropped (background is drawn by the shader)
//   - the gradient fills of the letter paths become solid white (shape coverage)
//   - the viewBox uses the exact frame size 378.701 × 821 (Figma rounds width to 379)
import { readFileSync, writeFileSync } from 'node:fs';

const src = readFileSync(new URL('../src/assets/figma/tilt-minus-100.svg', import.meta.url), 'utf8');
let out = src
  .replace(/<rect width="378\.701" height="821" fill="url\(#paint0_linear_[^"]+\)"\/>\n?/, '')
  .replace(/fill="url\(#paint\d+_linear_[^"]+\)"/g, 'fill="#fff"')
  .replace(/<linearGradient[\s\S]*?<\/linearGradient>\n?/g, '')
  .replace('width="379" height="821" viewBox="0 0 379 821"', 'width="378.701" height="821" viewBox="0 0 378.701 821"');

const paths = (out.match(/<path /g) || []).length;
if (paths !== 8 || /paint\d/.test(out) || /<rect width="378.701" height="821" fill="url/.test(out)) {
  throw new Error(`unexpected export structure (paths=${paths})`);
}
writeFileSync(new URL('../src/assets/typography.svg', import.meta.url), out);
console.log('wrote src/assets/typography.svg —', paths, 'paths');
