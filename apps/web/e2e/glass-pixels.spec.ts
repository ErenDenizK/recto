/**
 * Rendered glass over a white page (docs/specs/redesign.md D0-1's acceptance; research 22 §3.2;
 * ADR-0028), tagged @pixels so the `chromium-nogpu` project runs it: the compositor's software
 * path, where the M8 bar (44 px, blur 28px) rendered #5b5d61 over a white page instead of the
 * model's #47494d and its secondary text fell to 3.6:1.
 *
 * A blank Letter page at fit width puts white under the floating bar and under the Document
 * menu; a full-viewport screenshot (clipped ones skip backdrop filters) is sampled as a 4 × 4
 * median at a text-free point inside each surface, and must sit within ±2/255 per channel of the
 * model computed from the surface's own tint and filter (e2e/support/pixels.ts). The text on
 * them is then measured against what rendered, not against the model.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

import { PDFDocument } from '@cantoo/pdf-lib';
import { expect, type Page, test } from '@playwright/test';

import { useFileInputPicker } from './helpers';
import {
  channelDistance,
  contrastRatio,
  fullViewportPixels,
  glassModel,
  glassStyle,
  hex,
  median4x4,
  type Rgb,
} from './support/pixels';

test.use({ viewport: { width: 1440, height: 900 } });

const WHITE: Rgb = [255, 255, 255];
/** `--text-primary` and `--glass-text-secondary` (styles/tokens.css), kept in step by hand. */
const TEXT_PRIMARY: Rgb = [0xe8, 0xe9, 0xec];
const GLASS_TEXT_SECONDARY: Rgb = [0xbb, 0xbe, 0xc3];

/** One blank US Letter page: white everywhere the bar and the menus can sit. */
async function blankPdf(): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.addPage([612, 792]);
  return pdf.save();
}

async function openBlankPage(page: Page, file: string): Promise<void> {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, await blankPdf());
  await useFileInputPicker(page);
  await page.goto('./?lang=en');
  const chooser = page.waitForEvent('filechooser');
  await page
    .getByRole('button', { name: /^(Open files|Dosya aç)$/ })
    .first()
    .click();
  await (await chooser).setFiles(file);
  await expect(page.locator('canvas[data-state="rendered"]').first()).toBeAttached({
    timeout: 30_000,
  });
  // Nothing hovered: the pointer rests over the canvas, away from every surface.
  await page.mouse.move(340, 450);
}

test.skip(
  ({ browserName }) => browserName !== 'chromium',
  'Chromium only for now: Firefox and WebKit composite backdrop filters their own way, and ' +
    'their pixel models join with the three-engine glass matrix (language.md §10.2)',
);

test(
  'the floating bar over a white page renders within 2 levels of the model',
  { tag: '@pixels' },
  async ({ page }, testInfo) => {
    await openBlankPage(page, testInfo.outputPath('white-page.pdf'));
    // Edit: the bar with its five groups, about 436 × 44 px.
    await page.keyboard.press('2');
    const bar = page.getByRole('toolbar', { name: 'Tools', exact: true });
    await expect(bar.locator('[data-bar-group]').first()).toBeVisible();
    await page.mouse.move(340, 450);
    const barBox = await bar.boundingBox();
    const pageBox = await page.locator('[data-page-index="0"]').first().boundingBox();
    if (!barBox || !pageBox) throw new Error('bar or page not laid out');
    // The page is under the bar, with room for the blur all round.
    expect(pageBox.x).toBeLessThan(barBox.x - 40);
    expect(pageBox.x + pageBox.width).toBeGreaterThan(barBox.x + barBox.width + 40);
    expect(pageBox.y).toBeLessThan(barBox.y - 40);
    // The group nearest the bar's middle that is not the shown one (no fill): its left padding,
    // 12 px before its icon, is glass and nothing else, far from the bar's ends.
    const group = await bar.evaluate((el) => {
      const middle = el.getBoundingClientRect().left + el.getBoundingClientRect().width / 2;
      const groups = [...el.querySelectorAll<HTMLElement>('[data-bar-group]')]
        .filter(
          (g) => g.getAttribute('aria-pressed') !== 'true' && !g.hasAttribute('data-bar-chip'),
        )
        .map((g) => g.getBoundingClientRect());
      groups.sort(
        (a, b) => Math.abs(a.left + a.width / 2 - middle) - Math.abs(b.left + b.width / 2 - middle),
      );
      const r = groups[0];
      return r ? { x: r.left, y: r.top, height: r.height } : null;
    });
    if (!group) throw new Error('no group on the bar');
    const centreY = barBox.y + barBox.height / 2;

    const image = await fullViewportPixels(page);
    await testInfo.attach('bar over a white page', {
      body: await page.screenshot({ animations: 'disabled' }),
      contentType: 'image/png',
    });
    const sample = median4x4(image, group.x + 4, centreY - 2);
    const beside = median4x4(image, pageBox.x + 40, centreY - 2);
    expect(beside, 'the page beside the bar is white').toEqual(WHITE);
    const model = glassModel(await glassStyle(bar), WHITE);
    // The composite tokens.test.ts asserts for the bar tier (M2) over white.
    expect(hex(model)).toBe('#444548');
    // Near the bar's top and bottom edges the page still leaks in (1 − c grows towards an
    // edge, research 22 §3.2): recorded, not asserted.
    const top = median4x4(image, group.x + 4, barBox.y + 2);
    const bottom = median4x4(image, group.x + 4, barBox.y + barBox.height - 6);
    testInfo.annotations.push({
      type: 'bar over white',
      description: `rendered ${hex(sample)}, model ${hex(model)}, 2 px in from the top ${hex(top)}, from the bottom ${hex(bottom)}; primary ${contrastRatio(TEXT_PRIMARY, sample).toFixed(2)}:1, glass secondary ${contrastRatio(GLASS_TEXT_SECONDARY, sample).toFixed(2)}:1`,
    });
    expect(
      channelDistance(sample, model),
      `rendered ${hex(sample)} against the model ${hex(model)}`,
    ).toBeLessThanOrEqual(2);
    // So the text on it holds what the model promises (tokens.test.ts: 7.90 and 5.14).
    expect(contrastRatio(TEXT_PRIMARY, sample)).toBeGreaterThanOrEqual(7.7);
    expect(contrastRatio(GLASS_TEXT_SECONDARY, sample)).toBeGreaterThanOrEqual(5.0);
  },
);

test(
  'a menu over a white page renders within 2 levels of the model',
  { tag: '@pixels' },
  async ({ page }, testInfo) => {
    await openBlankPage(page, testInfo.outputPath('white-page.pdf'));
    await page
      .getByRole('button', { name: /^Document/ })
      .first()
      .click();
    const menu = page.getByRole('menu').first();
    await expect(menu).toBeVisible();
    const pageBox = await page.locator('[data-page-index="0"]').first().boundingBox();
    const menuBox = await menu.boundingBox();
    if (!pageBox || !menuBox) throw new Error('menu or page not laid out');
    expect(menuBox.x + menuBox.width).toBeLessThan(pageBox.x + pageBox.width - 30);
    await page.mouse.move(340, 450);
    // The menu's middle column on a row whose label ends before it, well below the page's top
    // edge: glass and nothing else, far from the menu's sides.
    const point = await menu.evaluate((el, pageTop) => {
      const box = el.getBoundingClientRect();
      const middle = box.left + box.width / 2;
      for (const row of el.querySelectorAll<HTMLElement>('[role="menuitem"]')) {
        const r = row.getBoundingClientRect();
        // Everything the row draws: its text and any icon, hint or arrow.
        let right = r.left;
        const walker = document.createTreeWalker(row, NodeFilter.SHOW_TEXT);
        for (let node = walker.nextNode(); node; node = walker.nextNode()) {
          if (!node.textContent?.trim()) continue;
          const range = document.createRange();
          range.selectNodeContents(node);
          right = Math.max(right, range.getBoundingClientRect().right);
        }
        for (const child of row.querySelectorAll('svg, kbd')) {
          right = Math.max(right, child.getBoundingClientRect().right);
        }
        if (r.top > pageTop + 40 && right < middle - 8 && r.bottom < box.bottom - 40) {
          return { x: middle, y: r.top + r.height / 2 };
        }
      }
      return null;
    }, pageBox.y);
    if (!point) throw new Error('no text-free row over the page');

    const image = await fullViewportPixels(page);
    await testInfo.attach('menu over a white page', {
      body: await page.screenshot({ animations: 'disabled' }),
      contentType: 'image/png',
    });
    const sample = median4x4(image, point.x - 2, point.y - 2);
    const model = glassModel(await glassStyle(menu), WHITE);
    expect(hex(model)).toBe('#36383c');
    testInfo.annotations.push({
      type: 'menu over white',
      description: `rendered ${hex(sample)}, model ${hex(model)}; primary ${contrastRatio(TEXT_PRIMARY, sample).toFixed(2)}:1, glass secondary ${contrastRatio(GLASS_TEXT_SECONDARY, sample).toFixed(2)}:1`,
    });
    expect(
      channelDistance(sample, model),
      `rendered ${hex(sample)} against the model ${hex(model)}`,
    ).toBeLessThanOrEqual(2);
  },
);
