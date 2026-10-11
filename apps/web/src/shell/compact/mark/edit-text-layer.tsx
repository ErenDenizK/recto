/**
 * Edit text's page layer on phones (EDN-17; `design/phone-2026-10/README.md` §4; code-audit §2
 * "Edit text", §4c), its own chunk, loaded as the tool arms (`edit-text.tsx`). It opens the full
 * edition's paragraph editor unchanged (`ParagraphEditLayer`, `ParagraphEditor`, the store and
 * the commit in `text-edit/`): a commit is one history entry, which the island's Undo takes back.
 *
 * - **A tap on a paragraph** opens it, the caret nearest the finger (`openParagraphEditor`). The
 *   targets are the page's detected paragraphs (`pageParagraphs`, asked for while the tool is
 *   armed and the page shows), a finger-sized whole rather than the full edition's line runs; a
 *   paragraph that refuses paragraph mode says why in the editor's header. The line editor
 *   (`TextEditLayer`, `TextEditor`) stays the computer's: the phone's chunk never loads it.
 * - **The keyboard rises in the tap.** The finger's tap focuses the stand-in in its own
 *   `pointerup` (`keyboard-hold.ts`), so iOS raises the keyboard; the mirror takes the focus from
 *   it once the paragraph is laid out, and it is set in 16 px at least, so iOS never zooms the
 *   page for it (`setParagraphEditorEdition`).
 * - **Typing.** While a paragraph is open on this page the island steps away (`setTyping`, as for
 *   a text box, EDN-12) and Done rides on the keyboard (`--kb-inset`); the paragraph is kept
 *   between the top bar and Done (`keepInView`), and the editor's header is placed in the free
 *   rectangle `keyboard.ts` writes. Done's press is a press outside the editor, which leaves it
 *   and commits, or asks first when the text would run into what follows (the choice's buttons
 *   are 44 px on a phone).
 * - **Leaving the tool** (another tool, the chip off, Done on the island) closes the editor,
 *   which commits its change as it goes (the full edition's rule, `text-edit/index.ts`, which
 *   the phone does not load: it brings the line editor).
 * - **`openAt`**, the selection bar's Edit text: the paragraph at a point of the page.
 */
import type { PageId, SourceId } from '@pdf-editor/document-model';
import type { ParagraphBlock } from '@pdf-editor/engine';
import { type RefObject, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import type { PageTarget } from '../../../annotations/annotation-store';
import { cssPointToUser, rectToCss } from '../../../annotations/geometry';
import { penSession } from '../../../annotations/pen/ink-input';
import { m } from '../../../i18n';
import type { PageOverlayProps } from '../../../stage/page-overlays';
import { ParagraphEditLayer, setParagraphEditorEdition } from '../../../text-edit/ParagraphEditor';
import { openParagraphEditor } from '../../../text-edit/paragraph-open';
import { usePageRevision } from '../../../text-edit/runs';
import { pageParagraphs, useTextEditStore } from '../../../text-edit/text-edit-store';
import { Button } from '../../../ui/Button';
import type { PageFrame } from '../../../viewer/geometry';
import { pageFrame } from '../../../viewer/page-frame';
import { useToolStore } from '../../../viewer/tool-store';
import { setTyping, useCompactStore } from '../compact-store';
import { keepInView, keyboardState, watchKeyboard } from './keyboard';
import { holdKeyboard, isHoldingKeyboard, keepHolding, releaseKeyboard } from './keyboard-hold';
import { FIELD_MIN_PX, TAP_SLOP } from './text-presets';
import styles from './TextLayer.module.css';

setParagraphEditorEdition({
  minMirrorPx: FIELD_MIN_PX,
  hint: () => m.compact_edit_text_paragraph_hint(),
});

/** How long a held keyboard waits for an editor to open, ms (a cold paragraph on a phone). */
export const OPEN_WAIT_MS = 8000;
/** Frames `openAt` waits for the page's layer to mount after editing began. */
const MOUNT_FRAMES = 20;
/** A tap this close to a paragraph's box (CSS px) still takes it: a fingertip's slack. */
export const PARAGRAPH_SLOP_PX = 8;

/** When a paragraph editor last opened (performance.now()). */
let lastOpened = Number.NEGATIVE_INFINITY;

useTextEditStore.subscribe((state, previous) => {
  if (state.paragraph !== null) {
    if (previous.paragraph === null) lastOpened = performance.now();
    return;
  }
  // Closed: a keyboard still held for it goes (the editor never took the focus).
  if (previous.paragraph !== null && isHoldingKeyboard()) releaseKeyboard();
});

// Leaving the tool closes the editor; unmounting, it commits its change (`ParagraphEditor`).
useToolStore.subscribe((state, previous) => {
  if (state.mode !== previous.mode && state.mode !== 'edit-text') {
    useTextEditStore.getState().closeParagraph();
  }
});

/** While the held keyboard waits: an editor is open, or one may still open. */
function waitFor(since: number): () => boolean {
  const until = since + OPEN_WAIT_MS;
  return () =>
    useTextEditStore.getState().paragraph !== null ||
    (lastOpened < since && performance.now() < until);
}

/** The detected paragraph (not refusing paragraph mode) whose box holds `local`, CSS px. */
export function paragraphAt(
  blocks: readonly ParagraphBlock[],
  frame: PageFrame,
  local: { readonly x: number; readonly y: number },
  slop: number = PARAGRAPH_SLOP_PX,
): ParagraphBlock | undefined {
  let best: ParagraphBlock | undefined;
  let bestDistance = slop;
  for (const block of blocks) {
    if (block.refusal) continue;
    const box = rectToCss(frame, block.box);
    const dx = Math.max(box.left - local.x, 0, local.x - (box.left + box.width));
    const dy = Math.max(box.top - local.y, 0, local.y - (box.top + box.height));
    const distance = Math.hypot(dx, dy);
    if (distance <= bestDistance) {
      best = block;
      bestDistance = distance;
      if (distance === 0) break;
    }
  }
  return best;
}

/** Runs `onTap` at the lift of a press that stayed within the slop. */
function onTapEnd(down: PointerEvent, onTap: () => void): void {
  const stop = () => {
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', up);
    window.removeEventListener('pointercancel', stop);
  };
  const move = (event: PointerEvent) => {
    if (event.pointerId !== down.pointerId) return;
    if (Math.hypot(event.clientX - down.clientX, event.clientY - down.clientY) > TAP_SLOP) stop();
  };
  const up = (event: PointerEvent) => {
    if (event.pointerId !== down.pointerId) return;
    stop();
    onTap();
  };
  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', up);
  window.addEventListener('pointercancel', stop);
}

interface PageEntry {
  readonly container: HTMLElement;
  readonly target: PageTarget;
  readonly frame: () => PageFrame;
}

/** The mounted pages, for `openAt`. */
const pages = new Set<PageEntry>();

function pageAt(at: { readonly x: number; readonly y: number }): PageEntry | undefined {
  for (const entry of pages) {
    const r = entry.container.getBoundingClientRect();
    if (at.x >= r.left && at.x <= r.right && at.y >= r.top && at.y <= r.bottom) return entry;
  }
  return undefined;
}

const nextFrame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

/** Opens the paragraph of `entry`'s page at `at` (client px); false when none is there. */
async function openOnPage(
  entry: PageEntry,
  at: { readonly x: number; readonly y: number },
): Promise<boolean> {
  const box = entry.container.getBoundingClientRect();
  const local = { x: at.x - box.left, y: at.y - box.top };
  const frame = entry.frame();
  let blocks: readonly ParagraphBlock[];
  try {
    blocks = await pageParagraphs(entry.target.source, entry.target.pageIndex);
  } catch {
    return false;
  }
  const block = paragraphAt(blocks, frame, local);
  if (!block) return false;
  return openParagraphEditor(entry.target, block.ref, cssPointToUser(frame, local));
}

/**
 * Opens the paragraph at `at` (client px), the caret there. A keyboard held for it (the
 * selection bar's press) waits for it, and goes when nothing opens.
 */
export async function openAt(at: { readonly x: number; readonly y: number }): Promise<void> {
  keepHolding(waitFor(performance.now()));
  let entry = pageAt(at);
  for (let i = 0; !entry && i < MOUNT_FRAMES; i++) {
    await nextFrame();
    entry = pageAt(at);
  }
  if (!entry || !(await openOnPage(entry, at))) releaseKeyboard();
}

/** The page's detected paragraphs while `source` is given (null until they are known). */
function useParagraphs(
  source: SourceId | undefined,
  pageIndex: number,
  revision: number,
): readonly ParagraphBlock[] | null {
  const key = source === undefined ? '' : `${source}:${pageIndex}:${revision}`;
  const [known, setKnown] = useState<{
    readonly key: string;
    readonly blocks: readonly ParagraphBlock[];
  } | null>(null);
  useEffect(() => {
    if (source === undefined) return;
    let live = true;
    pageParagraphs(source, pageIndex).then(
      (blocks) => {
        if (live) setKnown({ key, blocks });
      },
      () => {
        if (live) setKnown({ key, blocks: [] });
      },
    );
    return () => {
      live = false;
    };
  }, [source, pageIndex, key]);
  return known?.key === key ? known.blocks : null;
}

export function EditTextLayers(props: PageOverlayProps) {
  const { pageId, pageIndex, sourceId, sourceIndex, visible } = props;
  const anchor = useRef<HTMLSpanElement>(null);
  const armed = useToolStore((s) => s.mode === 'edit-text');
  const open = useTextEditStore((s) => s.paragraph?.target.pageId === pageId);
  const revision = usePageRevision(sourceId, sourceIndex);
  const blocks = useParagraphs(armed && visible ? sourceId : undefined, sourceIndex, revision);
  const frame = pageFrame(props);
  const latest = useRef({ frame, blocks });
  useLayoutEffect(() => {
    latest.current = { frame, blocks };
  });

  useEffect(() => {
    const container = anchor.current?.parentElement;
    if (!container || sourceId === undefined) return;
    const target: PageTarget = {
      source: sourceId,
      pageIndex: sourceIndex,
      pageId,
      position: pageIndex + 1,
    };
    const entry: PageEntry = { container, target, frame: () => latest.current.frame };
    pages.add(entry);

    // A tap on a paragraph with Edit text armed opens it. A finger's tap holds the keyboard
    // in its own `pointerup`; with a pen seen, fingers pan and only the pen taps. Before the
    // page's paragraphs are known, a tap on the page holds the keyboard on the chance, and lets
    // it go if no paragraph is there once they are.
    const onPointerDown = (event: PointerEvent) => {
      if (!event.isPrimary || event.button !== 0) return;
      if (!useCompactStore.getState().editing || useToolStore.getState().mode !== 'edit-text') {
        return;
      }
      const touch = event.pointerType === 'touch';
      if (touch && penSession().penSeen) return;
      const element = event.target;
      // The open editor takes its own presses (its canvas places the caret).
      if (element instanceof Element && element.closest('[data-paragraph-editor]')) return;
      const { blocks: known, frame: now } = latest.current;
      const box = container.getBoundingClientRect();
      const local = { x: event.clientX - box.left, y: event.clientY - box.top };
      const block = known ? paragraphAt(known, now, local) : undefined;
      if (known && !block) return;
      // No compatibility mouse events: their mousedown would move the focus to the pages after
      // the stand-in took it (scrolling follows `touch-action`, not this).
      event.preventDefault();
      const at = { x: event.clientX, y: event.clientY };
      onTapEnd(event, () => {
        if (touch) holdKeyboard(at, waitFor(performance.now()));
        const opening = block
          ? openParagraphEditor(target, block.ref, cssPointToUser(now, local))
          : openOnPage(entry, at);
        void opening.then((ok) => {
          if (!ok && isHoldingKeyboard()) releaseKeyboard();
        });
      });
    };
    container.addEventListener('pointerdown', onPointerDown);
    return () => {
      pages.delete(entry);
      container.removeEventListener('pointerdown', onPointerDown);
    };
  }, [sourceId, sourceIndex, pageId, pageIndex]);

  return (
    <>
      <span ref={anchor} hidden />
      <ParagraphEditLayer {...props} />
      {open ? <EditBar pageId={pageId} anchor={anchor} /> : null}
    </>
  );
}

EditTextLayers.displayName = 'EditTextLayers';

/**
 * Done while a paragraph is open on the page: the island has stepped away and this bar rides
 * on the keyboard (the text box's, `TextLayer.module.css`). Its press is a press outside the
 * editor, which leaves it (`ParagraphEditor`), and keeps the focus, with the keyboard, while
 * the paragraph commits.
 */
function EditBar({
  pageId,
  anchor,
}: {
  readonly pageId: PageId;
  readonly anchor: RefObject<HTMLSpanElement | null>;
}) {
  useEffect(() => {
    setTyping(true);
    const mirror =
      anchor.current?.parentElement?.querySelector<HTMLElement>('[data-paragraph-mirror]');
    const stop = mirror ? keepInView(mirror) : undefined;
    // The editor places its header in the free rectangle on the reader's scroll and the
    // window's resize (`ParagraphEditor`); iOS's keyboard is neither, only the visual viewport
    // changes, so a new keyboard height nudges it with a scroll event of the reader.
    const scroller = mirror?.closest<HTMLElement>('[data-read-viewport]');
    let inset = keyboardState().inset;
    const unwatch = watchKeyboard((state) => {
      if (state.inset === inset) return;
      inset = state.inset;
      scroller?.dispatchEvent(new Event('scroll'));
    });
    return () => {
      unwatch();
      stop?.();
      setTyping(false);
    };
  }, [anchor, pageId]);

  return createPortal(
    <div
      className={styles.bar}
      role="toolbar"
      aria-label={m.compact_edit_text_bar()}
      data-compact-chrome=""
      data-testid="compact-edit-text-bar"
    >
      <Button
        variant="prominent"
        className={styles.done}
        data-testid="compact-edit-text-done"
        onPointerDown={(event) => event.preventDefault()}
      >
        {m.compact_done()}
      </Button>
    </div>,
    document.body,
  );
}
