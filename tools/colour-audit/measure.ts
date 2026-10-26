/**
 * The measurement run: every state × theme × contrast on one viewport class.
 * Usage: node measure.ts <desk|tablet|phone> [stateFilter]
 * Writes data/raw/<vp>.json and annotated shots/<state>__<vp>__<theme>-<contrast>.jpg.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import type { Page } from '@playwright/test';
import { chromium, EXE, BASE, OUT, VIEWPORTS } from './pw.ts';
import { collect, hideInk, overlay, settle, type RawControl, type RawSample } from './collect.ts';
import { analyseControl, analyseSample, limeArea } from './analyse.ts';
import { decodePng, type Img } from './png.ts';
import * as C from './color.ts';

const vp = process.argv[2] as keyof typeof VIEWPORTS;
const FOCUS_ONLY = process.env.FOCUS_ONLY === '1';
const only = process.argv[3] ? new RegExp(process.argv[3]) : null;
const cfg = VIEWPORTS[vp];
const dpr = cfg.deviceScaleFactor;
mkdirSync(`${OUT}/data/raw`, { recursive: true });
mkdirSync(`${OUT}/shots`, { recursive: true });

type Step = (p: Page) => Promise<void>;
const wait = (p: Page, ms: number) => p.waitForTimeout(ms);
const role =
  (r: string, name: RegExp, nth: 'first' | 'last' = 'first'): Step =>
  async (p) => {
    const l = p.getByRole(r as never, { name });
    await (nth === 'first' ? l.first() : l.last()).click({ timeout: 10_000 });
    await wait(p, 600);
  };
const click =
  (sel: string, mods?: ('Control' | 'Shift')[]): Step =>
  async (p) => {
    await p.locator(sel).first().click({ modifiers: mods, timeout: 10_000 });
    await wait(p, 600);
  };
const key =
  (k: string): Step =>
  async (p) => {
    await p.locator('body').press(k);
    await wait(p, 600);
  };
const find: Step = async (p) => {
  const input = p.locator('input[type=search]').first();
  if (await input.isVisible()) await input.click();
  else {
    await p.getByRole('button', { name: /^Find/ }).first().click({ timeout: 10_000 });
    await wait(p, 700);
    await p.locator('input[type=search]').first().click({ timeout: 10_000 });
  }
  await p.keyboard.type('the');
  await p.keyboard.press('Enter');
  await wait(p, 1500);
};
const hover =
  (sel: string): Step =>
  async (p) => {
    await p.locator(sel).first().hover();
  };

interface State {
  id: string;
  url: string;
  steps: Step[];
  focus?: boolean;
}
const S = '?sample&lang=en';
const FULL: State[] = [
  { id: 'library', url: S, steps: [role('button', /^Library$/)], focus: true },
  { id: 'reader', url: S, steps: [], focus: true },
  {
    id: 'markup-tool',
    url: S,
    steps: [key('2'), role('button', /^Yellow highlighter/)],
    focus: true,
  },
  { id: 'fill-sign', url: S, steps: [role('button', /^Fill & sign$/)] },
  { id: 'find-hits', url: S, steps: [find] },
  { id: 'title-menu', url: S, steps: [click('[data-testid=document-menu]')] },
  { id: 'more-menu', url: S, steps: [role('button', /^More$/)] },
  { id: 'settings', url: S, steps: [key('Control+Comma')], focus: true },
  {
    id: 'toast',
    url: S,
    steps: [
      key('3'),
      click('[role=gridcell][data-page-id] >> nth=1', ['Control']),
      key('Delete'),
      async (p) => wait(p, 800),
      hover('[role=group][aria-label^="Deleted page"]'),
    ],
  },
  {
    id: 'grid-selection',
    url: S,
    steps: [
      key('3'),
      click('[role=gridcell][data-page-id] >> nth=1', ['Control']),
      click('[role=gridcell][data-page-id] >> nth=2', ['Control']),
    ],
    focus: true,
  },
  { id: 'sidebar-pages', url: S, steps: [click('[data-testid=sidebar-toggle]')] },
  {
    id: 'sidebar-find',
    url: S,
    steps: [find, click('[data-testid=sidebar-toggle]'), role('tab', /^Find/)],
  },
  {
    id: 'sidebar-review',
    url: S,
    steps: [click('[data-testid=sidebar-toggle]'), role('tab', /^Review/)],
  },
  {
    id: 'dialog-save-copy',
    url: S,
    steps: [role('button', /^More$/), role('menuitem', /^Save a copy/)],
    focus: true,
  },
  { id: 'dialog-signature', url: S, steps: [key('2'), role('button', /^Sign$/)] },
  { id: 'flag-tools', url: S + '&tools=1', steps: [click('[data-dock-item="tools"]')] },
  { id: 'flag-fillbar', url: S + '&fillbar=1', steps: [role('button', /^Fill & sign$/)] },
];

const PHONE: State[] = [
  { id: 'library', url: S, steps: [role('button', /^Library$/)], focus: true },
  { id: 'reader', url: S, steps: [], focus: true },
  { id: 'edit-pen', url: S, steps: [role('button', /^Edit$/), role('button', /^Pen$/)] },
  {
    id: 'tool-drawer',
    url: S,
    steps: [role('button', /^Edit$/), role('button', /^Choose a tool$/)],
  },
  {
    id: 'sign-sheet',
    url: S,
    steps: [
      role('button', /^Edit$/),
      role('button', /^Choose a tool$/),
      role('button', /^Sign$/, 'last'),
    ],
  },
  {
    id: 'find-hits',
    url: S,
    steps: [
      role('button', /^Find$/),
      async (p) => {
        await p.keyboard.type('the');
        await p.keyboard.press('Enter');
        await wait(p, 1500);
      },
    ],
  },
  { id: 'file-menu', url: S, steps: [role('button', /file menu/)] },
  {
    id: 'settings',
    url: S,
    steps: [role('button', /file menu/), role('menuitem', /^Settings/)],
    focus: true,
  },
  { id: 'pages-overview', url: S, steps: [role('button', /^Pages$/)] },
];

const VARIANTS = [
  { theme: 'dark', contrast: 'no-preference' },
  { theme: 'dark', contrast: 'more' },
  { theme: 'light', contrast: 'no-preference' },
  { theme: 'light', contrast: 'more' },
] as const;

async function shot(p: Page): Promise<{ img: Img; buf: Buffer }> {
  const buf = await p.screenshot({ animations: 'allow', caret: 'hide' });
  return { img: decodePng(buf), buf };
}

interface Measured {
  state: string;
  viewport: string;
  edition: string;
  theme: string;
  contrast: string;
  glass: string | null;
  settled: boolean;
  limeArea: { share: number; pixels: number };
  samples: (RawSample & Record<string, unknown>)[];
  controls: (RawControl & Record<string, unknown>)[];
  focus?: unknown[];
  shot: string | null;
}

async function measureVariant(p: Page, st: State, v: (typeof VARIANTS)[number]): Promise<Measured> {
  await p.emulateMedia({ colorScheme: v.theme, contrast: v.contrast });
  await wait(p, 500);
  const settled = await p.evaluate(settle, 6000);
  await wait(p, 300);
  const { samples, controls } = await p.evaluate(collect);
  const A = await shot(p);
  await p.evaluate(hideInk, true);
  await p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  const B = await shot(p);
  await p.evaluate(hideInk, false);
  const meta = await p.evaluate(() => ({
    edition: document.documentElement.dataset.edition ?? '',
    glass: document.documentElement.dataset.glass ?? null,
    theme: document.documentElement.dataset.theme ?? '',
  }));
  const out: Measured = {
    state: st.id,
    viewport: vp,
    edition: meta.edition,
    theme: meta.theme || v.theme,
    contrast: v.contrast,
    glass: meta.glass,
    settled,
    limeArea: limeArea(A.img),
    samples: samples.map((s) => ({ ...s, ...analyseSample(s, A.img, B.img, dpr) })),
    controls: controls.map((c) => ({ ...c, ...analyseControl(c, B.img, dpr) })),
    shot: null,
  };
  // Annotate the failures of this variant.
  const fails = out.samples
    .map((s, i) => ({ s, i }))
    .filter(
      ({ s }) =>
        !s.behind && !s.covered && !s.exempt && (s.passAA === false || s.passAPCABronze === false),
    );
  if (fails.length) {
    const boxes = fails.map(({ s, i }) => ({
      ...(s.box as { x: number; y: number; w: number; h: number }),
      label: `#${i} ${s.wcagMedian}:1 Lc${Math.round(Math.abs(s.apcaMedian as number))}/${s.apcaBronzeRequired}`,
      tone: s.passAA === false ? '#e0103a' : '#d97a00',
    }));
    await p.evaluate(overlay, boxes);
    const name = `${st.id}__${vp}__${v.theme}-${v.contrast === 'more' ? 'more' : 'std'}.jpg`;
    await p.screenshot({ path: `${OUT}/shots/${name}`, type: 'jpeg', quality: 78 });
    await p.evaluate(overlay, []);
    out.shot = name;
  }
  return out;
}

/**
 * Focus rings: up to 8 visible UI controls (not page content), focused in turn after one Tab
 * (so keyboard modality and :focus-visible hold); the ring = pixels that change between the
 * control focused and focus parked on an off-screen sentinel.
 */
async function focusRings(p: Page): Promise<unknown[]> {
  await p.keyboard.press('Tab');
  await wait(p, 200);
  const n = await p.evaluate(() => {
    const modal = [...document.querySelectorAll('[aria-modal="true"], dialog[open]')].find(
      (d) => d.getBoundingClientRect().width > 0,
    );
    const root = (modal ?? document.body) as HTMLElement;
    document.getElementById('audit-sentinel')?.remove();
    const s = document.createElement('button');
    s.id = 'audit-sentinel';
    s.textContent = 's';
    Object.assign(s.style, {
      position: 'fixed',
      left: '-200px',
      top: '-200px',
      width: '20px',
      height: '20px',
    });
    root.appendChild(s);
    const all = [
      ...root.querySelectorAll<HTMLElement>(
        'button,[role=tab],input:not([type=hidden]),[role=menuitem],[role=radio],[role=switch],[role=option],[role=gridcell],a[href],[tabindex="0"]',
      ),
    ].filter((el) => {
      if (el === s || el.closest('[role="region"][aria-label^="Page "]') || el.closest('[inert]'))
        return false;
      const r = el.getBoundingClientRect();
      if (
        r.width < 8 ||
        r.height < 8 ||
        r.left < 0 ||
        r.top < 0 ||
        r.right > innerWidth ||
        r.bottom > innerHeight
      )
        return false;
      const cs = getComputedStyle(el);
      return cs.visibility !== 'hidden' && !(el as HTMLButtonElement).disabled;
    });
    // Spread the picks over the list, at most 8.
    const step = Math.max(1, Math.floor(all.length / 8));
    const picks = all.filter((_, i) => i % step === 0).slice(0, 8);
    (window as unknown as { __picks: HTMLElement[] }).__picks = picks;
    return picks.length;
  });
  const res: unknown[] = [];
  for (let i = 0; i < n; i++) {
    const info = await p.evaluate((i) => {
      const el = (window as unknown as { __picks: HTMLElement[] }).__picks[i];
      el.focus({ preventScroll: true });
      const r = el.getBoundingClientRect();
      return {
        label: (el.getAttribute('aria-label') ?? el.innerText ?? el.tagName).trim().slice(0, 40),
        role: el.getAttribute('role') ?? el.tagName.toLowerCase(),
        box: { x: r.left, y: r.top, w: r.width, h: r.height },
        visible: el.matches(':focus-visible'),
        focused: document.activeElement === el,
      };
    }, i);
    await wait(p, 150);
    await p.evaluate(settle, 1200);
    if (!info.focused) continue;
    const pad = 8;
    const x = Math.max(0, info.box.x - pad);
    const y = Math.max(0, info.box.y - pad);
    const clip = {
      x,
      y,
      width: Math.min(cfg.viewport.width - x, info.box.w + 2 * pad),
      height: Math.min(cfg.viewport.height - y, info.box.h + 2 * pad),
    };
    if (clip.width < 4 || clip.height < 4) continue;
    const on = decodePng(await p.screenshot({ clip, animations: 'disabled' }));
    await p.evaluate(() =>
      document.getElementById('audit-sentinel')?.focus({ preventScroll: true }),
    );
    await wait(p, 150);
    await p.evaluate(settle, 1200);
    const off = decodePng(await p.screenshot({ clip, animations: 'disabled' }));
    // Only the ring zone counts: from 4 px inside the control's edge to 6 px outside it, so a
    // tooltip that opens on focus above or below does not enter the measurement.
    const zx0 = info.box.x - x - 6,
      zy0 = info.box.y - y - 6;
    const zx1 = info.box.x - x + info.box.w + 6,
      zy1 = info.box.y - y + info.box.h + 6;
    const ix0 = info.box.x - x + 4,
      iy0 = info.box.y - y + 4;
    const ix1 = info.box.x - x + info.box.w - 4,
      iy1 = info.box.y - y + info.box.h - 4;
    const crs: number[] = [];
    const light: number[] = [];
    const dark: number[] = [];
    for (let py = 0; py < on.height; py++)
      for (let px = 0; px < on.width; px++) {
        const cx = px / dpr,
          cy = py / dpr;
        if (cx < zx0 || cx > zx1 || cy < zy0 || cy > zy1) continue;
        if (cx > ix0 && cx < ix1 && cy > iy0 && cy < iy1) continue;
        const j = (py * on.width + px) * 4;
        if (j + 2 >= off.data.length) continue;
        const a: C.RGB = [on.data[j], on.data[j + 1], on.data[j + 2]];
        const b: C.RGB = [off.data[j], off.data[j + 1], off.data[j + 2]];
        if (Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]) < 30) continue;
        const cr = C.contrast(a, b);
        crs.push(cr);
        (C.relLum(a) > C.relLum(b) ? light : dark).push(cr);
      }
    const q = (xs: number[], f: number) =>
      xs.length
        ? [...xs].sort((m, w) => m - w)[Math.min(xs.length - 1, Math.floor(xs.length * f))]
        : 0;
    const perimeter = 2 * (info.box.w + info.box.h);
    const strong = crs.filter((v) => v >= 3).length / (dpr * dpr);
    const lightA = light.length / (dpr * dpr);
    const darkA = dark.length / (dpr * dpr);
    // A band counts when it is at least 1 css px thick round the perimeter on average.
    const lightStrong = light.filter((v) => v >= 3).length / (dpr * dpr);
    const darkStrong = dark.filter((v) => v >= 3).length / (dpr * dpr);
    const lightOk = lightStrong >= perimeter;
    const darkOk = darkStrong >= perimeter;
    res.push({
      ...info,
      changedAreaCss: C.round(crs.length / (dpr * dpr), 1),
      perimeterCss: C.round(perimeter, 1),
      areaOverPerimeter: C.round(crs.length / (dpr * dpr) / perimeter, 2),
      medianChangeContrast: C.round(q(crs, 0.5)),
      share3: crs.length ? C.round(crs.filter((v) => v >= 3).length / crs.length, 2) : 0,
      lightBandMedian: C.round(q(light, 0.5)),
      darkBandMedian: C.round(q(dark, 0.5)),
      lightBandArea: C.round(lightA, 1),
      darkBandArea: C.round(darkA, 1),
      lightBandP90: C.round(q(light, 0.9)),
      darkBandP90: C.round(q(dark, 0.9)),
      lightStrongArea: C.round(lightStrong, 1),
      darkStrongArea: C.round(darkStrong, 1),
      pass1411: lightOk || darkOk,
      pass2413: strong >= 2 * perimeter,
    });
  }
  return res;
}

const browser = await chromium.launch({ executablePath: EXE });
const results: Measured[] = [];
const errors: { state: string; error: string }[] = [];
const states = (vp === 'phone' ? PHONE : FULL).filter(
  (s) => (!only || only.test(s.id)) && (!FOCUS_ONLY || s.focus),
);
for (const st of states) {
  const t0 = Date.now();
  const ctx = await browser.newContext({
    ...cfg,
    colorScheme: 'dark',
    locale: 'en-US',
    reducedMotion: 'no-preference',
  });
  const p = await ctx.newPage();
  try {
    await p.goto(BASE + st.url);
    await p
      .locator('canvas[data-state="rendered"]')
      .first()
      .waitFor({ state: 'attached', timeout: 40_000 });
    await wait(p, 1500);
    for (const s of st.steps) await s(p);
    await p.evaluate(settle, 5000);
    const mine: Measured[] = [];
    for (const v of VARIANTS) {
      if (FOCUS_ONLY) {
        mine.push({
          state: st.id,
          viewport: vp,
          edition: '',
          theme: v.theme,
          contrast: v.contrast,
          glass: null,
          settled: true,
          limeArea: { share: 0, pixels: 0 },
          samples: [],
          controls: [],
          shot: null,
        });
        results.push(mine[mine.length - 1]);
        continue;
      }
      const m = await measureVariant(p, st, v);
      mine.push(m);
      results.push(m);
      console.log(
        `${vp} ${st.id} ${v.theme}/${v.contrast}: ${m.samples.length} samples, ${m.controls.length} controls, settled=${m.settled}`,
      );
    }
    if (st.focus)
      for (let i = 0; i < VARIANTS.length; i++) {
        await p.emulateMedia({ colorScheme: VARIANTS[i].theme, contrast: VARIANTS[i].contrast });
        await wait(p, 400);
        await p.evaluate(settle, 4000);
        mine[i].focus = await focusRings(p);
      }
  } catch (e) {
    errors.push({ state: st.id, error: String(e).slice(0, 400) });
    console.log(`ERROR ${vp} ${st.id}: ${String(e).slice(0, 300)}`);
    await p.screenshot({ path: `${OUT}/explore/error-${st.id}-${vp}.png` }).catch(() => {});
  }
  await ctx.close();
  console.log(`  (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
}
await browser.close();
writeFileSync(
  `${OUT}/data/raw/${vp}${FOCUS_ONLY ? '-focus' : only ? '-partial' : ''}.json`,
  JSON.stringify({ viewport: vp, dpr, results, errors }),
);
console.log('done', results.length, 'variants', errors.length, 'errors');
