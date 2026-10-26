/**
 * The phone's single capsule (EDN-24, Labs `phone-capsule`, `?phonebar=1`), on the `phone` and
 * `phone-land` projects with CDP touch: how the switch resolves (the address beats the Labs
 * toggle), the capsule at 360, 390 and 430 px, the ✎ morph, Pen arming and opening its tray, a
 * stroke, a colour change, Undo and the Redo chip, the armed-tool tap that turns the tool off
 * (and one finger scrolling again), the Eraser, Text with the keyboard's Done, the Edit text
 * switch, Sign's New, Use, placing and Delete, Find and Pages from the icons, reduced motion,
 * the 44 px targets, and a phone on its side (the capsule and the tray side by side, nothing
 * moving when the tray toggles).
 *
 * The motion waits are `motionDone` (the browser spec's `settled`: no finite animation running
 * for two frames), never a fixed pause. Nothing here leans on one engine.
 *
 * Set CAPTURE_SCREENSHOTS=<dir> to write the review screenshots (every capsule state, the sign
 * tray with no plates and with four, light and dark).
 */
import { join } from 'node:path';

import { type CDPSession, expect, type Locator, type Page, test } from '@playwright/test';

import { fixturePath, motionDone, useFileInputPicker } from './helpers';
import { sampleEntry } from './sample-manifest';

const SHOTS = process.env.CAPTURE_SCREENSHOTS;
const LABS_KEY = 'pdf-editor:labs:v1';

async function shot(page: Page, name: string): Promise<void> {
  if (!SHOTS) return;
  const size = page.viewportSize();
  await motionDone(page);
  const scheme = await page.evaluate(() => document.documentElement.dataset.theme ?? 'dark');
  await page.screenshot({
    path: join(SHOTS, `capsule-${name}-${scheme}-${size?.width}x${size?.height}.png`),
  });
}

/** Opens the reader on a PDF; `query` is what follows `?lang=en` in the address. */
async function openReader(page: Page, query = '&phonebar=1'): Promise<void> {
  await useFileInputPicker(page);
  await page.goto(`./?lang=en${query}`);
  await expect(page.getByTestId('compact-library')).toBeVisible();
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Open PDF' }).click();
  await (await chooser).setFiles(fixturePath('simple-text.pdf'));
  await expect(page.getByTestId('compact-reader')).toBeVisible();
  await expect(page.locator('[data-page-index="0"] canvas').first()).toHaveAttribute(
    'data-state',
    'rendered',
  );
}

const capsule = (page: Page) => page.getByTestId('compact-capsule');
const edit = (page: Page) => page.getByTestId('compact-capsule-edit');
const undo = (page: Page) => page.getByTestId('compact-undo');
const redo = (page: Page) => page.getByTestId('compact-redo');
const tray = (page: Page) => page.getByTestId('compact-tool-tray');
const toolButton = (page: Page, tool: 'pen' | 'highlight' | 'text' | 'sign') =>
  page.getByTestId(`compact-capsule-tool-${tool}`);
const done = (page: Page) => page.getByTestId('compact-edit-done');
const isLandscape = (page: Page) => {
  const view = page.viewportSize();
  return view !== null && view.width > view.height;
};

/** Reading → editing, settled, the tool off. */
async function startEditing(page: Page): Promise<void> {
  await edit(page).click();
  await expect(capsule(page)).toHaveAttribute('data-editing');
  await expect(done(page)).toBeVisible();
  await motionDone(page);
}

/** Arms `tool` from the capsule and waits for its tray. */
async function arm(page: Page, tool: 'pen' | 'highlight' | 'text' | 'sign'): Promise<void> {
  await toolButton(page, tool).click();
  await expect(toolButton(page, tool)).toHaveAttribute('aria-pressed', 'true');
  await expect(tray(page)).toBeVisible();
  await motionDone(page);
}

async function expectTarget(locator: Locator): Promise<void> {
  const box = await locator.boundingBox();
  expect(box?.width ?? 0).toBeGreaterThanOrEqual(43.5);
  expect(box?.height ?? 0).toBeGreaterThanOrEqual(43.5);
}

interface Area {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

/** A stretch of the first page's blank lower half, clear of the text, the capsule and the tray. */
async function blankArea(page: Page): Promise<Area> {
  const box = await page.locator('[data-page-index="0"]').boundingBox();
  if (!box) throw new Error('no page');
  const view = page.viewportSize() ?? { width: 390, height: 844 };
  const clear = isLandscape(page) ? 120 : 200;
  const bottom = Math.min(box.y + box.height, view.height - clear);
  return { x: box.x + box.width * 0.2, y: bottom - 90, w: box.width * 0.6, h: 60 };
}

async function touchStroke(cdp: CDPSession, area: Area): Promise<void> {
  const at = (t: number) => ({
    x: area.x + area.w * t,
    y: area.y + area.h / 2 + Math.sin(t * Math.PI * 2) * (area.h / 2.5),
    id: 1,
  });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [at(0)] });
  for (let i = 1; i <= 24; i++) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [at(i / 24)] });
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}

async function tap(cdp: CDPSession, at: { x: number; y: number }): Promise<void> {
  const point = { ...at, id: 1 };
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}

/** Inked (not near-white) pixels of the first page's bitmap inside `area`, as a share. */
async function inkIn(page: Page, area: Area): Promise<number> {
  return page.locator('[data-page-index="0"]').evaluate((el, a) => {
    const canvas = el.querySelector('canvas');
    if (!canvas) return 0;
    const box = canvas.getBoundingClientRect();
    const sx = canvas.width / box.width;
    const sy = canvas.height / box.height;
    const probe = document.createElement('canvas');
    const w = Math.max(1, Math.round(a.w * sx));
    const h = Math.max(1, Math.round(a.h * sy));
    probe.width = w;
    probe.height = h;
    const ctx = probe.getContext('2d');
    if (!ctx) return 0;
    ctx.drawImage(canvas, (a.x - box.x) * sx, (a.y - box.y) * sy, w, h, 0, 0, w, h);
    const data = ctx.getImageData(0, 0, w, h).data;
    let dark = 0;
    for (let i = 0; i < data.length; i += 4) {
      if ((data[i] ?? 255) + (data[i + 1] ?? 255) + (data[i + 2] ?? 255) < 600) dark++;
    }
    return dark / (w * h);
  }, area);
}

async function strokeAndSettle(page: Page, cdp: CDPSession, area: Area): Promise<void> {
  const before = await inkIn(page, area);
  await touchStroke(cdp, area);
  await expect.poll(() => inkIn(page, area), { timeout: 10_000 }).toBeGreaterThan(before);
}

async function inViewport(page: Page, locator: Locator): Promise<void> {
  const view = page.viewportSize() ?? { width: 390, height: 844 };
  const box = await locator.boundingBox();
  if (!box) throw new Error('not laid out');
  expect(box.x).toBeGreaterThanOrEqual(-0.5);
  expect(box.y).toBeGreaterThanOrEqual(-0.5);
  expect(box.x + box.width).toBeLessThanOrEqual(view.width + 0.5);
  expect(box.y + box.height).toBeLessThanOrEqual(view.height + 0.5);
}

test.describe('the single capsule: the switch', () => {
  test('is off without a switch, on by ?phonebar=1', async ({ page }) => {
    await openReader(page, '');
    await expect(page.getByTestId('compact-edit')).toBeVisible();
    await expect(edit(page)).toHaveCount(0);
    await openReader(page, '&phonebar=1');
    await expect(edit(page)).toBeVisible();
    await expect(page.getByTestId('compact-edit')).toHaveCount(0);
    await expect(capsule(page).getByRole('button', { name: 'Pages' })).toBeVisible();
    await expect(capsule(page).getByRole('button', { name: 'Find' })).toBeVisible();
    await shot(page, 'reading');
  });

  test('the Labs toggle turns it on, and ?phonebar=0 beats the toggle', async ({ page }) => {
    await page.addInitScript(
      ([key]) => {
        try {
          localStorage.setItem(key ?? '', JSON.stringify({ flags: { 'phone-capsule': '1' } }));
        } catch {
          // Storage blocked: the test fails below, loudly.
        }
      },
      [LABS_KEY],
    );
    await openReader(page, '');
    await expect(edit(page)).toBeVisible();
    await openReader(page, '&phonebar=0');
    await expect(page.getByTestId('compact-edit')).toBeVisible();
    await expect(edit(page)).toHaveCount(0);
  });
});

test.describe('the single capsule: widths', () => {
  for (const [width, height] of [
    [360, 780],
    [390, 844],
    [430, 932],
  ] as const) {
    test(`${width} px: the capsule, the tray and every target fit`, async ({ page }) => {
      test.skip(isLandscape(page), 'portrait widths');
      await page.setViewportSize({ width, height });
      await openReader(page);
      await inViewport(page, capsule(page));
      for (const button of await capsule(page).getByRole('button').all()) {
        await expectTarget(button);
      }
      await startEditing(page);
      await arm(page, 'pen');
      await inViewport(page, capsule(page));
      await inViewport(page, tray(page));
      const bar = await capsule(page).boundingBox();
      const box = await tray(page).boundingBox();
      expect(box?.width ?? 0).toBeLessThanOrEqual(324.5);
      expect(box?.y ?? 0).toBeLessThan(bar?.y ?? 0);
      for (const button of await capsule(page).getByRole('button').all()) {
        await expectTarget(button);
      }
      for (const button of await tray(page).getByRole('button').all()) {
        await expectTarget(button);
      }
      for (const radio of await tray(page).getByRole('radio').all()) {
        await expectTarget(radio);
      }
      await shot(page, `pen-tray-${width}`);
    });
  }
});

test.describe('the single capsule: editing', () => {
  test('✎ morphs it to the tools; Done morphs it back with focus on ✎', async ({ page }) => {
    await openReader(page);
    await edit(page).click();
    await expect(capsule(page)).toHaveAttribute('data-editing');
    await motionDone(page);
    // The same nav, now Undo, four tools and Done; no tool on and no tray.
    await expect(capsule(page)).toHaveAccessibleName('Editing tools');
    await expect(undo(page)).toHaveAttribute('aria-disabled', 'true');
    for (const tool of ['pen', 'highlight', 'text', 'sign'] as const) {
      await expect(toolButton(page, tool)).toHaveAttribute('aria-pressed', 'false');
    }
    await expect(tray(page)).toHaveCount(0);
    await expect(toolButton(page, 'pen')).toBeFocused();
    await expect(page.getByTestId('compact-page-number')).toHaveCount(0);
    await shot(page, 'editing-off');

    await done(page).click();
    await expect(capsule(page)).not.toHaveAttribute('data-editing');
    await motionDone(page);
    await expect(edit(page)).toBeFocused();
    await expect(page.getByTestId('compact-page-number')).toBeVisible();
  });

  test('Pen arms and opens its tray; a stroke, a colour, Undo and the Redo chip', async ({
    page,
  }) => {
    await openReader(page);
    await startEditing(page);
    const cdp = await page.context().newCDPSession(page);
    await arm(page, 'pen');
    await expect(toolButton(page, 'pen')).toHaveAttribute('aria-expanded', 'true');
    await expect(tray(page)).toHaveAccessibleName('Pen options');
    await shot(page, 'pen-tray');

    const area = await blankArea(page);
    await strokeAndSettle(page, cdp, area);
    await expect(undo(page)).not.toHaveAttribute('aria-disabled', 'true');
    await expect(redo(page)).toHaveCount(0);
    // The tray and the capsule stay while a finger draws.
    await expect(tray(page)).toBeVisible();
    await expect(capsule(page)).not.toHaveAttribute('data-hidden');

    // A colour change while drawing is kept: the next ink is in it.
    const colours = tray(page).getByRole('radiogroup', { name: 'Ink colour' }).getByRole('radio');
    const second = colours.nth(1);
    await second.click();
    await expect(second).toBeChecked();
    await expect(tray(page)).toBeVisible();
    await touchStroke(cdp, { ...area, y: area.y - 70 });
    await expect(second).toBeChecked();

    // Undo until nothing is left (one stroke or two); the Redo chip comes with the first undo.
    while ((await undo(page).getAttribute('aria-disabled')) !== 'true') {
      await undo(page).click();
      await motionDone(page);
    }
    await expect(redo(page)).toBeVisible();
    await expectTarget(redo(page));
    await shot(page, 'redo-chip-tray-open');

    // Redo brings a stroke back and Undo works again.
    await redo(page).click();
    await expect(undo(page)).not.toHaveAttribute('aria-disabled', 'true');
  });

  test('the armed tool turns off by its tap, and one finger scrolls again', async ({ page }) => {
    await openReader(page);
    await startEditing(page);
    await arm(page, 'pen');
    // The armed tool's tap with its tray open: the tool off, the tray gone.
    await toolButton(page, 'pen').click();
    await expect(toolButton(page, 'pen')).toHaveAttribute('aria-pressed', 'false');
    await expect(tray(page)).toHaveCount(0);
    await motionDone(page);

    const cdp = await page.context().newCDPSession(page);
    const scroller = page.getByTestId('compact-pages');
    const top = await scroller.evaluate((el) => el.scrollTop);
    const view = page.viewportSize() ?? { width: 390, height: 844 };
    const finger = (y: number) => ({ x: view.width / 2, y, id: 1 });
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [finger(view.height * 0.6)],
    });
    for (let i = 1; i <= 12; i++) {
      await cdp.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: [finger(view.height * 0.6 - i * 15)],
      });
    }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await expect.poll(() => scroller.evaluate((el) => el.scrollTop)).toBeGreaterThan(top + 40);
    // It drew nothing.
    await expect(undo(page)).toHaveAttribute('aria-disabled', 'true');

    // A tap on a tool turns it on again, and its tray with it.
    await toolButton(page, 'pen').click();
    await expect(toolButton(page, 'pen')).toHaveAttribute('aria-pressed', 'true');
    await expect(tray(page)).toBeVisible();
  });

  test('Highlight and the Eraser: the Eraser sits in the tray and keeps the tool pressed', async ({
    page,
  }) => {
    await openReader(page);
    await startEditing(page);
    const cdp = await page.context().newCDPSession(page);
    await arm(page, 'highlight');
    const area = await blankArea(page);
    // On a phone on its side the strip may cross the page's own text: what counts is the ink
    // this stroke adds and the Eraser takes away again.
    const bare = await inkIn(page, area);
    await strokeAndSettle(page, cdp, area);

    const eraser = page.getByTestId('compact-tray-eraser');
    await expectTarget(eraser);
    await eraser.click();
    await expect(eraser).toHaveAttribute('aria-pressed', 'true');
    // The capsule still shows the tool the Eraser took over from.
    await expect(toolButton(page, 'highlight')).toHaveAttribute('aria-pressed', 'true');
    await shot(page, 'highlight-eraser');

    // The Eraser removes the stroke it crosses.
    await touchStroke(cdp, area);
    await expect
      .poll(() => inkIn(page, area), { timeout: 10_000 })
      .toBeLessThanOrEqual(bare + 0.002);

    // Tapping it again hands the tool back.
    await eraser.click();
    await expect(eraser).toHaveAttribute('aria-pressed', 'false');
  });

  test('a text box: the keyboard Done takes the capsule away and it comes back with the tray', async ({
    page,
  }) => {
    await openReader(page);
    await startEditing(page);
    await arm(page, 'text');
    await expect(tray(page)).toHaveAccessibleName('Text options');
    await shot(page, 'text-tray');

    const cdp = await page.context().newCDPSession(page);
    const area = await blankArea(page);
    await tap(cdp, { x: area.x, y: area.y + 20 });
    const field = page.locator('[data-annotation-layer] textarea');
    await expect(field).toBeFocused();
    await expect(capsule(page)).toHaveAttribute('data-hidden');
    await expect(tray(page)).toHaveCount(0);
    await expect(page.getByTestId('compact-text-bar')).toBeVisible();
    await page.keyboard.type('Capsule');
    await shot(page, 'keyboard-done');

    await page.getByTestId('compact-text-done').click();
    await expect(field).toHaveCount(0);
    await expect(capsule(page)).not.toHaveAttribute('data-hidden');
    await expect(toolButton(page, 'text')).toHaveAttribute('aria-pressed', 'true');
    await expect(tray(page)).toBeVisible();
    await expect(page.locator('[data-annotation-kind="free-text"]')).toHaveCount(1);
  });

  test('the Edit text switch is in Text’s tray and turns Edit text on and off', async ({
    page,
  }) => {
    await openReader(page);
    await startEditing(page);
    await arm(page, 'text');
    const edits = page.getByTestId('compact-edit-text-switch');
    await expectTarget(edits);
    await expect(edits).toHaveAttribute('aria-checked', 'false');
    await edits.click();
    await expect(edits).toHaveAttribute('aria-checked', 'true');
    await expect(page.getByTestId('compact-edit-text-hint')).toBeVisible();
    // Text stays the pressed tool in the capsule.
    await expect(toolButton(page, 'text')).toHaveAttribute('aria-pressed', 'true');
    await shot(page, 'edit-text-tray');
    await edits.click();
    await expect(edits).toHaveAttribute('aria-checked', 'false');
  });

  test('Edit text opens a paragraph of the sample', async ({ page }) => {
    const entry = sampleEntry('en', 'phone');
    const featureIndex = entry.featurePage - 1;
    const start = entry.edit.p4?.start ?? '';
    await page.goto('./?sample&lang=en&phonebar=1');
    await expect(page.getByTestId('compact-reader')).toBeVisible();
    await expect(page.locator('[data-page-index="0"] canvas').first()).toHaveAttribute(
      'data-state',
      'rendered',
    );
    // The feature page's fourth paragraph a third of the way down (past it, then back up, since
    // a scroll up shows the chrome again).
    await page.evaluate(
      async ({ index, text }) => {
        const scroller = document.querySelector<HTMLElement>('[data-read-viewport]');
        const frame = () => new Promise((resolve) => requestAnimationFrame(resolve));
        const find = () =>
          [
            ...document.querySelectorAll(`[data-page-index="${index}"] [data-text-layer] span`),
          ].find((el) => (el.textContent ?? '').startsWith(text));
        for (let i = 0; i < 80 && scroller && !find(); i++) {
          scroller.scrollTop += scroller.clientHeight / 2;
          await frame();
          await frame();
        }
        const span = find();
        if (!scroller || !span) return;
        const top =
          scroller.scrollTop +
          span.getBoundingClientRect().top -
          scroller.getBoundingClientRect().top -
          scroller.clientHeight / 3;
        scroller.scrollTop = top + 80;
        await frame();
        await frame();
        scroller.scrollTop = top;
        await frame();
        await frame();
      },
      { index: featureIndex, text: start },
    );
    await expect(
      page.locator(`[data-page-index="${featureIndex}"] canvas`).first(),
    ).toHaveAttribute('data-state', 'rendered', { timeout: 20_000 });
    await startEditing(page);
    await arm(page, 'text');
    await page.getByTestId('compact-edit-text-switch').click();
    await expect(page.getByTestId('compact-edit-text-switch')).toHaveAttribute(
      'aria-checked',
      'true',
    );
    const line = page
      .locator(`[data-page-index="${featureIndex}"] [data-text-layer] span`)
      .filter({ hasText: start })
      .first();
    await expect(line).toBeVisible();
    const box = await line.boundingBox();
    if (!box) throw new Error('no paragraph line');
    const cdp = await page.context().newCDPSession(page);
    await tap(cdp, { x: box.x + 2, y: box.y + box.height / 2 });
    await expect(page.locator('[data-paragraph-mirror]')).toBeFocused({ timeout: 20_000 });
    await expect(capsule(page)).toHaveAttribute('data-hidden');
  });

  test('Find and Pages open from the icons', async ({ page }) => {
    await openReader(page);
    await capsule(page).getByRole('button', { name: 'Find' }).click();
    await expect(page.getByTestId('compact-find-bar')).toBeVisible();
    await page.getByTestId('compact-find-done').click();
    await expect(page.getByTestId('compact-find-bar')).toHaveCount(0);
    await motionDone(page);
    await capsule(page).getByRole('button', { name: 'Pages' }).click();
    await expect(page.getByTestId('compact-overview')).toBeAttached({ timeout: 15_000 });
  });
});

test.describe('the single capsule: Sign', () => {
  const sheet = (page: Page) => page.getByTestId('new-signature-sheet');

  async function drawSignature(page: Page, cdp: CDPSession): Promise<void> {
    await expect(sheet(page)).toBeVisible();
    await motionDone(page);
    const pad = sheet(page).locator('canvas[data-strokes]');
    await pad.scrollIntoViewIfNeeded();
    const box = await pad.boundingBox();
    if (!box) throw new Error('no pad');
    const at = (t: number) => ({
      x: box.x + box.width * (0.12 + 0.76 * t),
      y: box.y + box.height * (0.55 + Math.sin(t * Math.PI * 3) * 0.25),
      id: 1,
    });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [at(0)] });
    for (let i = 1; i <= 30; i++) {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [at(i / 30)] });
    }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await expect(pad).toHaveAttribute('data-strokes', '1');
  }

  test('New, Use, the plate armed, placing, Delete, and the tray stays', async ({ page }) => {
    await openReader(page);
    await startEditing(page);
    await arm(page, 'sign');
    // Nothing kept: one text button, no plates.
    const add = page.getByTestId('compact-sign-new');
    await expect(add).toHaveText('New signature');
    await expectTarget(add);
    await shot(page, 'sign-tray-0');

    const cdp = await page.context().newCDPSession(page);
    await add.click();
    await drawSignature(page, cdp);
    await sheet(page).getByRole('button', { name: 'Use signature' }).click();
    await expect(sheet(page)).toBeHidden();
    await motionDone(page);

    // The signature is armed for the next tap, its plate shows pressed in the tray.
    const plate = tray(page).locator('[data-saved-signature]');
    await expect(plate).toHaveCount(1);
    await expect(plate).toHaveAttribute('aria-pressed', 'true');
    await expectTarget(plate);
    await expectTarget(page.getByTestId('compact-sign-new'));
    // The "+" is pinned inside the tray, whole.
    const trayBox = await tray(page).boundingBox();
    const plus = await page.getByTestId('compact-sign-new').locator('svg').boundingBox();
    expect((plus?.x ?? 0) + (plus?.width ?? 0)).toBeLessThanOrEqual(
      (trayBox?.x ?? 0) + (trayBox?.width ?? 0) - 6,
    );
    await expect(page.getByTestId('compact-sign-new')).toHaveAccessibleName('New signature');

    const area = await blankArea(page);
    await tap(cdp, { x: area.x + area.w / 2, y: area.y + 10 });
    const stamps = page.locator('[data-annotation-kind="stamp"]');
    await expect(stamps).toHaveCount(1);
    await expect(page.locator('[data-selected-annotation]')).toHaveCount(1);
    // The tray stays open and the plate stays kept.
    await expect(tray(page)).toBeVisible();
    await expect(toolButton(page, 'sign')).toHaveAttribute('aria-pressed', 'true');
    await shot(page, 'sign-placed');

    // Delete from the selection bar.
    const bar = page.getByTestId('compact-touch-bar');
    await expect(bar).toBeVisible();
    await bar.getByRole('button', { name: 'Delete' }).click();
    await expect(stamps).toHaveCount(0);
    await expect(tray(page)).toBeVisible();
    await expect(plate).toHaveCount(1);
    // With one kept the tray is the plates, a hairline and a "+".
    await expect(page.getByTestId('compact-sign-new')).toHaveText('');
  });
});

/** The review screenshots of Sign's tray with no plates and with four (CAPTURE_SCREENSHOTS). */
for (const scheme of ['dark', 'light'] as const) {
  test.describe(`the single capsule: Sign tray captures, ${scheme}`, () => {
    test.use({ colorScheme: scheme });
    test.skip(!SHOTS, 'review screenshots only');

    test('captures', async ({ page }) => {
      test.skip(isLandscape(page), 'portrait');
      await openReader(page);
      await startEditing(page);
      await arm(page, 'sign');
      await shot(page, 'sign-tray-0-plates');
      const cdp = await page.context().newCDPSession(page);
      for (let i = 0; i < 4; i++) {
        await page.getByTestId('compact-sign-new').click();
        const sheet = page.getByTestId('new-signature-sheet');
        await expect(sheet).toBeVisible();
        await motionDone(page);
        const pad = sheet.locator('canvas[data-strokes]');
        await pad.scrollIntoViewIfNeeded();
        const box = await pad.boundingBox();
        if (!box) throw new Error('no pad');
        const at = (t: number) => ({
          x: box.x + box.width * (0.12 + 0.76 * t),
          y: box.y + box.height * (0.55 + Math.sin(t * Math.PI * (2 + i)) * 0.25),
          id: 1,
        });
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [at(0)] });
        for (let k = 1; k <= 30; k++) {
          await cdp.send('Input.dispatchTouchEvent', {
            type: 'touchMove',
            touchPoints: [at(k / 30)],
          });
        }
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
        await sheet.getByRole('button', { name: 'Use signature' }).click();
        await expect(sheet).toBeHidden();
        await motionDone(page);
      }
      await expect(tray(page).locator('[data-saved-signature]')).toHaveCount(4);
      await shot(page, 'sign-tray-4-plates');
    });
  });
}

test.describe('the single capsule: motion', () => {
  test.use({ reducedMotion: 'reduce' });

  test('with reduced motion the morph and the tray settle within 150 ms of motion', async ({
    page,
  }) => {
    await openReader(page);
    await edit(page).click();
    await expect(capsule(page)).toHaveAttribute('data-editing');
    const longest = () =>
      page.evaluate(() =>
        Math.max(
          0,
          ...document
            .getAnimations()
            .filter((a) => Number.isFinite(a.effect?.getComputedTiming().endTime))
            .map((a) => Number(a.effect?.getComputedTiming().endTime ?? 0)),
        ),
      );
    expect(await longest()).toBeLessThanOrEqual(150);
    await motionDone(page);
    await toolButton(page, 'pen').click();
    await expect(tray(page)).toBeVisible();
    expect(await longest()).toBeLessThanOrEqual(150);
    await motionDone(page);
  });
});

test.describe('the single capsule: on its side', () => {
  test('the tray opens beside the capsule and nothing moves when it toggles', async ({ page }) => {
    test.skip(!isLandscape(page), 'a phone on its side');
    await openReader(page);
    await startEditing(page);
    const rested = await capsule(page).boundingBox();
    await arm(page, 'pen');
    const open = await capsule(page).boundingBox();
    const box = await tray(page).boundingBox();
    if (!rested || !open || !box) throw new Error('not laid out');
    expect(Math.abs(open.x - rested.x)).toBeLessThanOrEqual(0.5);
    expect(Math.abs(open.y - rested.y)).toBeLessThanOrEqual(0.5);
    // Side by side: the tray ends before the capsule begins, and both are on screen.
    expect(box.x + box.width).toBeLessThanOrEqual(open.x + 0.5);
    await inViewport(page, capsule(page));
    await inViewport(page, tray(page));
    await shot(page, 'landscape-pen-tray');

    await toolButton(page, 'pen').click();
    await expect(tray(page)).toHaveCount(0);
    await motionDone(page);
    const closed = await capsule(page).boundingBox();
    expect(Math.abs((closed?.x ?? 0) - rested.x)).toBeLessThanOrEqual(0.5);
    expect(Math.abs((closed?.y ?? 0) - rested.y)).toBeLessThanOrEqual(0.5);
  });
});
