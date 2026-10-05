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
 *
 * Every registry entry in the rendered-pixel harness (D3-1; components/09-primitives.md §28,
 * spec 09.11; §8's rendered A-gates; quality-bar Q-1 to Q-5): each surface of
 * `styles/coverage-registry.ts`, at its smallest registered size, over every backdrop of
 * `harness/backdrops.ts`, in every theme and Glass setting `tokens.css` defines, in Chromium,
 * Firefox, WebKit and `chromium-nogpu`. What it must render is computed from the tokens (tint,
 * σ, boost; `support/tokens.ts`), never written here, so D3's colour work retunes the tokens
 * without touching this spec:
 *
 * - the centre within ±2/255 of the model;
 * - an edge sample 4 px inside each side within ±4/255 of the span from the model to the leak
 *   the coverage term predicts at that point (`support/pixels.ts`): an engine that clamps the
 *   blur at the surface renders the model there, Chromium lets the unfiltered backdrop in as
 *   the Gaussian mass outside the surface grows, and anything past that span (a blur reading
 *   beyond the sharp edge's band, a lost filter, a wrong tint) fails;
 * - primary and secondary text at least 4.5:1 on what rendered at the centre (A-1);
 * - and the surface's computed tint and filter equal to its tokens, so a module rule that drifts
 *   from the registry shows here.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

import { PDFDocument } from '@cantoo/pdf-lib';
import { expect, type Page, test } from '@playwright/test';

import { useFileInputPicker } from './helpers';
import {
  BACKDROPS,
  COVERAGE_REGISTRY,
  HARNESS_VIEWPORT,
  openHarness,
  surfaceOrigin,
} from './support/harness';
import {
  blurOf,
  channelDistance,
  contrastRatio,
  coverageAt,
  filterSteps,
  fullViewportPixels,
  glassModel,
  glassStyle,
  hex,
  median4x4,
  parseTint,
  type Rgb,
  rangeDistance,
} from './support/pixels';
import { TOKEN_GLASS_MODES, TOKEN_THEMES, tokenColour, tokenGlass } from './support/tokens';

test.use({ viewport: { width: 1440, height: 900 } });

const WHITE: Rgb = [255, 255, 255];
/** `--text-primary` and `--glass-text-secondary` (styles/tokens.css), kept in step by hand. */
const TEXT_PRIMARY: Rgb = [0xe6, 0xe7, 0xea];
const GLASS_TEXT_SECONDARY: Rgb = [0xbc, 0xc0, 0xc6];

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

/**
 * The app's own surfaces, in Chromium only: where a page and its chrome land differs by engine
 * (fonts, the bar's width), so the points sampled here are Chromium's. Every engine samples the
 * same materials in the harness below, where nothing but the glass and its backdrop renders.
 */
const APP_SURFACES_CHROMIUM_ONLY =
  "Chromium only: the app's layout under the bar and the menu is Chromium's; the harness tests " +
  'below sample every registry entry in every engine';

test(
  'the floating bar over a white page renders within 2 levels of the model',
  { tag: '@pixels' },
  async ({ page, browserName }, testInfo) => {
    test.skip(browserName !== 'chromium', APP_SURFACES_CHROMIUM_ONLY);
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
    // The composite tokens.test.ts asserts for tier 1 over white.
    expect(hex(model)).toBe('#47494d');
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
    // So the text on it holds what the model promises (tokens.test.ts: 7.29 and 4.93).
    expect(contrastRatio(TEXT_PRIMARY, sample)).toBeGreaterThanOrEqual(7.1);
    expect(contrastRatio(GLASS_TEXT_SECONDARY, sample)).toBeGreaterThanOrEqual(4.8);
  },
);

test(
  'a menu over a white page renders within 2 levels of the model',
  { tag: '@pixels' },
  async ({ page, browserName }, testInfo) => {
    test.skip(browserName !== 'chromium', APP_SURFACES_CHROMIUM_ONLY);
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
    expect(hex(model)).toBe('#393c42');
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

/** The four edge samples: 4 px inside each side at its middle (09-primitives §28). */
const EDGE_INSET = 4;

test.describe('every coverage registry entry in the rendered-pixel harness', () => {
  test.use({ viewport: HARNESS_VIEWPORT });

  for (const entry of COVERAGE_REGISTRY) {
    test(
      `${entry.id} (${entry.minWidth} × ${entry.minHeight}) renders its tokens over every backdrop`,
      { tag: '@pixels' },
      async ({ page }, testInfo) => {
        test.setTimeout(90_000);
        const { minWidth: width, minHeight: height } = entry;
        const origin = surfaceOrigin(width, height);
        // The 4 × 4 samples' top-left corners, from the surface's top-left corner; the coverage
        // term is taken at each sample's middle.
        const middleX = Math.floor(width / 2);
        const middleY = Math.floor(height / 2);
        const centre = { x: middleX - 2, y: middleY - 2 };
        const edges = [
          { side: 'top', x: middleX - 2, y: EDGE_INSET },
          { side: 'bottom', x: middleX - 2, y: height - EDGE_INSET - 4 },
          { side: 'left', x: EDGE_INSET, y: middleY - 2 },
          { side: 'right', x: width - EDGE_INSET - 4, y: middleY - 2 },
        ] as const;
        const findings: string[] = [];

        for (const theme of TOKEN_THEMES) {
          for (const glass of TOKEN_GLASS_MODES) {
            const tokens = tokenGlass(entry, theme, glass);
            const sigma = blurOf(tokens.backdropFilter);
            const primary = tokenColour('--text-primary', theme, glass);
            // Glass maps secondary text to its own step; Solid brings the normal ladder back.
            const secondary = tokenColour(
              glass === 'solid' ? '--text-secondary' : '--glass-text-secondary',
              theme,
              glass,
            );
            for (const backdrop of BACKDROPS) {
              const scene = `${theme} · ${glass} · ${backdrop.name}`;
              const errorsBefore = testInfo.errors.length;
              await openHarness(page, { entry: entry.id, backdrop: backdrop.name, glass, theme });
              const surface = page.locator(`[data-harness-surface="${entry.id}"]`);
              expect(await surface.boundingBox(), `${scene}: the surface's box`).toEqual({
                x: origin.x,
                y: origin.y,
                width,
                height,
              });

              // The engine resolved the tint and the filter the tokens give.
              const computed = await glassStyle(surface);
              const tint = parseTint(computed.background);
              const tokenTint = parseTint(tokens.background);
              expect
                .soft(channelDistance(tint.rgb, tokenTint.rgb), `${scene}: computed tint`)
                .toBe(0);
              expect
                .soft(Math.abs(tint.alpha - tokenTint.alpha), `${scene}: computed tint alpha`)
                .toBeLessThan(0.005);
              expect
                .soft(filterSteps(computed.backdropFilter), `${scene}: computed backdrop filter`)
                .toEqual(filterSteps(tokens.backdropFilter));
              if (backdrop.beyond) {
                const band = Number(await surface.getAttribute('data-edge-band'));
                expect.soft(band, `${scene}: the white band reaches 3σ`).toBe(Math.ceil(3 * sigma));
              }

              const image = await fullViewportPixels(page);
              const under =
                typeof backdrop.under === 'string'
                  ? tokenColour(backdrop.under, theme, glass)
                  : backdrop.under;
              const corner = median4x4(image, 8, 8);
              expect
                .soft(
                  channelDistance(corner, backdrop.beyond ?? under),
                  `${scene}: the backdrop's corner is ${hex(corner)}`,
                )
                .toBeLessThanOrEqual(1);

              const model = glassModel(tokens, under);
              const atCentre = median4x4(image, origin.x + centre.x, origin.y + centre.y);
              expect
                .soft(
                  channelDistance(atCentre, model),
                  `${scene}: centre ${hex(atCentre)} against the model ${hex(model)}`,
                )
                .toBeLessThanOrEqual(2);
              const primaryRatio = contrastRatio(primary, atCentre);
              const secondaryRatio = contrastRatio(secondary, atCentre);
              expect
                .soft(primaryRatio, `${scene}: primary text on ${hex(atCentre)}`)
                .toBeGreaterThanOrEqual(4.5);
              expect
                .soft(secondaryRatio, `${scene}: secondary text on ${hex(atCentre)}`)
                .toBeGreaterThanOrEqual(4.5);

              let widest = 0;
              const edgeNotes: string[] = [];
              for (const edge of edges) {
                const sample = median4x4(image, origin.x + edge.x, origin.y + edge.y);
                const mass = coverageAt(sigma, width, height, edge.x + 2, edge.y + 2);
                const leak = glassModel(tokens, under, mass);
                expect
                  .soft(
                    rangeDistance(sample, model, leak),
                    `${scene}: ${edge.side} edge ${hex(sample)} against ${hex(model)} to ${hex(leak)} (m ${mass.toFixed(3)})`,
                  )
                  .toBeLessThanOrEqual(4);
                widest = Math.max(widest, channelDistance(sample, atCentre));
                edgeNotes.push(`${edge.side} ${hex(sample)}`);
              }
              const c = coverageAt(sigma, width, height, width / 2, height / 2);
              findings.push(
                `${scene}: σ ${sigma}, c ${c.toFixed(4)}; centre ${hex(atCentre)} (model ${hex(model)}); ${edgeNotes.join(', ')}; edges to centre ≤ ${widest}/255; primary ${primaryRatio.toFixed(2)}:1, secondary ${secondaryRatio.toFixed(2)}:1`,
              );
              if (testInfo.errors.length > errorsBefore) {
                await testInfo.attach(`${entry.id} ${scene}`, {
                  body: await page.screenshot({ animations: 'disabled' }),
                  contentType: 'image/png',
                });
              }
            }
          }
        }
        testInfo.annotations.push({ type: entry.id, description: findings.join('\n') });
      },
    );
  }
});
