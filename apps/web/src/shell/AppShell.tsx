/**
 * The application shell as layers (`components/01-frame.md` F1, §1.1; ADR-0031; redesign spec
 * D2-1). One stage with floating layers, in place of M8's 3 × 3 grid (title bar, rail,
 * inspector, status bar):
 *
 *   page scroller (the stage, `main`) · soft scroll edge · sidebar · inspector (until D2-9) ·
 *   dock band (dock + page pill) · top strip or compact bar · drop overlay
 *   … then, portalled: contextual bars · toasts · sheets · menus and popovers · dialogs ·
 *   tooltips
 *
 * - **The free rectangle** (F1 §2; flows.md §6.2's rest rule): the layers report their boxes and
 *   `useFreeRect` writes `--free-top|right|bottom|left` on `:root`. The stage sits in it, so
 *   every fit, jump and focus lands inside it (A-12), while the reader's scroll container
 *   reaches out under the frame to the window's edges (`stage/stage-bleed.ts`), so pages pass
 *   beneath the glass while scrolling and rest clear of it.
 * - **Size classes** (`size-class.ts`): the top strip from medium up, the compact bar on compact
 *   and compact-height; the sidebar docks from expanded up and lays over the stage on medium.
 *   Density follows the pointer, not the width.
 * - **One backdrop root** (quality-bar Q-3): no layer carries a filter, opacity, mask or
 *   transform between the page and a glass surface; the shell only isolates.
 *
 * Owns the global shortcut listener, F6 between regions (`regions.ts`, X9), window-wide file
 * drops, the appearance settings on the root element, Focus and hide on scroll, and the hosts
 * of sheets and dialogs.
 */
import { type DragEvent, useCallback, useEffect, useRef, useState } from 'react';

import { BatchDialogHost } from '../batch/BatchDialogHost';
import { openDocuments } from '../commands/app-commands';
import { commandRegistry } from '../commands/registry';
import { useShortcuts } from '../commands/use-shortcuts';
import { dragHasFiles, filesFromDataTransfer, isOpenableFile } from '../files/open-files';
import { FurnitureDialogs } from '../furniture';
import { showOpened } from '../home/home-actions';
import { m } from '../i18n';
import { OcrDialogHost } from '../ocr';
import { registerSettingsCommands } from '../settings/settings-commands';
import { SettingsHost } from '../settings/SettingsHost';
import { NewSignatureHost } from '../signatures/NewSignatureHost';
import { useAppearanceRoot } from '../state/appearance-store';
import { useInputPolicyStore } from '../state/input-policy-store';
import { isMarkupOpen, useStageView, useUiStore } from '../state/ui-store';
import { useWorkspaceStore } from '../state/workspace-store';
import { ConfirmHost } from '../ui/sheet';
import { ToastRegion } from '../ui/Toast/ToastRegion';
import { TooltipProvider } from '../ui/Tooltip';
import { registerAppearanceCommands } from './appearance-commands';
import { announce } from './announcer';
import styles from './AppShell.module.css';
import { CommandPalette } from './CommandPalette';
import { CompactTopBar } from './frame/CompactTopBar';
import { DockBand } from './frame/DockBand';
import { DropOverlay } from './frame/DropOverlay';
import { registerFocusCommands, watchFocusTap } from './frame/focus-mode';
import { BAND_OFFSET, BAND_OFFSET_COMPACT, useFreeRect } from './frame/frame-insets';
import { setSidebarOverlay, showOverlaySidebar, useFrameStore } from './frame/frame-store';
import { useHideOnScroll } from './frame/hide-on-scroll';
import { ReplacePopover } from './frame/ReplacePopover';
import { useRegionCycling } from './frame/regions';
import { useSizeClass } from './frame/size-class';
import { SoftEdge } from './frame/SoftEdge';
import { TopStrip } from './frame/TopStrip';
import { LeftRail } from './LeftRail';
import { LiveRegion } from './LiveRegion';
import { PasswordDialog } from './PasswordDialog';
import { RightPanel } from './RightPanel';
import { ShortcutOverlay } from './ShortcutOverlay';
import { Stage } from './Stage';

export function AppShell() {
  useShortcuts();
  const [dragging, setDragging] = useState(false);
  // dragenter/dragleave fire for every child crossed; count depth to avoid flicker.
  const depth = useRef(0);
  const shellRef = useRef<HTMLDivElement>(null);
  // F6 / Shift+F6 between the regions (spec X9).
  useRegionCycling();
  useAppearanceRoot();
  useEffect(() => registerAppearanceCommands(commandRegistry), []);
  // Settings… (Mod+,) and the commands that open the Settings sheet at a row (D0-10).
  useEffect(() => registerSettingsCommands(commandRegistry), []);
  // F and the Esc rung for Focus (F13), after `selection.clear` in the Esc ladder.
  useEffect(() => registerFocusCommands(commandRegistry), []);
  useEffect(() => watchFocusTap(), []);

  const frame = useSizeClass();
  const compact = frame.size === 'compact' || frame.short;
  const focus = useFrameStore((s) => s.focusMode);
  const view = useStageView();
  useFreeRect(shellRef, {
    sidebarDocked: !compact && frame.size !== 'medium',
    offset: compact ? BAND_OFFSET_COMPACT : BAND_OFFSET,
    focus,
  });

  // The sidebar is laid over the page on medium and compact-height (F1 §2): it shows once asked
  // for in this window, by ▤ or Mod+B or by any route that opens it or changes its view.
  const sidebarOverlay = frame.size === 'medium' || frame.short;
  useEffect(() => setSidebarOverlay(sidebarOverlay), [sidebarOverlay]);
  useEffect(
    () =>
      useUiStore.subscribe((now, before) => {
        if (!now.leftPanelOpen) return;
        if (!before.leftPanelOpen || now.leftPanelView !== before.leftPanelView) {
          showOverlaySidebar(true);
        }
      }),
    [],
  );

  // Hide on scroll: compact classes, viewing only (F12).
  const hideBlocked = useCallback(() => {
    const ui = useUiStore.getState();
    const id = useWorkspaceStore.getState().workspace.activeDocument;
    return (
      ui.destination !== 'document' ||
      view !== 'page' ||
      isMarkupOpen(ui, id) ||
      useInputPolicyStore.getState().keepToolsVisible
    );
  }, [view]);
  useHideOnScroll(compact && view === 'page', hideBlocked);

  const onDragEnter = (event: DragEvent) => {
    if (!dragHasFiles(event.dataTransfer)) return;
    event.preventDefault();
    depth.current += 1;
    setDragging(true);
  };
  const onDragOver = (event: DragEvent) => {
    if (!dragHasFiles(event.dataTransfer)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
  };
  const onDragLeave = (event: DragEvent) => {
    if (!dragHasFiles(event.dataTransfer)) return;
    depth.current = Math.max(0, depth.current - 1);
    if (depth.current === 0) setDragging(false);
  };
  const onDrop = (event: DragEvent) => {
    if (!dragHasFiles(event.dataTransfer)) return;
    event.preventDefault();
    depth.current = 0;
    setDragging(false);
    // Light-table sections insert dropped files at the drop point themselves.
    if (event.target instanceof Element && event.target.closest('[data-file-drop-zone]')) return;
    // filesFromDataTransfer reads the items synchronously, before its first await.
    void filesFromDataTransfer(event.dataTransfer, isOpenableFile).then(async (files) => {
      if (files.length === 0) {
        announce(m.drop_no_pdfs());
        return;
      }
      // Two or more files dropped on an empty workspace, or any dropped on Home: Home with
      // the new cards selected (experience-redesign §3).
      const wasEmpty = useWorkspaceStore.getState().workspace.documentOrder.length === 0;
      showOpened(await openDocuments(files), { wasEmpty });
    });
  };

  return (
    <TooltipProvider>
      <div
        ref={shellRef}
        className={styles.shell}
        data-testid="app-shell"
        data-stage-bleed=""
        data-frame={compact ? 'compact' : 'strip'}
        data-focus-mode={focus || undefined}
        onDragEnter={onDragEnter}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
      >
        <Stage dragging={dragging} />
        {view === 'page' ? <SoftEdge /> : null}
        {/* Compact windows keep the sidebar in the phone Pages sheet (M10, ADR-0033): none here;
            compact-height lays it over the stage (▤ in the bar, spec 01.7). */}
        {frame.tight || (frame.size === 'compact' && !frame.short) ? null : (
          <LeftRail overlay={sidebarOverlay} />
        )}
        <RightPanel />
        <DockBand size={frame.size} compact={compact} tight={frame.tight} />
        {compact || frame.tight ? (
          <CompactTopBar short={frame.short} tight={frame.tight} />
        ) : (
          <TopStrip />
        )}
        {dragging && view === 'page' ? <DropOverlay /> : null}
      </div>
      <CommandPalette />
      <ShortcutOverlay />
      <SettingsHost />
      <NewSignatureHost />
      <PasswordDialog />
      <ConfirmHost />
      <BatchDialogHost />
      <OcrDialogHost />
      <FurnitureDialogs />
      <ReplacePopover />
      <ToastRegion />
      <LiveRegion />
    </TooltipProvider>
  );
}
