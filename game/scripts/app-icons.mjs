// npm run cap:assets — builds the app icon and splash sources in resources/ from MICA's
// pixel icon (assets/icon-mica.svg), then lets @capacitor/assets write every native size.
// Integer scaling keeps the pixel art crisp.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// sharp ships with @capacitor/assets; resolve it from there so it is not a separate dependency.
const require = createRequire(path.join(root, 'node_modules/@capacitor/assets/package.json'));
const sharp = require('sharp');

const BG = '#0b121d';
const svg = fs.readFileSync(path.join(root, 'assets/icon-mica.svg'));
const out = path.join(root, 'resources');
fs.mkdirSync(out, { recursive: true });

// The icon is drawn on a 48-unit grid; render it at an exact multiple.
const art = (scale) => sharp(svg, { density: 72 * scale }).png().toBuffer();
const square = (size, color) =>
  sharp({ create: { width: size, height: size, channels: 4, background: color } });

async function place(size, scale, background, file) {
  const icon = await art(scale);
  const offset = Math.round((size - 48 * scale) / 2);
  await square(size, background).composite([{ input: icon, left: offset, top: offset }]).png().toFile(path.join(out, file));
}

await place(1024, 16, BG, 'icon-only.png'); // iOS and legacy Android icon
await place(1024, 12, { r: 0, g: 0, b: 0, alpha: 0 }, 'icon-foreground.png'); // Android adaptive: stays inside the safe zone
await square(1024, BG).png().toFile(path.join(out, 'icon-background.png'));
await place(2732, 8, BG, 'splash.png');
await place(2732, 8, BG, 'splash-dark.png');
console.log('Wrote icon and splash sources to resources/.');

// Web icons (public/ is copied to the site root): Add to Home Screen on iPhone and Android.
const web = path.join(root, 'public/icons');
fs.mkdirSync(web, { recursive: true });
const toWeb = async (size, scale, file) => {
  const icon = await art(scale);
  const offset = Math.round((size - 48 * scale) / 2);
  await square(size, BG).composite([{ input: icon, left: offset, top: offset }]).png().toFile(path.join(web, file));
};
await toWeb(180, 3, 'apple-touch-icon.png');
await toWeb(192, 3, 'icon-192.png');
await toWeb(512, 8, 'icon-512.png');
console.log('Wrote web icons to public/icons/.');

// Link preview (WhatsApp, Discord, social posts): 1200x630, the launch scene with the title.
const sceneSvg = fs.readFileSync(path.join(root, 'assets/scene-launch.svg'));
const scene = await sharp(sceneSvg, { density: 72 * 3.75 }).resize(1200, 675, { kernel: 'nearest' }).extract({ left: 0, top: 22, width: 1200, height: 630 }).png().toBuffer();
const overlay = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630">
  <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="${BG}" stop-opacity="0"/><stop offset="1" stop-color="${BG}" stop-opacity="0.94"/>
  </linearGradient></defs>
  <rect x="0" y="330" width="1200" height="300" fill="url(#g)"/>
  <text x="60" y="540" font-family="DejaVu Sans Mono, Consolas, monospace" font-size="66" font-weight="700" letter-spacing="6" fill="#e2d2ab">THE LAST WEATHER</text>
  <text x="62" y="588" font-family="DejaVu Sans Mono, Consolas, monospace" font-size="26" letter-spacing="3" fill="#6ad5d0">A SHORT SURVIVAL STORY ON VESPER-6</text>
</svg>`);
await sharp(scene).composite([{ input: overlay }]).png().toFile(path.join(root, 'public/og-image.png'));
console.log('Wrote public/og-image.png.');
