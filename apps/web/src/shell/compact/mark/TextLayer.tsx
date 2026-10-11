/**
 * The Text tool's page layer on phones (`design/phone-2026-10/README.md` §4 "Placing a text box
 * opens the keyboard at once"; code-audit §2 "Add text"; ux-references §5 rows 5–8), mounted
 * on each page while editing (`registerCompactOverlay`), beside the annotation layer it serves.
 *
 * - **The keyboard opens in the tap.** iOS shows the keyboard only for a `focus()` made while
 *   the tap is being handled. The annotation layer opens the box on `pointerup` and React
 *   would mount and focus it a moment later; so right after the layer's own `pointerup`
 *   listener this one renders the box at once (`flushSync`) and focuses its field, without a
 *   scroll (`preventScroll`: the reader's scroller keeps it in view, `keyboard.ts`).
 * - **A tap on a box edits it.** With Text armed, a tap on (or within 8 px of) a text box opens
 *   it rather than placing a new one over it. With the tool off (Select), the first tap
 *   selects it, a drag of the selected box moves it (the layer's own move), and a tap on the
 *   selected box opens it, as iOS's "tap again to edit".
 * - **Typing.** While a box on this page is open, the island steps away (`setTyping`, the
 *   capsule's `capsuleAway`) and the keyboard's Done takes its place, a small bar riding on
 *   the keyboard (`--kb-inset`); the box is kept between the top bar and that bar
 *   (`keepInView`). Done, a tap elsewhere or the keyboard's own dismissal commits the box,
 *   and an empty one is dropped (`InlineEditors`).
 */
import { type PageId } from '@pdf-editor/document-model';
import { type RefObject, useEffect, useRef } from 'react';
import { createPortal, flushSync } from 'react-dom';

import { useAnnotationStore } from '../../../annotations/annotation-store';
import { commitOpenEditor } from '../../../annotations/InlineEditors';
import { m } from '../../../i18n';
import type { PageOverlayProps } from '../../../stage/page-overlays';
import { Button } from '../../../ui/Button';
import { setTyping, useCompactStore } from '../compact-store';
import { keepInView } from './keyboard';
import { boxAt, TAP_SLOP } from './text-presets';
import styles from './TextLayer.module.css';

/** The text boxes' hit targets in `layer`, with their boxes on screen. */
function textBoxes(layer: Element) {
  return [...layer.querySelectorAll<SVGElement>('[data-annotation-kind="free-text"]')].map(
    (el) => ({ id: el.dataset.annotationId ?? '', rect: el.getBoundingClientRect() }),
  );
}

/** Renders a just-opened box now and focuses its field, inside the press's own task. */
function focusField(layer: Element): void {
  flushSync(() => undefined);
  const field = layer.querySelector('textarea');
  if (field && document.activeElement !== field) field.focus({ preventScroll: true });
}

/** Runs `onTap` when the press `down` ends where it began. */
function onTapEnd(down: PointerEvent, onTap: () => void): void {
  const end = (up: PointerEvent) => {
    if (up.pointerId !== down.pointerId) return;
    window.removeEventListener('pointerup', end);
    window.removeEventListener('pointercancel', cancel);
    if (Math.hypot(up.clientX - down.clientX, up.clientY - down.clientY) <= TAP_SLOP) onTap();
  };
  const cancel = () => {
    window.removeEventListener('pointerup', end);
    window.removeEventListener('pointercancel', cancel);
  };
  window.addEventListener('pointerup', end);
  window.addEventListener('pointercancel', cancel);
}

export function TextLayer({ sourceId, sourceIndex, pageId, pageIndex }: PageOverlayProps) {
  const anchor = useRef<HTMLSpanElement>(null);
  const typing = useAnnotationStore(
    (s) => s.editor?.kind === 'free-text' && s.editor.target.pageId === pageId,
  );

  useEffect(() => {
    const layer = anchor.current?.parentElement?.querySelector('[data-annotation-layer]');
    if (!(layer instanceof HTMLElement) || sourceId === undefined) return;
    const target = { source: sourceId, pageIndex: sourceIndex, pageId, position: pageIndex + 1 };

    const openBox = (id: string) => {
      const store = useAnnotationStore.getState();
      const a = store.pages[`${sourceId}:${sourceIndex}`]?.annotations.find((x) => x.id === id);
      if (a?.kind !== 'free-text' || a.flags?.locked || store.editor) return;
      store.select(null);
      store.setEditor({
        kind: 'free-text',
        target,
        id: a.id,
        rect: a.rect,
        text: a.text,
        fixedWidth: true,
      });
      focusField(layer);
    };

    const onPointerDown = (event: PointerEvent) => {
      if (!event.isPrimary || event.button !== 0) return;
      const { editing, tool } = useCompactStore.getState();
      if (!editing || (tool !== 'text' && tool !== null)) return;
      const store = useAnnotationStore.getState();
      // A press while a box is open only commits it (the layer's rule).
      if (store.editor) return;
      const hit = boxAt(textBoxes(layer), event.clientX, event.clientY);
      if (tool === null) {
        // Select: the second tap on a selected box opens it; the layer selects and moves.
        const selected = store.selection?.pageId === pageId ? store.selection.ids : [];
        if (hit && selected.includes(hit.id)) onTapEnd(event, () => openBox(hit.id));
        return;
      }
      if (hit) {
        // Text: a tap on a box edits it, never a new box over it.
        event.stopPropagation();
        event.preventDefault();
        onTapEnd(event, () => openBox(hit.id));
        return;
      }
      // A new box: the layer opens it on its own `pointerup` listener, which it adds as this
      // press reaches it; ours goes on after the press has passed the layer (window's bubble
      // phase), so it runs after the layer's. Dropped if the press never gets there.
      const afterLayer = () => {
        window.clearTimeout(drop);
        window.addEventListener('pointerup', onPointerUp, { once: true });
      };
      // A tap or a drag (a box of the dragged width): either opens a box.
      const onPointerUp = () => {
        if (useAnnotationStore.getState().editor) focusField(layer);
      };
      const drop = window.setTimeout(() => window.removeEventListener('pointerdown', afterLayer));
      window.addEventListener('pointerdown', afterLayer, { once: true });
    };
    layer.addEventListener('pointerdown', onPointerDown);
    return () => layer.removeEventListener('pointerdown', onPointerDown);
  }, [sourceId, sourceIndex, pageId, pageIndex]);

  return (
    <>
      <span ref={anchor} hidden />
      {typing ? <TypingBar pageId={pageId} anchor={anchor} /> : null}
    </>
  );
}

TextLayer.displayName = 'TextLayer';

/**
 * The keyboard's Done while a box is open: the island has stepped away; this bar rides on the
 * keyboard (`--kb-inset`) at the trailing edge, where iOS puts its own Done. Its press keeps
 * the focus (and the keyboard) until the click commits the box.
 */
function TypingBar({
  pageId,
  anchor,
}: {
  readonly pageId: PageId;
  readonly anchor: RefObject<HTMLSpanElement | null>;
}) {
  useEffect(() => {
    setTyping(true);
    const field = anchor.current?.parentElement?.querySelector('textarea');
    const stop = field ? keepInView(field) : undefined;
    return () => {
      stop?.();
      setTyping(false);
    };
  }, [anchor, pageId]);

  return createPortal(
    <div
      className={styles.bar}
      role="toolbar"
      aria-label={m.compact_text_bar()}
      data-annotation-keep=""
      data-compact-chrome=""
      data-testid="compact-text-bar"
    >
      <Button
        variant="prominent"
        className={styles.done}
        data-testid="compact-text-done"
        onPointerDown={(event) => event.preventDefault()}
        onClick={() => commitOpenEditor()}
      >
        {m.compact_done()}
      </Button>
    </div>,
    document.body,
  );
}
