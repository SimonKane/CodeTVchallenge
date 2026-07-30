/**
 * Last-resort handcrafted depth plate used when Python/Depth Anything V2 is
 * unavailable. White is near, black is far. Run from the repository root:
 *   node src/components/Experience/scripts/generate-depth-map-fallback.mjs
 */
import sharp from "sharp";

const output = "src/components/Experience/assets/street-depth.png";
const width = 768;
const height = 512;

const svg = `
<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="distance" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#1b1b1b"/>
      <stop offset=".48" stop-color="#343434"/>
      <stop offset=".63" stop-color="#686868"/>
      <stop offset="1" stop-color="#f2f2f2"/>
    </linearGradient>
    <radialGradient id="vanish" cx=".5" cy=".58" r=".7">
      <stop offset="0" stop-color="#242424"/>
      <stop offset=".58" stop-color="#858585"/>
      <stop offset="1" stop-color="#d8d8d8"/>
    </radialGradient>
    <linearGradient id="road" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#4b4b4b"/>
      <stop offset="1" stop-color="#ffffff"/>
    </linearGradient>
  </defs>
  <rect width="768" height="512" fill="url(#distance)"/>
  <rect width="768" height="512" fill="url(#vanish)" opacity=".32"/>
  <path d="M344 303 L424 303 L720 512 L48 512 Z" fill="url(#road)" opacity=".88"/>
  <path d="M0 80 L160 96 L300 318 L0 410 Z" fill="#b8b8b8" opacity=".68"/>
  <path d="M768 72 L615 98 L470 320 L768 406 Z" fill="#ababab" opacity=".64"/>
  <path d="M0 0 L105 0 L165 302 L0 340 Z" fill="#dadada" opacity=".35"/>
  <path d="M768 0 L670 0 L610 303 L768 338 Z" fill="#d2d2d2" opacity=".32"/>
  <rect x="504" y="113" width="13" height="242" rx="4" fill="#bebebe"/>
  <circle cx="477" cy="112" r="18" fill="#9a9a9a"/>
</svg>`;

await sharp(Buffer.from(svg))
  .greyscale()
  .blur(9)
  .png({ compressionLevel: 9 })
  .toFile(output);

console.log(`Wrote ${output} (hand-authored fallback depth plate)`);
