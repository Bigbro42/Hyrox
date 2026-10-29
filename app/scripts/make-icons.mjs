// Renders the PNG app icons from public/icon.svg (run after changing the icon: `npm run icons`).
// iOS and the maskable Android icon get a full-bleed square without rounded corners; the
// system applies its own mask. The maskable artwork keeps to the inner 80 % safe zone.
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const pub = path.resolve(import.meta.dirname, '../public');
const svg = fs.readFileSync(path.join(pub, 'icon.svg'), 'utf8');
const square = svg.replace(/<rect[^>]*rx="112"[^>]*\/>/, '<rect width="512" height="512" fill="#0a0a0a"/>');
const art = square.replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '').replace('<rect width="512" height="512" fill="#0a0a0a"/>', '');
const maskable = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" fill="#0a0a0a"/><g transform="translate(51.2 40) scale(0.8)">${art}</g></svg>`;

const targets = [
  ['icon-192.png', square, 192],
  ['icon-512.png', square, 512],
  ['apple-touch-icon.png', square, 180],
  ['icon-maskable-512.png', maskable, 512],
];

const browser = await chromium.launch();
for (const [name, source, size] of targets) {
  const page = await browser.newPage({ viewport: { width: size, height: size } });
  await page.setContent(`<html><body style="margin:0;background:#0a0a0a">${source.replace('<svg ', `<svg width="${size}" height="${size}" `)}</body></html>`);
  await page.screenshot({ path: path.join(pub, name), omitBackground: false });
  await page.close();
}
await browser.close();
console.log('Icons written:', targets.map((t) => t[0]).join(', '));
