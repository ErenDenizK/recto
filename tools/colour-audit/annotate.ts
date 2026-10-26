/** Annotated shots for the non-text failures of A-findings §4 (boxes drawn by a canvas overlay). */
import type { Page } from '@playwright/test';
import { chromium, EXE, BASE, OUT, VIEWPORTS } from './pw.ts';
import { overlay, settle } from './collect.ts';

type Vp = keyof typeof VIEWPORTS;
const w = (p: Page, ms: number) => p.waitForTimeout(ms);
const role = async (p: Page, r: string, n: RegExp, last = false) => {
  const l = p.getByRole(r as never, { name: n });
  await (last ? l.last() : l.first()).click();
  await w(p, 700);
};
const jobs: {
  name: string;
  vp: Vp;
  theme: 'dark' | 'light';
  more?: boolean;
  steps: (p: Page) => Promise<void>;
  sel: string;
  label: string;
}[] = [
  {
    name: '07-segments',
    vp: 'desk',
    theme: 'light',
    steps: async (p) => {
      await p.locator('body').press('Control+Comma');
      await w(p, 900);
    },
    sel: '[role=radiogroup] [role=radio]',
    label: 'segment 1.13:1',
  },
  {
    name: '08-grid-rings',
    vp: 'desk',
    theme: 'light',
    steps: async (p) => {
      await p.locator('body').press('3');
      await w(p, 900);
      await p
        .locator('[role=gridcell][data-page-id]')
        .nth(1)
        .click({ modifiers: ['Control'] });
      await p
        .locator('[role=gridcell][data-page-id]')
        .nth(2)
        .click({ modifiers: ['Control'] });
      await w(p, 600);
    },
    sel: '[role=gridcell][data-page-id]',
    label: 'ring',
  },
  {
    name: '09-active-tab',
    vp: 'desk',
    theme: 'dark',
    more: true,
    steps: async () => {},
    sel: '[data-testid=document-menu]',
    label: 'tab 1.11:1',
  },
  {
    name: '10-hide-sidebar',
    vp: 'desk',
    theme: 'dark',
    steps: async (p) => {
      await p.locator('[data-testid=sidebar-toggle]').click();
      await w(p, 900);
    },
    sel: '[aria-label="Hide sidebar"], [role=option][aria-selected=true]',
    label: '1.06:1',
  },
  {
    name: '11-phone-tool-chip',
    vp: 'phone',
    theme: 'dark',
    steps: async (p) => {
      await role(p, 'button', /^Edit$/);
      await role(p, 'button', /^Pen$/);
    },
    sel: '[data-testid=compact-tool-chip]',
    label: 'armed 1.10:1',
  },
  {
    name: '12-find-current-row',
    vp: 'desk',
    theme: 'light',
    steps: async (p) => {
      await p.locator('input[type=search]').first().click();
      await p.keyboard.type('the');
      await p.keyboard.press('Enter');
      await w(p, 1500);
      await p.locator('[data-testid=sidebar-toggle]').click();
      await role(p, 'tab', /^Find/);
    },
    sel: '[data-hit-index="0"]',
    label: 'current 1.15:1',
  },
  {
    name: '13-14-phone-find-field',
    vp: 'phone',
    theme: 'light',
    steps: async (p) => {
      await role(p, 'button', /^Find$/);
      await p.keyboard.type('the');
      await p.keyboard.press('Enter');
      await w(p, 1500);
    },
    sel: 'input[aria-label="Find in document"]',
    label: 'edge 1.00:1',
  },
  {
    name: '15-review-chips',
    vp: 'desk',
    theme: 'light',
    steps: async (p) => {
      await p.locator('[data-testid=sidebar-toggle]').click();
      await role(p, 'tab', /^Review/);
    },
    sel: 'button[data-value]',
    label: 'chip 1.13:1',
  },
  {
    name: '39-disabled-redo',
    vp: 'desk',
    theme: 'light',
    more: true,
    steps: async () => {},
    sel: '[aria-label="Redo"]',
    label: 'disabled 2.27:1',
  },
  {
    name: '40-light-rims',
    vp: 'desk',
    theme: 'light',
    steps: async () => {},
    sel: '.mat-chip, .mat-bar',
    label: 'rim 1.2:1',
  },
];
const b = await chromium.launch({ executablePath: EXE });
for (const j of jobs) {
  const ctx = await b.newContext({
    ...VIEWPORTS[j.vp],
    colorScheme: j.theme,
    contrast: j.more ? 'more' : 'no-preference',
    locale: 'en-US',
  });
  const p = await ctx.newPage();
  try {
    await p.goto(BASE + '?sample&lang=en');
    await p
      .locator('canvas[data-state="rendered"]')
      .first()
      .waitFor({ state: 'attached', timeout: 40000 });
    await w(p, 1500);
    await j.steps(p);
    await p.evaluate(settle, 4000);
    const boxes = await p.evaluate(
      ([sel, label]) =>
        [...document.querySelectorAll(sel)]
          .map((e) => e.getBoundingClientRect())
          .filter((r) => r.width > 4 && r.bottom > 0 && r.top < innerHeight)
          .slice(0, 12)
          .map((r) => ({ x: r.left, y: r.top, w: r.width, h: r.height, label, tone: '#e0103a' })),
      [j.sel, j.label] as const,
    );
    await p.evaluate(overlay, boxes);
    await p.screenshot({
      path: `${OUT}/shots/nontext-${j.name}__${j.vp}__${j.theme}${j.more ? '-more' : '-std'}.jpg`,
      type: 'jpeg',
      quality: 80,
    });
    console.log(j.name, boxes.length);
  } catch (e) {
    console.log('ERR', j.name, String(e).slice(0, 150));
  }
  await ctx.close();
}
await b.close();
