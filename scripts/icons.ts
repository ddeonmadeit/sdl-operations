/** Generates PWA icons and the favicon from the SDL leaf mark. Run: npm run icons */
import { readFileSync } from "node:fs";
import sharp from "sharp";

const OLIVE = "#404232";
const LEAF = "#5E622C";
const markCream = readFileSync("public/brand/logo-mark-cream.svg");
const markColour = readFileSync("public/brand/logo-mark.svg");

// Office = cream leaf on dark olive. Site = cream leaf on leaf olive. Generic = olive.
// Clay is kept for problems only, never for branding.
const variants = [
  { id: "icon", bg: OLIVE },
  { id: "office", bg: OLIVE },
  { id: "site", bg: LEAF },
];

async function icon(bg: string, size: number, markShare: number, rounded: boolean) {
  const markH = Math.round(size * markShare);
  const mark = await sharp(markCream, { density: 300 }).resize({ height: markH }).png().toBuffer();
  const meta = await sharp(mark).metadata();
  const radius = rounded ? Math.round(size * 0.22) : 0;
  const base = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><rect width="${size}" height="${size}" rx="${radius}" fill="${bg}"/></svg>`);
  return sharp(base)
    .composite([{ input: mark, left: Math.round((size - (meta.width ?? markH)) / 2), top: Math.round((size - markH) / 2) }])
    .png()
    .toBuffer();
}

async function main() {
  for (const v of variants) {
    for (const size of [192, 512]) {
      await sharp(await icon(v.bg, size, 0.62, true)).toFile(`public/icons/${v.id}-${size}.png`);
      // Maskable icons are cropped by the phone – keep the leaf inside the safe zone.
      await sharp(await icon(v.bg, size, 0.5, false)).toFile(`public/icons/${v.id}-maskable-${size}.png`);
    }
    await sharp(await icon(v.bg, 180, 0.58, false)).toFile(`public/icons/${v.id === "icon" ? "apple-touch-icon" : `${v.id}-apple`}.png`);
  }
  await sharp(markColour, { density: 300 }).resize({ height: 48, width: 48, fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toFile("public/favicon.ico");
  console.log("Icons written to public/icons");
}
main();
