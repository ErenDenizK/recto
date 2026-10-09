/**
 * The phone smoke (V1-X6, PLAN §2.5): the read-only compact edition opens the sample, scrolls,
 * zooms and searches at 390 × 844 and 844 × 390 without a page error, a console error or a
 * failed request, and without sideways scroll. It runs in the desktop Chromium project with a
 * Pixel 7 profile applied here (touch, mobile viewport, a screen of the same size, so the
 * edition rule picks the compact edition), so it needs no project of its own. The deeper
 * compact checks (sheets, Contents, passwords, Turkish, toasts) stay in `compact.spec.ts`,
 * which has the `phone` projects.
 */
import { type CDPSession, devices, expect, type Page, test } from '@playwright/test';

import { Job } from './support/job-report';

// `defaultBrowserType` is a worker-level option and cannot be set in a file.
const { defaultBrowserType: _browser, ...pixel } = devices['Pixel 7'];

const SIZES = [
  { name: '390x844', width: 390, height: 844 },
  { name: '844x390', width: 844, height: 390 },
] as const;

for (const size of SIZES) {
  test.describe(`phone ${size.name}`, () => {
    test.beforeEach(({ browserName: _browser }, info) => {
      test.skip(info.project.name !== 'chromium', 'runs once, in the desktop Chromium project');
    });
    const profile = {
      ...pixel,
      viewport: { width: size.width, height: size.height },
      screen: { width: size.width, height: size.height },
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
    };
    test.use(profile);

    test(`V1-X6: opens the sample, scrolls, zooms and searches at ${size.name}`, async ({
      page,
    }, info) => {
      const problems: string[] = [];
      page.on('pageerror', (error) => problems.push(`pageerror: ${error.message}`));
      page.on('console', (message) => {
        if (message.type() === 'error') problems.push(`console: ${message.text()}`);
      });
      page.on('requestfailed', (request) =>
        problems.push(`request failed: ${request.url()} ${request.failure()?.errorText ?? ''}`),
      );
      const job = new Job(`V1-X6-${size.name}`, 'Phone smoke', page, info);

      const pages = page.getByTestId('compact-pages');
      const pageNumber = page.getByTestId('compact-page-number');

      await job.act(
        'open the sample',
        1,
        async (p) => {
          await page.goto('./?lang=en');
          await expect(page.getByTestId('compact-library')).toBeVisible();
          await expect(page.locator('html')).toHaveAttribute('data-edition', 'compact');
          await p.press(page.getByRole('button', { name: 'Try the sample' }));
          await expect(page.getByTestId('compact-reader')).toBeVisible();
          await expect(page.locator('[data-page-index="0"] canvas').first()).toHaveAttribute(
            'data-state',
            'rendered',
            { timeout: 30_000 },
          );
        },
        { gate: true },
      );

      await job.act('scroll to the last page', null, async (p) => {
        const total = Number(((await pageNumber.textContent()) ?? '').split('/')[1]);
        expect(total).toBeGreaterThan(1);
        await p.gesture(async () => {
          await pages.evaluate(async (el) => {
            for (let i = 0; i < 12; i++) {
              el.scrollTop += el.scrollHeight / 12;
              await new Promise((resolve) => requestAnimationFrame(resolve));
            }
          });
        });
        await expect(pageNumber).toHaveText(new RegExp(`^${total} / ${total}$`), {
          timeout: 20_000,
        });
        await pages.evaluate((el) => {
          el.scrollTop = 0;
        });
        await expect(pageNumber).toHaveText(/^1 \//);
      });

      await job.act('double tap zooms to 2× and back', null, async (p) => {
        const box = await pages.boundingBox();
        if (!box) throw new Error('no reader');
        const x = box.x + box.width / 2;
        const y = box.y + box.height / 2;
        const zoom = async () => Number(await pages.getAttribute('data-zoom'));
        expect(await zoom()).toBe(1);
        // Two taps inside the double-tap window, from an idle main thread.
        await page.evaluate(
          () =>
            new Promise<void>((resolve) => requestIdleCallback(() => resolve(), { timeout: 3000 })),
        );
        await p.gesture(async () => {
          await page.touchscreen.tap(x, y);
          await page.touchscreen.tap(x, y);
        });
        await expect.poll(zoom).toBe(2);
        await page.waitForTimeout(400);
        await page.evaluate(
          () =>
            new Promise<void>((resolve) => requestIdleCallback(() => resolve(), { timeout: 3000 })),
        );
        await page.touchscreen.tap(x, y);
        await page.touchscreen.tap(x, y);
        await expect.poll(zoom).toBe(1);
      });

      await job.act('pinch zooms and settles back', null, async (p) => {
        const box = await pages.boundingBox();
        if (!box) throw new Error('no reader');
        const cdp = await page.context().newCDPSession(page);
        const centre = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
        await p.gesture(() => pinch(cdp, centre, 60, 160));
        await expect
          .poll(async () => Number(await pages.getAttribute('data-zoom')))
          .toBeGreaterThan(1);
        await pinch(cdp, centre, 200, 30);
        await expect.poll(async () => Number(await pages.getAttribute('data-zoom'))).toBe(1);
      });

      await job.act('find a word, step through the hits', null, async (p) => {
        // The chrome may be away after the scrolling above: a scroll up brings it back.
        await pages.evaluate((el) => {
          el.scrollTop += 40;
          el.scrollTop -= 80;
        });
        await p.press(page.getByTestId('compact-capsule').getByRole('button', { name: 'Find' }));
        const field = page.getByRole('searchbox', { name: 'Find in document' });
        await expect(field).toBeFocused();
        await p.gesture(() => field.fill('Recto'));
        await expect(page.getByTestId('compact-find-count')).toHaveText(/^1 of \d+$/, {
          timeout: 20_000,
        });
        await expect(page.getByTestId('search-highlights').first()).toBeVisible();
        await p.press(page.getByRole('button', { name: 'Next result' }));
        await expect(page.getByTestId('compact-find-count')).toHaveText(/^2 of \d+$/);
        await p.press(page.getByRole('button', { name: 'Done' }));
        await expect(page.getByTestId('search-highlights')).toHaveCount(0);
      });

      job.finish();
      // A smoke test, not a report: every act completed, nothing broke, nothing scrolls sideways.
      expect(job.blocked()).toEqual([]);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
        size.width,
      );
      await assertNoEditing(page);
      expect(problems).toEqual([]);
    });
  });
}

/** Nothing on the phone edits the file (ADR-0033): no Markup door, no save button. */
async function assertNoEditing(page: Page): Promise<void> {
  await expect(page.getByRole('button', { name: /^(Markup|Fill & sign|Save)$/ })).toHaveCount(0);
}

/** Two-finger pinch by CDP touch events (as in `compact.spec.ts`). */
async function pinch(
  cdp: CDPSession,
  centre: { x: number; y: number },
  from: number,
  to: number,
): Promise<void> {
  const points = (gap: number) => [
    { x: centre.x - gap / 2, y: centre.y, id: 1 },
    { x: centre.x + gap / 2, y: centre.y, id: 2 },
  ];
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: points(from) });
  for (let i = 1; i <= 10; i++) {
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: points(from + ((to - from) * i) / 10),
    });
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}
