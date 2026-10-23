/** CI probe (r25/ci-probe-penfade): why the bar does not fade on Firefox. Not for develop. */
import { expect, type Page, test } from '@playwright/test';

import { enterEdit, openFixtures, trackEngine, useFileInputPicker } from './helpers';

const layer = (page: Page) => page.locator('[data-annotation-layer="0"]');

const describe = (el: Element | null): string => {
  if (!el) return 'null';
  const attrs = [...el.attributes].map((a) => `${a.name}="${a.value.slice(0, 40)}"`).join(' ');
  return `<${el.tagName.toLowerCase()} ${attrs}>`;
};

test.use({ viewport: { width: 1440, height: 900 } });

test('probe: the bar fades under a stroke', async ({ page }) => {
  page.on('console', (msg) => console.log(`[page ${msg.type()}] ${msg.text()}`));
  await trackEngine(page);
  await useFileInputPicker(page);
  await page.addInitScript(() => {
    const log = (window as unknown as { __probe: string[] }).__probe = [] as string[];
    const t0 = performance.now();
    const at = () => `${Math.round(performance.now() - t0)}ms`;
    const d = (el: EventTarget | null) => {
      if (!(el instanceof Element)) return String(el);
      const attrs = [...el.attributes].map((a) => `${a.name}="${a.value.slice(0, 40)}"`).join(' ');
      return `<${el.tagName.toLowerCase()} ${attrs}>`;
    };
    for (const type of ['pointerdown', 'pointerup', 'mousedown']) {
      window.addEventListener(
        type,
        (e) => {
          const p = e as PointerEvent;
          const target = p.target instanceof Element ? p.target : null;
          log.push(
            `${at()} ${type} id=${p.pointerId} type=${p.pointerType} button=${p.button} buttons=${p.buttons} target=${d(target)} inPage=${target?.closest('[data-read-viewport] [data-page-id]') !== null && target !== null}`,
          );
        },
        { capture: true },
      );
    }
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('controllerchange', () => log.push(`${at()} controllerchange`));
    }
    new MutationObserver((records) => {
      for (const r of records) {
        if (r.target instanceof Element && r.target.matches('[data-capsule="palette"]'))
          log.push(`${at()} palette attr ${r.attributeName}=${r.target.getAttribute(r.attributeName ?? '')}`);
      }
    }).observe(document, { subtree: true, attributes: true, attributeFilter: ['data-stroking'] });
  });
  await page.goto('./');
  await openFixtures(page, ['simple-text.pdf']);
  await enterEdit(page);
  await expect(page.locator('canvas[data-state="rendered"]').first()).toBeAttached({
    timeout: 20_000,
  });
  await page.locator('body').press('p');
  await expect(layer(page)).toHaveAttribute('data-tool', 'ink');
  const bar = page.locator('[data-capsule="palette"]');
  const page1 = await layer(page).boundingBox();
  const barBox = await bar.boundingBox();
  if (!page1 || !barBox) throw new Error('not laid out');
  const y = barBox.y + barBox.height / 2;
  const from = Math.max(page1.x + 8, barBox.x - 60);
  console.log('page1', JSON.stringify(page1), 'bar', JSON.stringify(barBox), 'from', from, 'y', y);
  console.log(
    'before',
    await page.evaluate(
      ([x, yy, src]) => {
        const describe = new Function(`return ${src}`)() as (e: Element | null) => string;
        return JSON.stringify({
          hit: describe(document.elementFromPoint(x, yy)),
          stack: document.elementsFromPoint(x, yy).slice(0, 6).map(describe),
          sw: 'serviceWorker' in navigator ? navigator.serviceWorker.controller !== null : 'none',
        });
      },
      [from, y, describe.toString()] as const,
    ),
  );
  await page.mouse.move(from, y);
  await page.mouse.down();
  const ok = await expect(bar)
    .toHaveCSS('opacity', '0.2', { timeout: 3000 })
    .then(() => true)
    .catch(() => false);
  await page.mouse.up();
  const probe = await page.evaluate(() => (window as unknown as { __probe: string[] }).__probe);
  console.log(`faded=${ok}\n${probe.join('\n')}`);
  console.log(
    'bar now',
    await bar.evaluate((el) => `${el.outerHTML.slice(0, 200)} opacity=${getComputedStyle(el).opacity}`),
  );
  expect(ok).toBe(true);
});
