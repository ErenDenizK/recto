/**
 * Focus (`components/01-frame.md` F13 §4–§8; RA-12; flows.md §6.2): the dock and the page pill
 * step away so the page has the stage; the strip stays from medium up, so ◆, Find, Save and ↶
 * stay reachable (the compact bar goes too). Per window, never kept in the snapshot.
 *
 * - **Enter:** F (`view.focus`), or the pill menu's Focus (the touch route, spec 01.14). Only
 *   on a document's page with Markup closed: the palette is never hidden under someone's tool.
 * - **Leave:** F again; Esc, after menus and the selection in the Esc ladder (registered after
 *   `selection.clear`, so a first Esc still clears the selection, spec 01.14); a tap on the page
 *   that is not a target; leaving the page (the Library, the grid, Compare, Markup).
 * - Mod+G still opens the pill's menu (anchored where the pill rests); Focus resumes after it.
 * - Announced "Focus on. Press F or Esc to show the tools." (touch: "Tap the page to show the
 *   tools.") and "Focus off".
 */
import type { CommandRegistry } from '../../commands/registry';
import { m } from '../../i18n';
import { isMarkupOpen, isPageView, useUiStore } from '../../state/ui-store';
import { useWorkspaceStore } from '../../state/workspace-store';
import { announce } from '../announcer';
import { setFocusMode, useFrameStore } from './frame-store';
import { lastInput } from './input-modality';

/** Focus applies here: a document's page, with pages, Markup closed. */
export function focusAllowed(): boolean {
  const ui = useUiStore.getState();
  const ws = useWorkspaceStore.getState().workspace;
  const id = ws.activeDocument;
  if (id === undefined || !isPageView(ui, id) || isMarkupOpen(ui, id)) return false;
  return (ws.documents[id]?.pages.length ?? 0) > 0;
}

export function enterFocus(): void {
  if (!focusAllowed() || useFrameStore.getState().focusMode) return;
  setFocusMode(true);
  announce(lastInput() === 'touch' ? m.frame_focus_on_touch() : m.frame_focus_on());
}

export function leaveFocus(): void {
  if (!useFrameStore.getState().focusMode) return;
  setFocusMode(false);
  announce(m.frame_focus_off());
}

/** Registers F and the Esc rung; returns a disposer. */
export function registerFocusCommands(registry: CommandRegistry): () => void {
  const disposers = [
    registry.register({
      id: 'view.focus',
      title: m.frame_focus_command(),
      group: m.group_view(),
      act: null,
      shortcut: 'F',
      keywords: ['distraction', 'hide tools', 'reading', 'full'],
      when: () => useFrameStore.getState().focusMode || focusAllowed(),
      run: () => (useFrameStore.getState().focusMode ? leaveFocus() : enterFocus()),
    }),
    registry.register({
      id: 'view.leaveFocus',
      title: m.frame_focus_off(),
      group: m.group_view(),
      act: null,
      shortcut: 'Escape',
      hiddenInPalette: true,
      when: () => useFrameStore.getState().focusMode,
      run: leaveFocus,
    }),
  ];
  // Leaving the page (another destination, the grid, Markup) leaves Focus.
  const offUi = useUiStore.subscribe(() => {
    if (useFrameStore.getState().focusMode && !focusAllowed()) setFocusMode(false);
  });
  const offWs = useWorkspaceStore.subscribe((state, previous) => {
    if (state.workspace.activeDocument === previous.workspace.activeDocument) return;
    if (useFrameStore.getState().focusMode && !focusAllowed()) setFocusMode(false);
  });
  return () => {
    for (const dispose of disposers) dispose();
    offUi();
    offWs();
  };
}

/** Taps on these are the page's own: they never leave Focus. */
const TARGETS =
  'a, button, input, textarea, select, [contenteditable="true"], [role="button"], [role="link"], [data-annotation-id], [data-field], [data-link]';

/** A tap on the page that is not a target leaves Focus (touch, spec 01.14); a disposer. */
export function watchFocusTap(doc: Document = document): () => void {
  const onPointerDown = (event: PointerEvent) => {
    if (event.pointerType !== 'touch' || !useFrameStore.getState().focusMode) return;
    const target = event.target instanceof Element ? event.target : null;
    if (!target?.closest('[data-read-viewport]') || target.closest(TARGETS)) return;
    leaveFocus();
  };
  doc.addEventListener('pointerdown', onPointerDown, true);
  return () => doc.removeEventListener('pointerdown', onPointerDown, true);
}
