/**
 * `pnpm --filter @pdf-editor/media-tool app-icons`: every file made from the Recto mark
 * (docs/brand/README.md "The mark: files and usage", brand plan §5.1), from the one geometry in
 * `apps/web/src/brand/mark.ts`. Writes the SVGs, then renders the PNGs and packs `favicon.ico`
 * in Chromium. The outputs are committed; run it again only when the mark or a tile changes.
 *
 *   docs/brand/logo/recto-mark.svg, -black.svg, -white.svg   the mark in the source's frame
 *   public/icons/glyph.svg      the mark alone: gradient on dark, near-black on light (favicon)
 *   public/icons/app-icon.svg   the full-bleed tile (maskable; the touch icon's master)
 *   public/icons/icon.svg       the rounded tile (install icon, `any`)
 *   public/icons/apple-touch-icon.png 180 · icon-192.png · icon-512.png · icon-maskable-512.png
 *   public/favicon.ico          16, 32, 48 from the rounded tile (legacy browsers, Windows)
 *
 * The tile (brand plan §5.3): always dark, n3 at the top to n1 at the bottom, one soft glow in
 * the mark's lime behind it, no specular or shadow. The mark is 56 % of the tile's height and
 * centred, inside the maskable 80 % circle and well above iOS's 19 % bottom clearance.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { chromium } from '@playwright/test';

import {
  MARK_BOX,
  MARK_FRAME,
  MARK_GRADIENT,
  MARK_INK,
  MARK_PATHS,
  MARK_VIEWBOX,
} from '../../../apps/web/src/brand/mark.ts';
import { chromiumLaunchOptions } from '../../../tooling/playwright-chromium.ts';
import { HERMETIC_ARGS } from './browser.ts';

const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const LOGO_DIR = join(ROOT, 'docs/brand/logo');
const PUBLIC_DIR = join(ROOT, 'apps/web/public');
const ICONS_DIR = join(PUBLIC_DIR, 'icons');

const SVG_NS = 'http://www.w3.org/2000/svg';
const paths = MARK_PATHS.map((d) => `<path d="${d}"/>`).join('');

function gradient(id: string): string {
  const { x1, y1, x2, y2, stops } = MARK_GRADIENT;
  const stopTags = stops
    .map((s) => `<stop offset="${String(s.offset)}" stop-color="${s.color}"/>`)
    .join('');
  return `<linearGradient id="${id}" x1="${String(x1)}" y1="${String(y1)}" x2="${String(x2)}" y2="${String(y2)}" gradientUnits="userSpaceOnUse">${stopTags}</linearGradient>`;
}

/** The mark in the source's 1024 frame, filled with the gradient (`'gradient'`) or one ink. */
function logo(fill: string): string {
  const defs = fill === 'gradient' ? `<defs>${gradient('recto-mark')}</defs>` : '';
  const paint = fill === 'gradient' ? 'url(#recto-mark)' : fill;
  return `<svg xmlns="${SVG_NS}" viewBox="${MARK_FRAME}"><title>Recto</title>${defs}<g fill="${paint}">${paths}</g></svg>\n`;
}

/** The favicon: the mark alone, tight, the gradient on dark and near-black on light tabs. */
function glyph(): string {
  const style = `<style>@media (prefers-color-scheme:light){g{fill:${MARK_INK.black}}}</style>`;
  return `<svg xmlns="${SVG_NS}" viewBox="${MARK_VIEWBOX}">${style}<defs>${gradient('g')}</defs><g fill="url(#g)">${paths}</g></svg>\n`;
}

/**
 * A 1024 tile with the mark at `scale` of its height. `radius` 0 is full bleed (maskable, the
 * touch icon: the system masks it); otherwise the rounded tile for `any` and the favicon.
 */
function tile({ radius, scale }: { radius: number; scale: number }): string {
  const size = 1024;
  const k = (size * scale) / MARK_BOX.size;
  // Centre the mark's square on the tile.
  const offset = (size - MARK_BOX.size * k) / 2;
  const place = `translate(${(offset - MARK_BOX.x * k).toFixed(2)} ${(offset - MARK_BOX.y * k).toFixed(2)}) scale(${k.toFixed(5)})`;
  const shape =
    radius > 0
      ? `<rect width="${String(size)}" height="${String(size)}" rx="${String(radius)}" fill="url(#bg)"/><rect width="${String(size)}" height="${String(size)}" rx="${String(radius)}" fill="url(#glow)"/>`
      : `<rect width="${String(size)}" height="${String(size)}" fill="url(#bg)"/><rect width="${String(size)}" height="${String(size)}" fill="url(#glow)"/>`;
  return [
    `<svg xmlns="${SVG_NS}" viewBox="0 0 ${String(size)} ${String(size)}"><defs>`,
    '<linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#17191e"/><stop offset="1" stop-color="#08090c"/></linearGradient>',
    '<radialGradient id="glow" cx=".5" cy=".46" r=".5">',
    '<stop offset="0" stop-color="#cbff5f" stop-opacity=".2"/>',
    '<stop offset=".35" stop-color="#9df27e" stop-opacity=".11"/>',
    '<stop offset=".7" stop-color="#69eaa3" stop-opacity=".03"/>',
    '<stop offset="1" stop-color="#69eaa3" stop-opacity="0"/></radialGradient>',
    `${gradient('mark')}</defs>${shape}`,
    `<g transform="${place}" fill="url(#mark)">${paths}</g></svg>\n`,
  ].join('');
}

function write(path: string, text: string): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, text);
  console.log(`app-icons: ${path.slice(ROOT.length)}`);
}

/** An ICO holding PNG images (Vista and later read PNG entries). */
function ico(images: readonly { size: number; png: Buffer }[]): Buffer {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);
  const entries: Buffer[] = [];
  let offset = 6 + 16 * images.length;
  for (const { size, png } of images) {
    const entry = Buffer.alloc(16);
    entry.writeUInt8(size >= 256 ? 0 : size, 0);
    entry.writeUInt8(size >= 256 ? 0 : size, 1);
    entry.writeUInt8(0, 2);
    entry.writeUInt8(0, 3);
    entry.writeUInt16LE(1, 4);
    entry.writeUInt16LE(32, 6);
    entry.writeUInt32LE(png.length, 8);
    entry.writeUInt32LE(offset, 12);
    offset += png.length;
    entries.push(entry);
  }
  return Buffer.concat([header, ...entries, ...images.map((i) => i.png)]);
}

async function main(): Promise<void> {
  write(join(LOGO_DIR, 'recto-mark.svg'), logo('gradient'));
  write(join(LOGO_DIR, 'recto-mark-black.svg'), logo(MARK_INK.black));
  write(join(LOGO_DIR, 'recto-mark-white.svg'), logo(MARK_INK.white));
  write(join(ICONS_DIR, 'glyph.svg'), glyph());
  const bleed = tile({ radius: 0, scale: 0.56 });
  const rounded = tile({ radius: 230, scale: 0.6 });
  // At 16–48 px the mark takes more of the tile, or its notch closes up.
  const small = tile({ radius: 230, scale: 0.72 });
  write(join(ICONS_DIR, 'app-icon.svg'), bleed);
  write(join(ICONS_DIR, 'icon.svg'), rounded);

  const browser = await chromium.launch({ ...chromiumLaunchOptions(), args: [...HERMETIC_ARGS] });
  try {
    const page = await browser.newPage({ deviceScaleFactor: 1 });
    const render = async (svg: string, size: number): Promise<Buffer> => {
      await page.setViewportSize({ width: size, height: size });
      const sized = svg.replace('<svg ', `<svg width="${String(size)}" height="${String(size)}" `);
      await page.setContent(
        `<!doctype html><html><body style="margin:0;background:transparent">${sized}</body></html>`,
      );
      return page.screenshot({ type: 'png', omitBackground: true });
    };
    const png = async (name: string, svg: string, size: number) => {
      const path = join(ICONS_DIR, name);
      writeFileSync(path, await render(svg, size));
      console.log(`app-icons: ${path.slice(ROOT.length)}`);
    };
    await png('apple-touch-icon.png', bleed, 180);
    await png('icon-192.png', rounded, 192);
    await png('icon-512.png', rounded, 512);
    await png('icon-maskable-512.png', bleed, 512);
    const sizes = [16, 32, 48];
    const images = [];
    for (const size of sizes) images.push({ size, png: await render(small, size) });
    const path = join(PUBLIC_DIR, 'favicon.ico');
    writeFileSync(path, ico(images));
    console.log(`app-icons: ${path.slice(ROOT.length)}`);
  } finally {
    await browser.close();
  }
}

await main();
