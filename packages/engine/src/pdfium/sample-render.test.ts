/**
 * The teaching sample renders fast (MOB-14; docs/design/sample-2026-10/direction-v2.md §5.4):
 * every page of the four files, at 2× (the reader's scale on a retina display at fit width),
 * through the same PDFium wasm the app's worker loads, timed per page. The light (meshes,
 * clipped glows, grain) must not make a page slow: the direction's budget is the cover within
 * 150 ms and every other page within 80 ms on a development machine.
 *
 * The first render of each file is a warm-up (fonts, the grain tile, shadings are parsed once);
 * the time kept is the best of three renders (a busy runner only ever adds time,
 * so the minimum is the render's own cost). The numbers are printed (`--reporter=verbose`
 * shows them). CI machines vary, so by default the test fails only past twice the budget;
 * `VITE_SAMPLE_RENDER_STRICT=1` holds the budget itself.
 */
import { afterAll, beforeAll, describe, expect, test } from 'vitest';

import enUrl from '../../../../apps/web/public/sample/recto-sample-en.pdf?url';
import phoneEnUrl from '../../../../apps/web/public/sample/recto-sample-phone-en.pdf?url';
import phoneTrUrl from '../../../../apps/web/public/sample/recto-sample-phone-tr.pdf?url';
import trUrl from '../../../../apps/web/public/sample/recto-sample-tr.pdf?url';
import { sid } from '../../test/helpers';
import { createHarness, fixture, type Harness } from '../text-edit/test-helpers';

const FILES: Record<string, string> = {
  'recto-sample-en.pdf': enUrl,
  'recto-sample-tr.pdf': trUrl,
  'recto-sample-phone-en.pdf': phoneEnUrl,
  'recto-sample-phone-tr.pdf': phoneTrUrl,
};

/** Milliseconds at 2×: the cover (page 1), any other page. */
const BUDGET = { cover: 150, page: 80 } as const;
const env = (import.meta as { env?: Record<string, string | undefined> }).env;
const SLACK = env?.VITE_SAMPLE_RENDER_STRICT === '1' ? 1 : 2;

let h: Harness;
const report: Record<string, number[]> = {};

beforeAll(async () => {
  h = await createHarness();
});

afterAll(async () => {
  await h.adapter.destroy();
  console.warn(`sample render ms at 2×: ${JSON.stringify(report)}`);
});

const best = (values: number[]) => Math.min(...values);

describe.each(Object.keys(FILES))('%s', (file) => {
  test('every page renders at 2× within its budget', async () => {
    const source = sid(`render-${file}`);
    const { pageCount: count } = await h.adapter.open(source, await fixture(FILES[file] as string));
    try {
      const times: number[] = [];
      for (let page = 0; page < count; page++) {
        (await h.adapter.renderPage(source, page, { scale: 2 })).bitmap.close();
        const runs: number[] = [];
        for (let i = 0; i < 3; i++) {
          const t0 = performance.now();
          const { bitmap } = await h.adapter.renderPage(source, page, { scale: 2 });
          runs.push(performance.now() - t0);
          bitmap.close();
        }
        times.push(Math.round(best(runs)));
      }
      report[file] = times;
      times.forEach((ms, page) => {
        const budget = page === 0 ? BUDGET.cover : BUDGET.page;
        expect(ms, `${file} page ${page + 1}: ${ms} ms (budget ${budget})`).toBeLessThanOrEqual(
          budget * SLACK,
        );
      });
    } finally {
      await h.adapter.close(source);
    }
  }, 120_000);
});
