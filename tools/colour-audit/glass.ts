/**
 * Glass variability: the top strip, the capsule (dock) and the More menu over six backdrops
 * (the reader zoomed in so pages pass under every piece, scrolled to six positions), in dark and
 * light, standard contrast, desk 1440 × 900. Writes data/glass-variability.json and one shot per
 * position.
 */
import { writeFileSync } from 'node:fs';
import type { Page } from '@playwright/test';
import { chromium, EXE, BASE, OUT, VIEWPORTS } from './pw.ts';
import { collect, hideInk, settle } from './collect.ts';
import { analyseSample } from './analyse.ts';
import { decodePng } from './png.ts';
import * as C from './color.ts';

const cfg = VIEWPORTS.desk;
const browser = await chromium.launch({ executablePath: EXE });
const out: unknown[] = [];

async function measure(
  p: Page,
  filter: (s: {
    box: { x: number; y: number; w: number; h: number };
    role: string;
    path: string;
  }) => string | null,
) {
  await p.evaluate(settle, 4000);
  const { samples } = await p.evaluate(collect);
  const A = decodePng(await p.screenshot());
  await p.evaluate(hideInk, true);
  await p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  const B = decodePng(await p.screenshot());
  await p.evaluate(hideInk, false);
  const rows: Record<string, unknown>[] = [];
  for (const s of samples) {
    if (s.behind || s.covered || (s.kind === 'icon' && !s.color)) continue;
    const piece = filter(s);
    if (!piece) continue;
    const m = analyseSample(s, A, B, 1);
    if (m.wcagMedian === null) continue;
    rows.push({
      piece,
      kind: s.kind,
      text: s.text,
      fontSize: s.fontSize,
      fg: m.fg,
      bgMedian: m.bgMedian,
      bgBright: m.bgBright,
      bgP10Dark: m.bgP10Dark,
      wcagMedian: m.wcagMedian,
      wcagWorst: m.wcagWorst,
      apcaMedian: m.apcaMedian,
      disabled: s.disabled,
    });
  }
  return rows;
}

for (const theme of ['dark', 'light'] as const) {
  const ctx = await browser.newContext({ ...cfg, colorScheme: theme, locale: 'en-US' });
  const p = await ctx.newPage();
  await p.goto(BASE + '?sample&lang=en');
  await p
    .locator('canvas[data-state="rendered"]')
    .first()
    .waitFor({ state: 'attached', timeout: 40_000 });
  await p.waitForTimeout(1500);
  for (let i = 0; i < 4; i++) {
    await p.locator('body').press('Control+Equal');
    await p.waitForTimeout(400);
  }
  await p.waitForTimeout(1500);
  const pill = await p
    .locator('[data-testid=page-pill]')
    .innerText()
    .catch(() => '?');
  const scroller = await p.evaluate(() => {
    const all = [...document.querySelectorAll<HTMLElement>('*')].filter(
      (e) =>
        e.scrollHeight > e.clientHeight + 200 &&
        /(auto|scroll)/.test(getComputedStyle(e).overflowY),
    );
    all.sort((a, b) => b.scrollHeight - a.scrollHeight);
    const s = all[0];
    if (!s) return null;
    s.setAttribute('data-audit-scroller', '');
    return { h: s.scrollHeight, c: s.clientHeight };
  });
  if (!scroller) throw new Error('no scroller');
  // Six positions over the first three pages: the cover's dark top, its beam, the cover's foot
  // over page 2's top, page 2 (white), the gap, page 3.
  const page = scroller.h / 8;
  const positions = [0, 0.3, 0.75, 1.05, 1.45, 2.1].map((f) => Math.round(f * page));
  for (const [i, top] of positions.entries()) {
    await p.evaluate((t) => {
      const s = document.querySelector<HTMLElement>('[data-audit-scroller]')!;
      s.scrollTop = t;
    }, top);
    await p.waitForTimeout(900);
    const vh = cfg.viewport.height;
    const rows = await measure(p, (s) => {
      if (s.box.y < 60) return 'top strip';
      if (s.box.y > vh - 64 && s.box.x > 300 && s.box.x + s.box.w < 1140) return 'capsule';
      if (s.box.y > vh - 64 && s.box.x > 1200) return 'page pill';
      return null;
    });
    await p.screenshot({
      path: `${OUT}/shots/glass-${theme}-pos${i}.jpg`,
      type: 'jpeg',
      quality: 75,
    });
    // The menu: open More over this backdrop, measure its rows, close.
    let menuRows: Record<string, unknown>[] = [];
    try {
      await p
        .getByRole('button', { name: /^More$/ })
        .first()
        .click({ timeout: 5000 });
      await p.waitForTimeout(700);
      const box = await p.getByRole('menu', { name: 'More' }).boundingBox();
      if (box)
        menuRows = await measure(p, (s) =>
          s.box.x >= box.x &&
          s.box.x + s.box.w <= box.x + box.width + 1 &&
          s.box.y >= box.y &&
          s.box.y + s.box.h <= box.y + box.height + 1
            ? 'menu'
            : null,
        );
      await p.screenshot({
        path: `${OUT}/shots/glass-${theme}-pos${i}-menu.jpg`,
        type: 'jpeg',
        quality: 75,
      });
      await p.keyboard.press('Escape');
      await p.waitForTimeout(500);
    } catch (e) {
      console.log('menu failed', String(e).slice(0, 120));
    }
    const all = [...rows, ...menuRows];
    out.push({ theme, position: i, scrollTop: top, pill, rows: all });
    const summary = ['top strip', 'capsule', 'page pill', 'menu'].map((pc) => {
      const r = all.filter((x) => x.piece === pc && !x.disabled);
      const crs = r.map((x) => x.wcagMedian as number);
      return `${pc}: n=${r.length} min=${crs.length ? Math.min(...crs) : '-'} max=${crs.length ? Math.max(...crs) : '-'}`;
    });
    console.log(theme, i, top, pill, summary.join(' | '));
  }
  await ctx.close();
}
await browser.close();
writeFileSync(`${OUT}/data/glass-variability.json`, JSON.stringify(out, null, 1));
void C;
