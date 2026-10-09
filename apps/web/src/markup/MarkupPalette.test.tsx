/**
 * The Markup palette (`03-markup` MK-2 to MK-17, `10-ink` §2), Vitest browser mode with the
 * page view and real PDFium: the doors and Done, the groups, the ink strip on arming and its
 * edits, P and P again, the second press, the Esc ladder, the measured fold into +, choice
 * tools, the stroke fade (never with focus inside), placing tools back to Select, the Fill &
 * sign door's chips, and the shortcut overlay's group names.
 */
import '../styles/tokens.css';
import '../styles/reset.css';
import '../styles/global.css';
import '../annotations/index';

import { getActiveDocument, type VirtualDocument } from '@pdf-editor/document-model';
import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';

import simpleUrl from '../../../../test/fixtures/simple-text.pdf?url';
import { fixtureFile } from '../../test/store-harness';
import {
  type PageTarget,
  resetAnnotationStore,
  TOOL_STYLES_STORAGE_KEY,
  useAnnotationStore,
} from '../annotations/annotation-store';
import { readAnnotations, resetEditRunner, whenIdle } from '../annotations/edit-runner';
import { INK } from '../annotations/palette';
import { PEN_PRESETS_STORAGE_KEY } from '../annotations/pen/presets';
import { builtinPendingStamp } from '../annotations/stamps';
import { ANNOTATION_TOOLS } from '../annotations/tools';
import { registerAppCommands } from '../commands/app-commands';
import { useShortcuts } from '../commands/use-shortcuts';
import { useAnnouncer } from '../shell/announcer';
import { Dock } from '../shell/frame/Dock';
import { ShortcutOverlay } from '../shell/ShortcutOverlay';
import {
  memorySignatureBackend,
  saveSignature,
  setSignatureBackend,
} from '../signatures/saved-signatures';
import { ReadView } from '../stage/ReadView';
import { isMarkupOpenActive, useUiStore } from '../state/ui-store';
import { useViewStore } from '../state/view-store';
import { resetWorkspace, useWorkspaceStore } from '../state/workspace-store';
import { resetToolStore, useToolStore } from '../viewer/tool-store';
import { COLOUR_VIEW_KEY } from '../ui/colour/ColourPanel';
import { INK_RECENTS_STORAGE_KEY, reloadInkRecents } from './ink-recents';
import { paletteGroupOfCommand } from './palette-groups';

function Harness({ doc }: { readonly doc: VirtualDocument }) {
  useShortcuts();
  return (
    <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', height: 760 }}>
      <ReadView doc={doc} />
      <div style={{ position: 'absolute', inset: 'auto 0 0 0', height: 0 }} data-frame-layer="band">
        <Dock />
      </div>
    </div>
  );
}

interface Mounted {
  readonly layer: HTMLElement;
  readonly target: PageTarget;
}

async function mount(): Promise<Mounted> {
  await useWorkspaceStore.getState().openFiles([await fixtureFile(simpleUrl, 'simple.pdf')]);
  const doc = getActiveDocument(useWorkspaceStore.getState().workspace) as VirtualDocument;
  const first = doc.pages[0];
  if (first?.ref.kind !== 'source') throw new Error('no source page');
  useUiStore.getState().setZoom(0.75);
  useViewStore.getState().setCurrentPage(0);
  const { container } = render(<Harness doc={doc} />);
  await waitFor(
    () => {
      if (!container.querySelector('[data-page-index="0"] canvas[data-state="rendered"]')) {
        throw new Error('page not rendered');
      }
    },
    { timeout: 10_000 },
  );
  const layer = await waitFor(() => {
    const l = container.querySelector<HTMLElement>('[data-annotation-layer="0"]');
    if (!l) throw new Error('no annotation layer');
    return l;
  });
  return {
    layer,
    target: { source: first.ref.source, pageIndex: 0, pageId: first.id, position: 1 },
  };
}

const palette = () => screen.getByRole('toolbar', { name: 'Markup' });
const tool = (name: string | RegExp) => within(palette()).getByRole('button', { name });
const strip = () => screen.queryByTestId('ink-strip');

async function openMarkup(door: 'Markup' | 'Fill & sign' = 'Markup'): Promise<void> {
  await userEvent.click(
    within(screen.getByRole('toolbar', { name: 'Document tools' })).getByRole('button', {
      name: door,
    }),
  );
  await waitFor(() => expect(isMarkupOpenActive()).toBe(true));
  await screen.findByRole('toolbar', { name: 'Markup' });
}

function press(layer: HTMLElement, at: [number, number], pointerType = 'mouse'): () => void {
  const box = layer.getBoundingClientRect();
  const init = {
    bubbles: true,
    cancelable: true,
    clientX: box.left + box.width * at[0],
    clientY: box.top + box.height * at[1],
    button: 0,
    pointerId: 7,
    isPrimary: true,
    pointerType,
  };
  layer.dispatchEvent(new PointerEvent('pointerdown', { ...init, buttons: 1 }));
  return () => window.dispatchEvent(new PointerEvent('pointerup', { ...init, buttons: 0 }));
}

describe('Markup palette', () => {
  let disposeCommands: () => void = () => undefined;
  beforeAll(() => {
    disposeCommands = registerAppCommands();
  });
  afterAll(() => {
    disposeCommands();
  });
  beforeEach(async () => {
    await page.viewport(1280, 900);
    localStorage.removeItem(TOOL_STYLES_STORAGE_KEY);
    localStorage.removeItem(PEN_PRESETS_STORAGE_KEY);
    localStorage.removeItem(INK_RECENTS_STORAGE_KEY);
    localStorage.removeItem(COLOUR_VIEW_KEY);
    reloadInkRecents();
    setSignatureBackend(memorySignatureBackend());
    resetWorkspace();
    resetEditRunner();
    resetAnnotationStore();
    resetToolStore();
    useUiStore.setState({ docUi: {} });
  });
  afterEach(async () => {
    vi.restoreAllMocks();
    await whenIdle();
    cleanup();
    resetToolStore();
    setSignatureBackend(undefined);
    localStorage.removeItem(TOOL_STYLES_STORAGE_KEY);
    localStorage.removeItem(PEN_PRESETS_STORAGE_KEY);
    localStorage.removeItem(INK_RECENTS_STORAGE_KEY);
    localStorage.removeItem(COLOUR_VIEW_KEY);
    reloadInkRecents();
    resetAnnotationStore();
    resetWorkspace();
  });

  it('the Markup door opens it on Select with its named groups; Done closes it', async () => {
    await mount();
    await openMarkup();
    expect(useAnnouncer.getState().message).toBe('Markup on. Select armed.');
    const groups = within(palette())
      .getAllByRole('group')
      .map((g) => g.getAttribute('aria-label'));
    expect(groups).toEqual(['Select', 'Draw', 'Add', 'Fill and sign', 'Page content']);
    expect(tool('Select')).toHaveAttribute('aria-pressed', 'true');
    // Opened from the dock: focus follows the capsule to the palette's Tab stop, the armed tool.
    await waitFor(() => expect(tool('Select')).toHaveFocus());
    expect(
      within(palette())
        .getAllByRole('button')
        .filter((b) => b.tabIndex === 0),
    ).toHaveLength(1);
    // One bar of 44 px, its controls 32 px on one centre line (Q-9).
    expect(palette().getBoundingClientRect().height).toBeCloseTo(42, 0);
    const centres = new Set(
      within(palette())
        .getAllByRole('button')
        .map((b) => {
          const r = b.getBoundingClientRect();
          return Math.round((r.top + r.height / 2) * 2) / 2;
        }),
    );
    expect(centres.size).toBe(1);
    expect(strip()).toBeNull();

    await userEvent.click(tool('Done'));
    await waitFor(() => expect(isMarkupOpenActive()).toBe(false));
    expect(useAnnouncer.getState().message).toBe('Markup off.');
    await waitFor(() =>
      expect(
        within(screen.getByRole('toolbar', { name: 'Document tools' })).getByRole('button', {
          name: 'Markup',
        }),
      ).toHaveFocus(),
    );
  });

  it('arming a pen shows its ink strip: the well, its recents and the width edit the armed preset', async () => {
    await mount();
    await openMarkup();
    await userEvent.click(tool('Red pen, 2 pt'));
    expect(useToolStore.getState().mode).toBe('ink');
    const inks = await screen.findByRole('toolbar', { name: 'Pen options' });
    // One press away: the well with the pen's colour and the width (10-ink §2.1). No fixed
    // swatches repeat the dock's pens (G8), and a pen that never changed colour has no recents.
    // The strip's piece rises in above the palette.
    const well = within(inks).getByRole('button', { name: 'Colour: Red' });
    await waitFor(() => expect(well).toBeVisible());
    expect(within(inks).queryAllByRole('radio')).toHaveLength(0);
    // A colour from the panel shows on the armed pen's dot in the dock at once.
    await userEvent.click(well);
    const grid = await screen.findByRole('radiogroup', { name: 'Colour grid' });
    const cell = within(grid).getAllByRole('radio')[40] as HTMLElement;
    await userEvent.click(cell);
    const chosen = useAnnotationStore.getState().pen.presets[2].color;
    expect(chosen).not.toBe(INK.red);
    const dot = palette().querySelector('[data-pen-preset="2"] span') as HTMLElement;
    const [r, g, b] = [1, 3, 5].map((i) => Number.parseInt(chosen.slice(i, i + 2), 16));
    expect(getComputedStyle(dot).backgroundColor).toBe(`rgb(${r}, ${g}, ${b})`);
    // Closing the panel commits; the colour the pen left becomes its first recent.
    await userEvent.click(within(inks).getByRole('button', { name: /^Colour: / }));
    await waitFor(() =>
      expect(screen.queryByRole('radiogroup', { name: 'Colour grid' })).toBeNull(),
    );
    const recents = await within(inks).findByRole('radiogroup', { name: 'Recent colours' });
    expect(
      within(recents)
        .getAllByRole('radio')
        .map((el) => el.getAttribute('aria-label')),
    ).toEqual(['Red']);
    // A recent swaps back: red again, and the panel's colour takes its place among the recents.
    await userEvent.click(within(recents).getByRole('radio', { name: 'Red' }));
    expect(useAnnotationStore.getState().pen.presets[2].color).toBe(INK.red);
    expect(useAnnotationStore.getState().styles.ink.color).toBe(INK.red);
    await waitFor(() => expect(within(inks).getAllByRole('radio')).toHaveLength(1));
    expect(within(inks).queryByRole('radio', { name: 'Red' })).toBeNull();
    // Each pen keeps its own recents: the black pen has none.
    await userEvent.click(tool('Black pen, 1.5 pt'));
    await waitFor(() =>
      expect(within(strip() as HTMLElement).queryAllByRole('radio')).toHaveLength(0),
    );
    await userEvent.click(tool('Red pen, 2 pt'));
    const width = within(inks).getByRole('slider', { name: 'Width' });
    expect(width).toHaveAttribute('aria-valuetext', '2 points');
    width.focus();
    await userEvent.keyboard('{ArrowRight}');
    expect(useAnnotationStore.getState().pen.presets[2].width).toBe(3);
    // The strip floats above the palette as its own glass piece (owner feedback F3), centred
    // over it and hugging its content; the capsule stays one bar.
    const surface = palette().closest('[data-capsule]') as HTMLElement;
    const piece = inks.closest('[data-strip-piece]') as HTMLElement;
    expect(surface.contains(inks)).toBe(false);
    expect(piece).not.toBeNull();
    const box = piece.getBoundingClientRect();
    const capsule = surface.getBoundingClientRect();
    expect(box.bottom).toBeLessThanOrEqual(capsule.top - 4);
    expect(Math.abs(box.left + box.width / 2 - (capsule.left + capsule.width / 2))).toBeLessThan(1);
    expect(box.width).toBeLessThan(capsule.width);
    // One family (G8): the strip is as tall as the palette, one bar.
    expect(capsule.height).toBe(44);
    expect(box.height).toBe(capsule.height);
    // Select has no strip: the piece leaves, inert from its first frame out, then unmounts.
    await userEvent.click(tool('Select'));
    expect(piece).toHaveAttribute('inert');
    expect(screen.queryByRole('toolbar', { name: 'Pen options' })).toBeNull();
    await waitFor(() => expect(strip()).toBeNull());
  });

  it('P arms the last pen, P again the next; H the Highlighter with its tints', async () => {
    await mount();
    await openMarkup();
    palette().blur();
    (document.activeElement as HTMLElement | null)?.blur();
    await userEvent.keyboard('p');
    expect(useToolStore.getState().mode).toBe('ink');
    expect(useAnnotationStore.getState().pen.active).toBe(0);
    await userEvent.keyboard('p');
    expect(useAnnotationStore.getState().pen.active).toBe(1);
    await userEvent.keyboard('p');
    expect(useAnnotationStore.getState().pen.active).toBe(2);
    await userEvent.keyboard('p');
    expect(useAnnotationStore.getState().pen.active).toBe(0);
    await userEvent.keyboard('h');
    expect(useAnnotationStore.getState().pen.active).toBe(3);
    const tints = await screen.findByRole('toolbar', { name: 'Highlighter options' });
    expect(within(tints).getByRole('button', { name: 'Colour: Yellow' })).toBeInTheDocument();
    // P from the Highlighter: the last writing pen.
    await userEvent.keyboard('p');
    expect(useAnnotationStore.getState().pen.active).toBe(0);
  });

  it('a second press on the armed pen opens its editor above the whole palette', async () => {
    await mount();
    await openMarkup();
    await userEvent.click(tool('Black pen, 1.5 pt'));
    await screen.findByRole('toolbar', { name: 'Pen options' });
    await userEvent.click(tool('Black pen, 1.5 pt'));
    const editor = await screen.findByRole('dialog', { name: 'Edit black pen' });
    const surface = palette().closest('[data-capsule]') as HTMLElement;
    await waitFor(() =>
      expect(editor.getBoundingClientRect().bottom).toBeLessThanOrEqual(
        surface.getBoundingClientRect().top,
      ),
    );
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(useToolStore.getState().mode).toBe('ink');
    expect(isMarkupOpenActive()).toBe(true);
  });

  it('Esc ladder in the palette: disarm to Select, then close Markup', async () => {
    await mount();
    await openMarkup();
    await userEvent.click(tool('Eraser'));
    expect(useToolStore.getState().mode).toBe('eraser');
    const strip = await screen.findByRole('toolbar', { name: 'Eraser options' });
    await waitFor(() => expect(strip).toBeVisible());
    await userEvent.keyboard('{Escape}');
    expect(useToolStore.getState().mode).toBe('select');
    expect(isMarkupOpenActive()).toBe(true);
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(isMarkupOpenActive()).toBe(false));
  });

  it('folds by measurement into +, which arms what it holds and shows its glyph', async () => {
    await page.viewport(640, 900);
    await mount();
    await openMarkup();
    // At 640 px the page-content tools and the rare ones live in +.
    await waitFor(() =>
      expect(within(palette()).queryByRole('button', { name: 'Redact' })).toBeNull(),
    );
    const width = palette().closest('[data-capsule]')?.getBoundingClientRect().width ?? 0;
    expect(width).toBeLessThanOrEqual(640 - 32);
    await userEvent.click(tool('More tools'));
    const menu = await screen.findByRole('menu');
    await userEvent.click(within(menu).getByRole('menuitem', { name: /Redact/ }));
    expect(useToolStore.getState().mode).toBe('redact');
    await waitFor(() =>
      expect(tool('More tools, Redact armed')).toHaveAttribute('aria-pressed', 'true'),
    );
  });

  it('Shapes: a press arms the kind it shows, a press again opens its kinds', async () => {
    await mount();
    await openMarkup();
    await userEvent.click(tool('Shapes: Rectangle'));
    expect(useToolStore.getState().mode).toBe('rectangle');
    expect(screen.queryByRole('menu')).toBeNull();
    await userEvent.click(tool('Shapes: Rectangle'));
    const menu = await screen.findByRole('menu');
    await userEvent.click(within(menu).getByRole('menuitem', { name: /Ellipse/ }));
    expect(useToolStore.getState().mode).toBe('ellipse');
    expect(tool('Shapes: Ellipse')).toHaveAttribute('aria-pressed', 'true');
  });

  it('fades while a stroke runs and a second after, never with focus inside', async () => {
    const { layer } = await mount();
    await openMarkup();
    const surface = palette().closest('[data-capsule]') as HTMLElement;
    await userEvent.click(tool('Eraser'));
    // Focus is inside the palette (the eraser): no fade (A-13).
    let release = press(layer, [0.3, 0.3]);
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(surface).not.toHaveAttribute('data-stroking');
    release();
    // Focus on the page: the palette fades and lets the pointer through.
    (document.activeElement as HTMLElement | null)?.blur();
    await new Promise((resolve) => setTimeout(resolve, 1100));
    release = press(layer, [0.3, 0.4]);
    await waitFor(() => expect(surface).toHaveAttribute('data-stroking'));
    expect(getComputedStyle(surface).pointerEvents).toBe('none');
    release();
    await waitFor(() => expect(surface).not.toHaveAttribute('data-stroking'), { timeout: 2500 });
  });

  it('a placed stamp returns to Select and stays unselected', async () => {
    const { layer, target } = await mount();
    await openMarkup();
    act(() => {
      useAnnotationStore.getState().setPendingStamp(builtinPendingStamp('Draft'));
      useToolStore.getState().setMode('stamp');
    });
    await waitFor(() => expect(layer).toHaveAttribute('data-tool', 'stamp'));
    press(layer, [0.5, 0.4])();
    await waitFor(async () =>
      expect((await readAnnotations(target.source, 0)).map((a) => a.kind)).toEqual(['stamp']),
    );
    await waitFor(() => expect(useToolStore.getState().mode).toBe('select'));
    expect(useAnnotationStore.getState().selection).toBeNull();
  });

  it('the Fill & sign door shows saved signatures as chips; a chip arms it', async () => {
    await page.viewport(1440, 900);
    await saveSignature({ kind: 'typed', text: 'Ada Lindqvist' });
    await mount();
    await openMarkup('Fill & sign');
    const chips = await waitFor(() => {
      const found = palette().querySelectorAll<HTMLElement>('[data-saved-signature]');
      if (found.length === 0) throw new Error('no chips');
      return found;
    });
    expect(chips).toHaveLength(1);
    await userEvent.click(chips[0] as HTMLElement);
    await waitFor(() => expect(useToolStore.getState().mode).toBe('signature'));
    expect(chips[0]).toHaveAttribute('aria-pressed', 'true');
    // One pressed control across the palette.
    expect(palette().querySelectorAll('[aria-pressed="true"]')).toHaveLength(1);
  });
});

describe('palette groups', () => {
  it('gives every tool with a group its palette group, for keys and the command palette', () => {
    for (const t of ANNOTATION_TOOLS) {
      expect(paletteGroupOfCommand(`tool.${t.mode}`)).toBe(t.group);
    }
    expect(paletteGroupOfCommand('tool.highlighter')).toBe('draw');
    expect(paletteGroupOfCommand('forms.add.text')).toBe('sign');
    expect(paletteGroupOfCommand('stamp.draft')).toBe('add');
    expect(paletteGroupOfCommand('file.open')).toBeUndefined();
  });

  it('every tool names the act its commit asks of the guard', () => {
    for (const t of ANNOTATION_TOOLS) {
      if (t.mode === 'select') expect(t.act).toBeNull();
      else expect(['freehand', 'place', 'targeted', 'text']).toContain(t.act);
    }
  });

  it('the shortcut overlay names each tool group as the palette does', async () => {
    const dispose = registerAppCommands();
    useUiStore.setState({ shortcutsOpen: true });
    try {
      render(<ShortcutOverlay />);
      const dialog = await screen.findByRole('dialog', { name: 'Keyboard shortcuts' });
      const row = (title: string) => {
        const term = within(dialog).getByText(title, { exact: true }).closest('tr');
        if (!term) throw new Error(`no row ${title}`);
        return term;
      };
      expect(row('Pen tool')).toHaveTextContent('Markup: Draw');
      expect(row('Highlighter tool')).toHaveTextContent('Markup: Draw');
      expect(row('Note tool')).toHaveTextContent('Markup: Add');
      expect(row('Redact tool')).toHaveTextContent('Markup: Page content');
      // Underline acts on a text selection, so its row is in "On a selection" (key map v2).
      expect(row('Underline the selection')).not.toHaveTextContent('Markup:');
    } finally {
      useUiStore.setState({ shortcutsOpen: false });
      dispose();
      cleanup();
    }
  });
});
