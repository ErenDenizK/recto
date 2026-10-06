/**
 * The dock at rest and its states in the capsule (`01-frame.md` F10 §4–§8; spec X1, D2-2;
 * Vitest browser mode, PDFium): the four labelled items in one roving toolbar; Markup and Fill
 * & sign open the palette in the same glass node, with the focus moving in and back to the door;
 * Locked replaces Markup and Fill & sign (and a lock engaging in Markup morphs the palette into
 * it and closes Markup); More lists its doors; and Pages opens the grid.
 */
import '../../styles/tokens.css';
import '../../styles/reset.css';
import '../../styles/global.css';

import { getActiveDocument, type VirtualDocument } from '@pdf-editor/document-model';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { page, userEvent } from 'vitest/browser';

import simpleUrl from '../../../../../test/fixtures/simple-text.pdf?url';
import { fixtureFile } from '../../../test/store-harness';
import { resetEditRunner, whenIdle } from '../../annotations/edit-runner';
import { registerAppCommands } from '../../commands/app-commands';
import { useShortcuts } from '../../commands/use-shortcuts';
import { resetLockStore, useLockStore } from '../../state/lock-store';
import { documentUi, isMarkupOpen, useUiStore } from '../../state/ui-store';
import { resetWorkspace, useWorkspaceStore } from '../../state/workspace-store';
import { resetToolStore, useToolStore } from '../../viewer/tool-store';
import { useAnnouncer } from '../announcer';
import { watchLockClosesMarkup } from '../capsule/capsule-content';
import { Dock } from './Dock';

function Harness() {
  useShortcuts();
  return (
    <div style={{ position: 'relative', height: 600 }} data-frame-layer="band">
      <Dock />
    </div>
  );
}

async function mount(): Promise<VirtualDocument> {
  await useWorkspaceStore.getState().openFiles([await fixtureFile(simpleUrl, 'simple.pdf')]);
  const doc = getActiveDocument(useWorkspaceStore.getState().workspace) as VirtualDocument;
  render(<Harness />);
  return doc;
}

const capsule = () => document.querySelector<HTMLElement>('[data-capsule]') as HTMLElement;
const dock = () => screen.getByRole('toolbar', { name: 'Document tools' });
const names = () =>
  within(dock())
    .getAllByRole('button')
    .map((b) => b.textContent);
const markupOpen = () =>
  isMarkupOpen(useUiStore.getState(), useWorkspaceStore.getState().workspace.activeDocument);
const settle = async () => {
  for (let i = 0; i < 5; i++) {
    const running = capsule()
      .getAnimations({ subtree: true })
      .filter((a) => !(a instanceof CSSTransition));
    if (running.length === 0) break;
    await Promise.all(running.map((a) => a.finished.catch(() => undefined)));
  }
  await new Promise((resolve) => setTimeout(resolve, 30));
};

describe('dock', () => {
  let disposeCommands: () => void = () => undefined;
  let stopWatch: () => void = () => undefined;
  beforeAll(() => {
    disposeCommands = registerAppCommands();
  });
  afterAll(() => {
    disposeCommands();
  });
  beforeEach(async () => {
    await page.viewport(1280, 900);
    resetWorkspace();
    resetEditRunner();
    resetToolStore();
    resetLockStore();
    useUiStore.setState({ destination: 'document', docUi: {} });
    stopWatch = watchLockClosesMarkup();
  });
  afterEach(async () => {
    stopWatch();
    cleanup();
    await whenIdle();
    resetWorkspace();
    resetToolStore();
    resetLockStore();
  });

  it('rests as Pages · Markup · Fill & sign · More in one toolbar, labels beside, 44 px', async () => {
    await mount();
    expect(names()).toEqual(['Pages', 'Markup', 'Fill & sign', 'More']);
    expect(dock()).toHaveAttribute('data-labels', 'beside');
    expect(capsule().getBoundingClientRect().height).toBeCloseTo(44, 0);
    // One Tab stop (roving), Pages first; arrows move.
    const stops = within(dock())
      .getAllByRole('button')
      .filter((b) => b.tabIndex === 0);
    expect(stops.map((b) => b.textContent)).toEqual(['Pages']);
    (stops[0] as HTMLElement).focus();
    await userEvent.keyboard('{ArrowRight}');
    expect(document.activeElement?.textContent).toBe('Markup');
    // Labels are primary text on the glass, never secondary (F10 §3).
    const item = within(dock()).getByRole('button', { name: 'Markup' });
    expect(getComputedStyle(item).fontWeight).toBe('500');
    expect(getComputedStyle(item.querySelector('svg') as Element).width).toBe('20px');
  });

  it('Markup opens the palette in the same node, focus inside; Done by `1` gives it back to Markup', async () => {
    await mount();
    const node = capsule();
    const markup = within(dock()).getByRole('button', { name: 'Markup' });
    markup.focus();
    await userEvent.keyboard('{Enter}');
    expect(markupOpen()).toBe(true);
    expect(useAnnouncer.getState().message).toBe('Markup on. Select armed.');
    expect(capsule()).toBe(node);
    expect(node.dataset.capsule).toBe('palette');
    const bar = screen.getByRole('toolbar', { name: 'Tools' });
    expect(bar).toContainElement(document.activeElement as HTMLElement);
    await settle();
    await userEvent.keyboard('1');
    await waitFor(() => expect(node.dataset.capsule).toBe('dock'));
    expect(capsule()).toBe(node);
    expect(document.activeElement).toBe(within(dock()).getByRole('button', { name: 'Markup' }));
  });

  it('Fill & sign opens the palette on the Fill & sign group', async () => {
    await mount();
    await userEvent.click(within(dock()).getByRole('button', { name: 'Fill & sign' }));
    expect(markupOpen()).toBe(true);
    expect(useToolStore.getState().barGroup).toBe('fill');
    const id = useWorkspaceStore.getState().workspace.activeDocument;
    expect(documentUi(useUiStore.getState(), id).paletteSet).toBe('sign');
  });

  it('Locked replaces Markup and Fill & sign; Pages and More slide to their places', async () => {
    const doc = await mount();
    const node = capsule();
    useLockStore.getState().lock(doc.id);
    await waitFor(() => expect(node.dataset.capsule).toBe('locked'));
    await settle();
    expect(capsule()).toBe(node);
    expect(names()).toEqual(['Pages', 'Locked', 'More']);
    const locked = within(dock()).getByRole('button', { name: /^Locked: .+\. Unlock…$/ });
    expect(locked).toHaveAttribute('aria-haspopup', 'dialog');
    expect(within(dock()).queryByRole('button', { name: 'Markup' })).toBeNull();
    // The key that opens Markup opens nothing while locked.
    await userEvent.keyboard('2');
    expect(node.dataset.capsule).toBe('locked');
    useLockStore.getState().unlock(doc.id);
    await waitFor(() => expect(node.dataset.capsule).toBe('dock'));
  });

  it('a lock engaging in Markup morphs the palette into Locked and closes Markup, said once', async () => {
    const doc = await mount();
    const node = capsule();
    await userEvent.click(within(dock()).getByRole('button', { name: 'Markup' }));
    await waitFor(() => expect(node.dataset.capsule).toBe('palette'));
    useLockStore.getState().lock(doc.id);
    await waitFor(() => expect(node.dataset.capsule).toBe('locked'));
    expect(capsule()).toBe(node);
    expect(markupOpen()).toBe(false);
    expect(useAnnouncer.getState().message).toBe('Locked. Markup closed.');
  });

  it('More lists its doors, the rarer tools and ⌘K last', async () => {
    await mount();
    await userEvent.click(within(dock()).getByRole('button', { name: 'More' }));
    const menu = await screen.findByRole('menu');
    const items = within(menu)
      .getAllByRole('menuitem')
      .map((item) => item.textContent);
    expect(items[0]).toContain('Edit text');
    expect(items).toContain('All commands…');
    // Settings… joins with its command (registered by the settings host, not here).
    expect(items.at(-1)).toContain('Keyboard shortcuts');
    await userEvent.keyboard('{Escape}');
  });

  it('Pages opens the grid', async () => {
    await mount();
    await userEvent.click(within(dock()).getByRole('button', { name: 'Pages' }));
    const id = useWorkspaceStore.getState().workspace.activeDocument;
    expect(documentUi(useUiStore.getState(), id).surface).toBe('grid');
  });
});
