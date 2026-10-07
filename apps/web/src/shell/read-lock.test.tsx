/**
 * The Read lock (ADR-0019 §3, craft spec §3.3) on the mounted page view and bar (Vitest
 * browser mode, PDFium): in viewing the capsule is the dock (01-frame F10, D2-2), whose
 * Markup opens the bar of groups; nothing on the page selects,
 * arms or marks; a tool key switches to Edit and arms the tool, said once, mode first;
 * a tool letter on a text selection marks it at once, with Markup left closed (D2-3).
 */
import { getActiveDocument, type VirtualDocument } from '@pdf-editor/document-model';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { page, userEvent } from 'vitest/browser';

import { settled } from '../../test/settled';
import simpleUrl from '../../../../test/fixtures/simple-text.pdf?url';
import { fixtureFile } from '../../test/store-harness';
import { createAnnotations } from '../annotations/actions';
import {
  type PageTarget,
  resetAnnotationStore,
  useAnnotationStore,
} from '../annotations/annotation-store';
import { readAnnotations, resetEditRunner, whenIdle } from '../annotations/edit-runner';
import { INK } from '../annotations/palette';
import { registerAppCommands } from '../commands/app-commands';
import { useShortcuts } from '../commands/use-shortcuts';
import { ReadView } from '../stage/ReadView';
import { resetLockStore, useLockStore } from '../state/lock-store';
import { isMarkupOpen, useUiStore } from '../state/ui-store';
import { useViewStore } from '../state/view-store';
import { resetWorkspace, useWorkspaceStore } from '../state/workspace-store';
import { resetToolStore, useToolStore } from '../viewer/tool-store';
import { useAnnouncer } from './announcer';
import { Dock } from './frame/Dock';
import { PageContextMenu } from '../stage/PageContextMenu';

function Harness({ doc }: { readonly doc: VirtualDocument }) {
  useShortcuts();
  return (
    <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', height: 700 }}>
      <ReadView doc={doc} />
      <Dock />
      <PageContextMenu />
    </div>
  );
}

interface Mounted {
  readonly container: HTMLElement;
  readonly layer: HTMLElement;
  readonly target: PageTarget;
  readonly doc: VirtualDocument;
}

/** Opens the fixture as a file opens: in Read. */
async function mount(): Promise<Mounted> {
  const report = await useWorkspaceStore
    .getState()
    .openFiles([await fixtureFile(simpleUrl, 'simple.pdf')]);
  expect(report.skipped).toEqual([]);
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
    container,
    layer,
    doc,
    target: { source: first.ref.source, pageIndex: 0, pageId: first.id, position: 1 },
  };
}

/** M8's words for the active document's Markup state, as the control still shows them. */
const mode = () =>
  isMarkupOpen(useUiStore.getState(), useWorkspaceStore.getState().workspace.activeDocument)
    ? 'edit'
    : 'read';
const enterEdit = () => {
  const id = useWorkspaceStore.getState().workspace.activeDocument;
  if (id !== undefined) useUiStore.getState().openMarkup(id);
};
const dock = () => screen.getByRole('toolbar', { name: 'Document tools' });

function press(element: Element): void {
  const box = element.getBoundingClientRect();
  const init = {
    bubbles: true,
    cancelable: true,
    clientX: box.left + box.width / 2,
    clientY: box.top + box.height / 2,
    button: 0,
    pointerId: 1,
    isPrimary: true,
  };
  element.dispatchEvent(new PointerEvent('pointerdown', { ...init, buttons: 1 }));
  window.dispatchEvent(new PointerEvent('pointerup', { ...init, buttons: 0 }));
}

/** Selects the first word-bearing span of the page's text layer. */
async function selectSomeText(container: HTMLElement): Promise<void> {
  const span = await waitFor(() => {
    const spans = container.querySelectorAll<HTMLElement>(
      '[data-page-index="0"] [data-testid="text-layer"] span',
    );
    const found = [...spans].find((s) => (s.textContent ?? '').trim().length > 3);
    if (!found) throw new Error('no text yet');
    return found;
  });
  const range = document.createRange();
  range.selectNodeContents(span);
  const selection = window.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
}

describe('the Read lock (mounted)', () => {
  let disposeCommands: () => void = () => undefined;
  beforeAll(() => {
    disposeCommands = registerAppCommands();
  });
  afterAll(() => {
    disposeCommands();
  });
  beforeEach(() => {
    resetWorkspace();
    resetEditRunner();
    resetAnnotationStore();
    resetToolStore();
    useUiStore.setState({ destination: 'document', docUi: {} });
  });
  afterEach(async () => {
    cleanup();
    window.getSelection()?.removeAllRanges();
    await whenIdle();
    resetWorkspace();
    resetToolStore();
  });

  it('a file opens in viewing: the dock, whose Markup opens the palette with the focus, and `1` closes', async () => {
    // A desktop window: Fill & sign is "Sign" only on a compact one (F10 §5).
    await page.viewport(1280, 900);
    await mount();
    expect(mode()).toBe('read');
    const names = within(dock())
      .getAllByRole('button')
      .map((b) => b.textContent);
    expect(names).toEqual(['Pages', 'Markup', 'Fill & sign', 'More']);
    const markup = within(dock()).getByRole('button', { name: 'Markup' });
    expect(markup).toHaveAttribute('aria-keyshortcuts', 'M 2');
    expect(markup).toHaveAttribute('aria-pressed', 'false');

    markup.focus();
    await userEvent.keyboard('{Enter}');
    expect(mode()).toBe('edit');
    expect(useAnnouncer.getState().message).toBe('Markup on. Select armed.');
    // The palette, with the focus on its armed tool (Select): the capsule morphed, its focus
    // followed.
    const palette = await screen.findByRole('toolbar', { name: 'Markup' });
    await waitFor(() => expect(palette).toContainElement(document.activeElement as HTMLElement));
    expect(within(palette).getByRole('button', { name: 'Select' })).toHaveFocus();

    // `1` (the mode command) closes it: the dock again.
    await userEvent.keyboard('1');
    await waitFor(() => expect(screen.queryByRole('toolbar', { name: 'Markup' })).toBeNull());
    expect(within(dock()).getAllByRole('button')).toHaveLength(4);
  });

  it('in viewing a press on an annotation selects it with its bar; locked, nothing changes', async () => {
    const { layer, target } = await mount();
    const created = await createAnnotations(target, [
      {
        kind: 'square',
        pageIndex: 0,
        rect: { x: 100, y: 500, width: 120, height: 60 },
        color: INK.red,
        opacity: 1,
        strokeWidth: 2,
      },
    ]);
    const id = created?.[0]?.id;
    if (id === undefined) throw new Error('not created');
    useAnnotationStore.getState().select(null);
    const hit = await waitFor(() => {
      const h = layer.querySelector(`[data-annotation-id="${id}"]`);
      if (!h) throw new Error('no hit target');
      return h;
    });
    // Viewing (05-canvas §6): annotations take the press, a targeted act; Markup stays closed.
    await waitFor(() => expect(getComputedStyle(hit).pointerEvents).not.toBe('none'));
    press(hit);
    expect(useAnnotationStore.getState().selection?.ids).toEqual([id]);
    expect(await screen.findByTestId('annotation-bar')).toBeVisible();
    expect(mode()).toBe('read');
    // Opening and closing Markup keeps the selection: selecting is not a mode.
    const docId = useWorkspaceStore.getState().workspace.activeDocument;
    if (docId === undefined) throw new Error('no document');
    enterEdit();
    useUiStore.getState().closeMarkup(docId);
    expect(useAnnotationStore.getState().selection?.ids).toEqual([id]);

    // Locked: the selection and its bar go; a press shows the annotation, with no bar, and
    // Delete removes nothing.
    useLockStore.getState().lock(docId);
    expect(useAnnotationStore.getState().selection).toBeNull();
    await waitFor(() => expect(screen.queryByTestId('annotation-bar')).toBeNull());
    press(hit);
    expect(useAnnotationStore.getState().selection?.ids).toEqual([id]);
    await userEvent.keyboard('{Delete}');
    await whenIdle();
    expect((await readAnnotations(target.source, 0)).map((a) => a.id)).toContain(id);
    expect(screen.queryByTestId('annotation-bar')).toBeNull();
    resetLockStore();
  });

  it('p in Read switches to Edit and arms the pen, said once, mode first', async () => {
    const { layer } = await mount();
    expect(layer).not.toHaveAttribute('data-drawing');
    await userEvent.keyboard('p');
    expect(mode()).toBe('edit');
    expect(useToolStore.getState().mode).toBe('ink');
    const said = useAnnouncer.getState().message;
    expect(said.startsWith('Edit mode. ')).toBe(true);
    expect(said.match(/Edit mode/g)).toHaveLength(1);
    // Visibly armed: the palette shows, the page takes the pen. The capsule fades through
    // from the dock to the palette: its content shows once that has run.
    await waitFor(() => expect(layer).toHaveAttribute('data-drawing'));
    expect(await settled(screen.getByRole('toolbar', { name: 'Markup' }))).toBeVisible();
  });

  it('the tool store arms nothing in Read and disarms on entering Read', async () => {
    await mount();
    useToolStore.getState().setMode('ink');
    expect(useToolStore.getState().mode).toBe('select');
    enterEdit();
    useToolStore.getState().setMode('ink');
    expect(useToolStore.getState().mode).toBe('ink');
    await userEvent.keyboard('{Escape}');
    useToolStore.getState().setMode('rectangle');
    await userEvent.keyboard('1');
    expect(mode()).toBe('read');
    expect(useToolStore.getState().mode).toBe('select');
    const id = useWorkspaceStore.getState().workspace.activeDocument;
    expect(isMarkupOpen(useUiStore.getState(), id)).toBe(false);
  });

  it('U over selected text in viewing marks it at once, a targeted act; Markup stays closed', async () => {
    const { container, target } = await mount();
    await selectSomeText(container);
    await userEvent.keyboard('u');
    await waitFor(async () => {
      const kinds = (await readAnnotations(target.source, 0)).map((a) => a.kind);
      expect(kinds).toEqual(['underline']);
    });
    // A tool letter on a selection acts on it and never arms (03-markup §5).
    expect(mode()).toBe('read');
    expect(useToolStore.getState().mode).toBe('select');
  });

  it('the Read selection bar offers Copy and "Mark up…", which switches and keeps the selection', async () => {
    const { container } = await mount();
    await selectSomeText(container);
    const selectionBar = await screen.findByRole('toolbar', { name: 'Selected text' });
    expect(within(selectionBar).getByRole('button', { name: /Copy/ })).toBeVisible();
    const markUp = within(selectionBar).getByRole('button', { name: /Mark up/ });
    await userEvent.click(markUp);
    expect(mode()).toBe('edit');
    expect(window.getSelection()?.isCollapsed).toBe(false);
    expect(useAnnouncer.getState().message).toBe(
      'Edit mode. Highlight with H, underline with U, strike out with S',
    );
    // In Edit the selection's bar offers the markups instead (craft spec §3.4).
    await waitFor(() =>
      expect(
        within(screen.getByRole('toolbar', { name: 'Selected text' })).getByRole('button', {
          name: 'Underline',
        }),
      ).toBeVisible(),
    );
    expect(screen.queryByRole('button', { name: /Mark up/ })).toBeNull();
  });
});
