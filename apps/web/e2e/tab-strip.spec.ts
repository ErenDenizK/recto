/**
 * The title bar's tabs at every width a full edition meets (XD-3; quality-bar Q-8, Q-9;
 * redesign §8 A-21): with one and with four documents open, in English and Turkish, the active
 * tab is wholly in view and at least its minimum width (01-frame F4 §2: 112 px fine, 128
 * coarse), its name shows at least `MIN_LABEL` px of text, and a name that does not fit ends in
 * an ellipsis with the full name kept as the tab's tooltip and accessible name. Tabs beyond an
 * edge of the scrolling list fade at that edge, never cut to a bare dot. The bar is one of Q-9's
 * heights (44 fine, 56 coarse) and nothing in it is pushed past the window.
 *
 * Runs on `chromium` (fine pointer: 768, 1024, 1180 and 1440 px) and `tablet` (coarse: 768,
 * 820, 1024 and 1180 px).
 */
import { expect, type Page, test } from '@playwright/test';

import { fixturePath, openFixtures, useFileInputPicker } from './helpers';

/** The least visible name a tab may show, CSS px: a few characters, never a bare dot. */
const MIN_LABEL = 40;

const LONG_NAME = {
  en: 'Quarterly supplier agreement with every signed appendix',
  tr: 'Tedarikçi sözleşmesinin tüm imzalı ekleriyle birlikte üç aylık taslağı',
} as const;

interface StripState {
  readonly barHeight: number;
  readonly overflowRight: number;
  readonly tablist: { left: number; right: number; more: boolean; scrolls: boolean } | null;
  readonly tab: {
    left: number;
    right: number;
    width: number;
    title: string;
    name: string;
    nameWidth: number;
    truncated: boolean;
    textOverflow: string;
  } | null;
}

async function measure(page: Page): Promise<StripState> {
  return page.evaluate(() => {
    const bar = document.querySelector<HTMLElement>('[data-bar="title"]');
    if (!bar) throw new Error('no title bar');
    const box = (el: Element) => el.getBoundingClientRect();
    const controls = [...bar.querySelectorAll('button, [role="tab"]')].filter(
      (el) => box(el).width > 0,
    );
    const list = bar.querySelector<HTMLElement>('[role="tablist"]');
    const tab = bar.querySelector<HTMLElement>('[role="tab"][tabindex="0"]');
    // The name is the tab's text span (its other children are glyphs, aria-hidden).
    const name = tab
      ? [...tab.querySelectorAll<HTMLElement>('span')].find(
          (span) => span.getAttribute('aria-hidden') !== 'true' && span.textContent,
        )
      : undefined;
    return {
      barHeight: box(bar).height,
      overflowRight: Math.max(...controls.map((el) => box(el).right)) - window.innerWidth,
      tablist: list
        ? {
            left: box(list).left,
            right: box(list).right,
            scrolls: list.scrollWidth > list.clientWidth + 1,
            more: list.hasAttribute('data-more-start') || list.hasAttribute('data-more-end'),
          }
        : null,
      tab:
        tab && name
          ? {
              left: box(tab).left,
              right: box(tab).right,
              width: box(tab).width,
              title: tab.title,
              name: name.textContent ?? '',
              nameWidth: box(name).width,
              truncated: name.scrollWidth > name.clientWidth + 0.5,
              textOverflow: getComputedStyle(name).textOverflow,
            }
          : null,
    };
  });
}

for (const lang of ['en', 'tr'] as const) {
  test(`${lang}: the active tab keeps its name at every width, with one and four tabs`, async ({
    page,
  }, info) => {
    test.setTimeout(90_000);
    const coarse = info.project.name === 'tablet';
    const widths = coarse ? [768, 820, 1024, 1180] : [768, 1024, 1180, 1440];
    const height = coarse ? 1180 : 900;
    const tabMin = coarse ? 128 : 112;
    const barHeight = coarse ? 56 : 44;

    const check = async (label: string, fullName: string) => {
      for (const width of widths) {
        await page.setViewportSize({ width, height });
        // A frame for the resize observer to reveal the active tab and mark the edges.
        await page.waitForTimeout(200);
        const at = `${label} at ${width} px`;
        const s = await measure(page);
        expect(s.barHeight, `${at}: bar height (Q-9)`).toBe(barHeight);
        expect(s.overflowRight, `${at}: a control past the window`).toBeLessThanOrEqual(0.5);
        expect(s.tablist, at).not.toBeNull();
        expect(s.tab, at).not.toBeNull();
        if (!s.tablist || !s.tab) continue;
        expect(s.tab.left, `${at}: active tab cut at the start`).toBeGreaterThanOrEqual(
          s.tablist.left - 1,
        );
        expect(s.tab.right, `${at}: active tab cut at the end`).toBeLessThanOrEqual(
          s.tablist.right + 1,
        );
        expect(s.tab.width, `${at}: active tab width`).toBeGreaterThanOrEqual(tabMin - 0.5);
        expect(s.tab.nameWidth, `${at}: visible name`).toBeGreaterThanOrEqual(MIN_LABEL);
        if (s.tab.truncated) {
          expect(s.tab.textOverflow, `${at}: a cut name ends in an ellipsis`).toBe('ellipsis');
        }
        // The full name stays the tooltip and the accessible name (Q-8).
        expect(s.tab.title, at).toBe(fullName);
        expect(s.tab.name, at).toBe(fullName);
        // Tabs beyond an edge fade there (use-tablist-edges.ts) instead of being cut bare.
        expect(s.tablist.more, `${at}: an overflowing list marks its edge`).toBe(s.tablist.scrolls);
      }
    };

    await useFileInputPicker(page);
    await page.setViewportSize({ width: widths[widths.length - 1] ?? 1440, height });
    await page.goto(`./?lang=${lang}`);
    await openFixtures(page, ['simple-text.pdf']);
    await check('one tab', 'simple-text');

    // Three more, then the last one active under a long name.
    await page.setViewportSize({ width: widths[widths.length - 1] ?? 1440, height });
    const chooser = page.waitForEvent('filechooser');
    await page
      .getByRole('button', { name: /^(Open files|Dosya aç)$/ })
      .first()
      .click();
    await (await chooser).setFiles(
      ['cropbox.pdf', 'tagged.pdf', 'colour-swatches.pdf'].map(fixturePath),
    );
    const last = page.getByRole('tab', { name: /^colour-swatches/ });
    await expect(last).toBeVisible();
    await last.click();
    await expect(last).toHaveAttribute('tabindex', '0');
    await last.press('F2');
    const editor = page.locator('[data-bar="title"] input');
    await expect(editor).toBeFocused();
    await editor.fill(LONG_NAME[lang]);
    await editor.press('Enter');
    const renamed = page.getByRole('tab', { name: new RegExp(`^${LONG_NAME[lang]}`) });
    await expect(renamed).toHaveAttribute('tabindex', '0');
    await check('four tabs', LONG_NAME[lang]);
  });
}
