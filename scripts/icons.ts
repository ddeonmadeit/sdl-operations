/** Generates PWA icons into public/icons. Run: npm run icons */
import sharp from "sharp";

const variants = [
  { id: "icon", bg: "#1f5c3d", fg: "#ffffff", sub: "" },
  { id: "office", bg: "#1f5c3d", fg: "#ffffff", sub: "OFFICE" },
  { id: "site", bg: "#18211c", fg: "#9fd8a8", sub: "SITE" },
];

function svg(bg: string, fg: string, sub: string, size: number, maskable: boolean) {
  const pad = maskable ? size * 0.1 : 0;
  const radius = maskable ? 0 : size * 0.22;
  const cx = size / 2;
  const main = sub ? size * 0.47 : size * 0.56;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
  <rect width="${size}" height="${size}" rx="${radius}" fill="${bg}"/>
  <text x="${cx}" y="${main + pad * 0}" text-anchor="middle" font-family="Inter" font-weight="800" font-size="${size * (maskable ? 0.24 : 0.3)}" fill="${fg}" letter-spacing="${size * -0.005}">SDL</text>
  ${sub ? `<text x="${cx}" y="${size * 0.66}" text-anchor="middle" font-family="Inter" font-weight="700" font-size="${size * (maskable ? 0.085 : 0.1)}" fill="${fg}" opacity="0.85" letter-spacing="${size * 0.012}">${sub}</text>` : ""}
</svg>`;
}

async function main() {
  for (const v of variants) {
    for (const size of [192, 512]) {
      await sharp(Buffer.from(svg(v.bg, v.fg, v.sub, size, false))).png().toFile(`public/icons/${v.id}-${size}.png`);
      await sharp(Buffer.from(svg(v.bg, v.fg, v.sub, size, true))).png().toFile(`public/icons/${v.id}-maskable-${size}.png`);
    }
    await sharp(Buffer.from(svg(v.bg, v.fg, v.sub, 180, true))).png().toFile(`public/icons/${v.id === "icon" ? "apple-touch-icon" : `${v.id}-apple`}.png`);
  }
  console.log("Icons written to public/icons");
}
main();
