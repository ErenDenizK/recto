/**
 * The pen well (`03-markup` MK-6) and its preset editor (`10-ink` §6, MK-8): three pens and the
 * Highlighter as toolbar buttons with `aria-pressed`, a press arms (nothing opens), a press on
 * the armed one or ↑ opens the editor, the editor's swatches, width and opacity and "Reset to
 * default", and the dot rings. Vitest browser mode.
 */
import '../../styles/tokens.css';
import '../../styles/reset.css';
import '../../styles/global.css';

import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { userEvent } from 'vitest/browser';

import { settled } from '../../../test/settled';
import { setLocale } from '../../i18n';
import { useAnnouncer } from '../../shell/announcer';
import { swatchName } from '../../ui/Swatch';
import {
  noteRecentColour,
  RECENT_COLOURS_KEY,
  reloadColourLists,
} from '../../ui/colour/saved-colours';
import { resetToolStore, useToolStore } from '../../viewer/tool-store';
import {
  resetAnnotationStore,
  TOOL_STYLES_STORAGE_KEY,
  useAnnotationStore,
} from '../annotation-store';
import { INK, INKS, TINT, TINTS } from '../palette';
import { penSession, resetPenSession } from './ink-input';
import { PenWell } from './PenWell';
import {
  contrastRatio,
  DEFAULT_PRESETS,
  DOT_CONTRAST_MIN,
  HIGHLIGHTER_SWATCHES,
  needsDotRing,
  overRgb,
  PEN_PRESETS_STORAGE_KEY,
  PEN_SWATCHES,
  type PenPreset,
  type Rgb,
} from './presets';

const store = () => useAnnotationStore.getState();

function Harness() {
  return (
    <div role="toolbar" aria-label="Tools">
      <PenWell cells={[0, 1, 2, 3]} />
      <button type="button">Eraser</button>
    </div>
  );
}

const presets = () => screen.getByRole('toolbar', { name: 'Tools' });
const cells = () => Array.from(presets().querySelectorAll<HTMLElement>('[data-pen-preset]'));
const dot = (name: string | RegExp) => within(presets()).getByRole('button', { name });
const frame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

describe('pen well', () => {
  beforeEach(() => {
    localStorage.removeItem(TOOL_STYLES_STORAGE_KEY);
    localStorage.removeItem(PEN_PRESETS_STORAGE_KEY);
    localStorage.removeItem(RECENT_COLOURS_KEY);
    reloadColourLists();
    resetAnnotationStore();
    resetToolStore();
    resetPenSession();
  });
  afterEach(() => {
    cleanup();
    setLocale('en');
    localStorage.removeItem(RECENT_COLOURS_KEY);
    reloadColourLists();
    localStorage.removeItem(TOOL_STYLES_STORAGE_KEY);
    localStorage.removeItem(PEN_PRESETS_STORAGE_KEY);
    resetAnnotationStore();
    resetToolStore();
    resetPenSession();
  });

  it('shows four ink dots of their real colour, sized by width, the highlighter a chisel tip', () => {
    render(<Harness />);
    expect(cells().map((r) => r.getAttribute('aria-label'))).toEqual([
      'Black pen, 1.5 pt',
      'Blue pen, 1.5 pt',
      'Red pen, 2 pt',
      'Yellow highlighter, 12 pt',
    ]);
    const marks = cells().map((r) => r.querySelector<HTMLElement>('span') as HTMLElement);
    expect(marks.map((mark) => getComputedStyle(mark).backgroundColor)).toEqual([
      'rgb(26, 26, 26)',
      'rgb(23, 96, 238)',
      'rgb(219, 28, 34)',
      // The Highlighter: its tint at full opacity (craft spec §5.4).
      'rgb(255, 234, 0)',
    ]);
    expect(marks.slice(0, 3).map((mark) => Math.round(mark.offsetHeight))).toEqual([13, 13, 13]);
    // The Highlighter: an 8 × 14 px chisel tip, slanted 45° (owner feedback G8).
    expect([marks[3]?.offsetWidth, marks[3]?.offsetHeight]).toEqual([8, 14]);
    expect(marks[3]?.dataset.shape).toBe('chisel');
    // Toolbar buttons with aria-pressed (one arrow path for the palette); nothing armed yet.
    expect(cells().map((c) => c.getAttribute('aria-pressed'))).toEqual([
      'false',
      'false',
      'false',
      'false',
    ]);
    // Each is one --bar-button target (32 px fine; Q-9).
    expect(cells().map((c) => Math.round(c.getBoundingClientRect().height))).toEqual([
      32, 32, 32, 32,
    ]);
  });

  it('a press arms the preset and opens nothing; a press on the armed one opens its editor', async () => {
    render(<Harness />);
    await userEvent.click(dot('Blue pen, 1.5 pt'));
    expect(useToolStore.getState().mode).toBe('ink');
    expect(store().pen.active).toBe(1);
    expect(store().styles.ink.color).toBe(INK.blue);
    expect(useAnnouncer.getState().message).toBe('Blue pen, 1.5 pt');
    expect(dot('Blue pen, 1.5 pt')).toHaveAttribute('aria-pressed', 'true');
    await frame();
    await frame();
    expect(screen.queryByRole('dialog')).toBeNull();

    await userEvent.click(dot('Blue pen, 1.5 pt'));
    // The editor fades in: ask once its entrance has run (a slow runner is still at frame one).
    const editor = await settled(await screen.findByRole('dialog', { name: 'Edit blue pen' }));
    expect(editor).toBeVisible();
    expect(useToolStore.getState().editorOpen).toBe(true);
    // A press on the open preset's cell closes it again.
    await userEvent.click(dot('Blue pen, 1.5 pt'));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(useToolStore.getState().mode).toBe('ink');
    // Arming another tool closes the editor too.
    await userEvent.click(dot('Blue pen, 1.5 pt'));
    await screen.findByRole('dialog', { name: 'Edit blue pen' });
    act(() => useToolStore.getState().setMode('eraser'));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('the editor changes that preset: swatch, width stop, sliders, reset; Esc keeps the pen', async () => {
    render(<Harness />);
    await userEvent.click(dot(/^Blue pen/));
    await userEvent.click(dot(/^Blue pen/));
    const editor = await screen.findByRole('dialog', { name: 'Edit blue pen' });

    await userEvent.click(within(editor).getByRole('radio', { name: 'Green' }));
    expect(store().pen.presets[1].color).toBe(INK.green);
    expect(store().styles.ink.color).toBe(INK.green);
    const named = await screen.findByRole('dialog', { name: 'Edit green pen' });

    // The width is the log slider: its detents are the old stops (1.5 → 2 → 3 → 5).
    const width = within(named).getByRole('slider', { name: 'Width' });
    width.focus();
    await userEvent.keyboard('{ArrowRight}{ArrowRight}{ArrowRight}');
    expect(store().pen.presets[1].width).toBe(5);
    expect(width).toHaveAttribute('aria-valuetext', '5 points');
    await userEvent.keyboard('{End}');
    expect(store().pen.presets[1].width).toBe(24);
    expect(width).toHaveAttribute('aria-valuetext', '24 points');
    // Opacity in steps of 5 %: from 100 % down eight steps.
    within(named).getByRole('slider', { name: 'Opacity' }).focus();
    await userEvent.keyboard('{ArrowLeft>8/}');
    expect(store().pen.presets[1].opacity).toBe(0.6);
    expect(store().styles.ink).toMatchObject({ strokeWidth: 24, opacity: 0.6 });
    // Persisted per device.
    expect(JSON.parse(localStorage.getItem(PEN_PRESETS_STORAGE_KEY) ?? '{}')).toMatchObject({
      active: 1,
      presets: [
        DEFAULT_PRESETS[0],
        { color: INK.green, width: 24, opacity: 0.6 },
        DEFAULT_PRESETS[2],
        DEFAULT_PRESETS[3],
      ],
    });

    await userEvent.click(within(named).getByRole('button', { name: 'Reset to default' }));
    expect(store().pen.presets[1]).toEqual(DEFAULT_PRESETS[1]);
    expect(useAnnouncer.getState().message).toBe('Blue pen reset to default');

    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(useToolStore.getState().mode).toBe('ink');
    await waitFor(() => expect(dot(/^Blue pen/)).toHaveFocus());
  });

  it('the editor offers six swatches: five writing inks and one more; the tints and grey', async () => {
    render(<Harness />);
    const swatchNames = (editor: HTMLElement) =>
      within(within(editor).getByRole('radiogroup', { name: 'Colour' }))
        .getAllByRole('radio')
        .map((r) => r.getAttribute('aria-label'));

    await userEvent.click(dot(/^Black pen/));
    await userEvent.click(dot(/^Black pen/));
    const pen = await screen.findByRole('dialog', { name: 'Edit black pen' });
    // 10-ink §2.1: black, blue, red, green, purple, then orange while there is no custom colour.
    expect(swatchNames(pen)).toEqual(INKS.slice(0, 6).map((ink) => ink.name()));
    // The default colour is its swatch, never "custom".
    expect(within(pen).getByRole('radio', { name: 'Black' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());

    await userEvent.click(dot(/^Yellow highlighter/));
    await userEvent.click(dot(/^Yellow highlighter/));
    const highlighter = await screen.findByRole('dialog', { name: 'Edit yellow highlighter' });
    expect(swatchNames(highlighter)).toEqual([...TINTS.map((tint) => tint.name()), 'Grey']);
    expect(within(highlighter).getByRole('radio', { name: 'Yellow' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    await userEvent.click(within(highlighter).getByRole('radio', { name: 'Pink' }));
    expect(store().pen.presets[3]).toEqual({ ...DEFAULT_PRESETS[3], color: TINT.pink });
    const pink = await settled(
      await screen.findByRole('dialog', { name: 'Edit pink highlighter' }),
    );
    expect(pink).toBeVisible();
    // The Highlighter (craft spec §5.4): widths 6–18 pt, no opacity (always opaque).
    const width = within(pink).getByRole('slider', { name: 'Width' });
    expect(width).toHaveAttribute('aria-valuetext', '12 points');
    // Its detents are the old stops, 6 · 8 · 10 · 12 · 15 · 18, and its ends 6 and 18 pt.
    width.focus();
    await userEvent.keyboard('{ArrowRight}');
    expect(width).toHaveAttribute('aria-valuetext', '15 points');
    await userEvent.keyboard('{End}');
    expect(store().pen.presets[3].width).toBe(18);
    await userEvent.keyboard('{Home}');
    expect(store().pen.presets[3].width).toBe(6);
    expect(within(pink).queryByRole('slider', { name: 'Opacity' })).toBeNull();
  });
  it('keyboard: ↑ opens the focused preset editor, arming it; Esc closes only the editor', async () => {
    render(<Harness />);
    dot(/^Red pen/).focus();
    await userEvent.keyboard('{ArrowUp}');
    expect(useToolStore.getState().mode).toBe('ink');
    expect(store().pen.active).toBe(2);
    expect(
      await settled(await screen.findByRole('dialog', { name: 'Edit red pen' })),
    ).toBeVisible();
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(useToolStore.getState().mode).toBe('ink');
    await waitFor(() => expect(dot(/^Red pen/)).toHaveFocus());
    // Enter on the armed cell is a press: its editor.
    await userEvent.keyboard('{Enter}');
    expect(
      await settled(await screen.findByRole('dialog', { name: 'Edit red pen' })),
    ).toBeVisible();
  });

  it('dark dots get a light inner ring, 3:1 or more on the bar over a page and the canvas', () => {
    render(<Harness />);
    // The bar's fill from the tokens: the glass tint over the backdrop (the page or the
    // canvas) at the filter's brightness (saturation leaves these greys alone).
    const root = getComputedStyle(document.documentElement);
    const token = (name: string) => root.getPropertyValue(name).trim();
    const rgb = (value: string): Rgb => {
      if (value.startsWith('#')) {
        const n = Number.parseInt(value.slice(1), 16);
        return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
      }
      const [r = 0, g = 0, b = 0] = (value.match(/[\d.]+/g) ?? []).map(Number);
      return [r, g, b];
    };
    const glass = token('--glass-bar-tint');
    const tintAlpha = Number(/\/\s*([\d.]+)/.exec(glass)?.[1]);
    const brightness = Number(/brightness\(([\d.]+)\)/.exec(token('--glass-bar-filter'))?.[1]);
    expect(tintAlpha).toBeGreaterThan(0);
    expect(brightness).toBeGreaterThan(0);
    const fill = (backdrop: string): Rgb => {
      const dimmed = rgb(token(backdrop)).map((c) => c * brightness) as unknown as Rgb;
      return overRgb(rgb(glass), tintAlpha, dimmed);
    };
    const fills = { page: fill('--page-background'), canvas: fill('--surface-0') };
    const ring = rgb(token('--glass-text-secondary'));

    const inks: PenPreset[] = [
      ...DEFAULT_PRESETS,
      ...PEN_SWATCHES.map((swatch) => ({ color: swatch.color, width: 1.5, opacity: 1 })),
      ...HIGHLIGHTER_SWATCHES.map((swatch) => ({ color: swatch.color, width: 12, opacity: 0.4 })),
      ...HIGHLIGHTER_SWATCHES.map((swatch) => ({ color: swatch.color, width: 12, opacity: 1 })),
    ];
    for (const ink of inks) {
      for (const [where, under] of Object.entries(fills)) {
        const edge = needsDotRing(ink) ? ring : overRgb(rgb(ink.color), ink.opacity, under);
        expect(
          contrastRatio(edge, under),
          `${ink.color} at ${ink.opacity} over the bar on the ${where}`,
        ).toBeGreaterThanOrEqual(DOT_CONTRAST_MIN);
      }
    }
    // Black, blue and red have the ring; so does every ink of the palette. The opaque
    // Highlighter tint does not need it.
    expect(
      PEN_SWATCHES.filter((s) => !needsDotRing({ color: s.color, width: 1.5, opacity: 1 })),
    ).toEqual([]);
    expect(DEFAULT_PRESETS.map((p) => needsDotRing(p))).toEqual([true, true, true, false]);
    const marks = cells().map((r) => r.querySelector<HTMLElement>('span') as HTMLElement);
    expect(marks[3]).not.toHaveAttribute('data-ring');
    for (const mark of marks.slice(0, 3)) {
      expect(mark).toHaveAttribute('data-ring');
      expect(getComputedStyle(mark).boxShadow).toContain('inset');
    }
    expect(needsDotRing({ color: TINT.yellow, width: 1.5, opacity: 1 })).toBe(false);
  });

  it('the armed preset says "Esc: Select"; the editor repeats the pressure note', async () => {
    render(<Harness />);
    act(() => useToolStore.getState().setMode('ink'));
    const black = dot('Black pen, 1.5 pt');
    await userEvent.hover(black);
    await waitFor(
      () =>
        expect(
          screen.getByText('Black pen, 1.5 pt armed · Esc: Select · Press again for choices'),
        ).toBeVisible(),
      { timeout: 3000 },
    );
    penSession().pressureSeen = true;
    window.dispatchEvent(new PointerEvent('pointerup'));
    await userEvent.click(black);
    const editor = await screen.findByTestId('pen-preset-editor');
    expect(within(editor).getByTestId('pen-editor-width-note').textContent).toMatch(
      /Viewers that redraw ink themselves show it at one width/,
    );
  });

  it('the preset ring shows only while the pen is armed, not with another Draw tool', async () => {
    render(<Harness />);
    const ringOpacity = (el: HTMLElement) => getComputedStyle(el, '::before').opacity;
    act(() => useToolStore.getState().setMode('ink'));
    const armed = dot('Black pen, 1.5 pt');
    expect(armed).toHaveAttribute('aria-pressed', 'true');
    for (const mode of ['eraser', 'lasso', 'rectangle', 'arrow'] as const) {
      act(() => useToolStore.getState().setMode(mode));
      expect(
        cells().filter((r) => r.getAttribute('aria-pressed') === 'true'),
        mode,
      ).toEqual([]);
      // The ring fades out on --duration-fast.
      for (const cell of cells()) await waitFor(() => expect(ringOpacity(cell), mode).toBe('0'));
    }
  });

  it("the sixth swatch is the preset's own colour, else the last custom colour, else orange", async () => {
    render(<Harness />);
    const swatchColours = () =>
      within(screen.getByRole('radiogroup', { name: 'Colour' }))
        .getAllByRole('radio')
        .map((r) => r.getAttribute('aria-label'));
    // An accent ink of the palette: it stays a choice, checked.
    act(() => store().editPreset(1, { color: INK.pink }));
    await userEvent.click(dot(/^Pink pen/));
    await userEvent.click(dot(/^Pink pen/));
    const pink = await screen.findByRole('dialog', { name: 'Edit pink pen' });
    expect(swatchColours()).toEqual([...INKS.slice(0, 5).map((ink) => ink.name()), 'Pink']);
    expect(within(pink).getByRole('radio', { name: 'Pink' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    // A writing ink again: the last custom colour used takes the sixth place.
    act(() => noteRecentColour('#2A9D8F'));
    await userEvent.click(within(pink).getByRole('radio', { name: 'Blue' }));
    await screen.findByRole('dialog', { name: 'Edit blue pen' });
    expect(swatchColours()).toEqual([
      ...INKS.slice(0, 5).map((ink) => ink.name()),
      swatchName('#2A9D8F'),
    ]);
  });

  it('the well pushes the colour views in place: one dialog, Back keeps, Esc reverts', async () => {
    render(<Harness />);
    await userEvent.click(dot(/^Black pen/));
    await userEvent.click(dot(/^Black pen/));
    const editor = await settled(await screen.findByRole('dialog', { name: 'Edit black pen' }));
    // The stroke preview is on the preset page (10-ink §6).
    expect(within(editor).getByRole('img', { name: 'Stroke preview' })).toBeVisible();
    // Reset has nothing to do while the preset is its default.
    expect(within(editor).getByRole('button', { name: 'Reset to default' })).toHaveAttribute(
      'aria-disabled',
      'true',
    );

    await userEvent.click(within(editor).getByRole('button', { name: 'More colours' }));
    const colour = await within(editor).findByRole('group', { name: 'Colour' });
    // In place: still one dialog, the same element, its preset page hidden.
    expect(screen.getAllByRole('dialog')).toEqual([editor]);
    expect(within(editor).queryByRole('slider', { name: 'Width' })).toBeNull();
    await waitFor(() => expect(within(colour).getByRole('button', { name: 'Back' })).toHaveFocus());

    // A grid choice applies live; Back keeps it and returns focus to the well.
    await userEvent.click(within(colour).getByRole('radio', { name: 'Grid' }));
    const grid = within(colour).getByRole('radiogroup', { name: 'Colour grid' });
    await userEvent.click(within(grid).getAllByRole('radio')[40]!);
    const picked = store().pen.presets[0].color;
    expect(picked).not.toBe(INK.black);
    await userEvent.click(within(colour).getByRole('button', { name: 'Back' }));
    await waitFor(() =>
      expect(within(editor).getByRole('button', { name: 'More colours' })).toHaveFocus(),
    );
    expect(within(editor).queryByRole('group', { name: 'Colour' })).toBeNull();
    expect(store().pen.presets[0].color).toBe(picked);
    // The custom colour is the sixth swatch now, checked.
    const swatches = within(within(editor).getByRole('radiogroup', { name: 'Colour' }));
    expect(swatches.getAllByRole('radio')[5]).toHaveAttribute('aria-checked', 'true');

    // Esc on the colour page reverts what it changed and comes back; Esc again closes.
    await userEvent.click(within(editor).getByRole('button', { name: 'More colours' }));
    const again = await within(editor).findByRole('group', { name: 'Colour' });
    const gridAgain = within(again).getByRole('radiogroup', { name: 'Colour grid' });
    await userEvent.click(within(gridAgain).getAllByRole('radio')[60]!);
    expect(store().pen.presets[0].color).not.toBe(picked);
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(within(editor).queryByRole('group', { name: 'Colour' })).toBeNull());
    expect(store().pen.presets[0].color).toBe(picked);
    expect(screen.getByRole('dialog')).toBe(editor);
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(useToolStore.getState().mode).toBe('ink');
  });

  it('titles the editor in sentence case in English and Turkish', async () => {
    setLocale('tr');
    render(<Harness />);
    const tr = (name: RegExp) => within(presets()).getByRole('button', { name });
    await userEvent.click(tr(/^Mavi kalem/));
    await userEvent.click(tr(/^Mavi kalem/));
    expect(
      await settled(await screen.findByRole('dialog', { name: 'Mavi kalem düzenle' })),
    ).toBeVisible();
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    // A custom colour: the preset's place names it.
    act(() => store().editPreset(1, { color: '#123456' }));
    await userEvent.click(tr(/^Kalem 2/));
    expect(
      await settled(await screen.findByRole('dialog', { name: 'Kalem 2 düzenle' })),
    ).toBeVisible();
  });
});
