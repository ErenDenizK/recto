/**
 * The trailing page scrubber (05-canvas §5, spec 05.1, D2-10; M-15; flows.md §6.3, J2): on a
 * coarse pointer, for a document of more than 20 pages, a thumb at the trailing edge of the
 * free rectangle that shows while the pages scroll and takes a finger to any page in one drag
 * (J2 touch: page 7 of a long file is one step).
 *
 * - **Shown** 0 → 1 over `--duration-fast` on a scroll; hidden 1.5 s after the last one, never
 *   while dragged or focused. At rest it is hidden and takes no pointer. Fine pointers keep
 *   `ScrollProxies` and never see it.
 * - **Position.** The thumb travels the free rectangle's height (the page view's frame) at the
 *   scroll position's fraction, moved by `transform` on scroll without a render.
 * - **Drag.** The thumb follows the finger; the page under it is shown at once (a jump through
 *   the view store, no smooth scroll) and its number is the label. Release leaves the view on
 *   that page and the thumb where its scroll position puts it.
 * - **Keys.** As a vertical `slider`: arrows step one page, Page Up and Page Down ten, Home and
 *   End the ends. Named "Scrub pages", valued "Page {n} of {total}".
 *
 * Material: Q-5 (a small moving part never blurs) overrides the spec's M1 glass, so the thumb is
 * solid (`--glass-solid`, the Solid rendering of M1) with the glass hairline and e2 shadow.
 */
import type { VirtualDocument } from '@pdf-editor/document-model';
import {
  type KeyboardEvent,
  type PointerEvent,
  type RefObject,
  useEffect,
  useRef,
  useState,
} from 'react';

import { m } from '../i18n';
import { usePointerCapabilities } from '../shell/frame/input-modality';
import { useViewStore } from '../state/view-store';
import styles from './PageScrubber.module.css';

/** The scrubber shows for documents of more pages than this (05-canvas §5). */
export const SCRUBBER_MIN_PAGES = 20;
/** It hides this long after the last scroll. */
export const SCRUBBER_LINGER_MS = 1500;
/** Page Up and Page Down on the thumb move this many pages. */
const PAGE_STEP = 10;

/** The page at `fraction` (0 = top, 1 = bottom) of a document of `total` pages. */
export function pageAtFraction(fraction: number, total: number): number {
  return Math.min(total - 1, Math.max(0, Math.round(fraction * (total - 1))));
}

interface Parts {
  readonly track: RefObject<HTMLDivElement | null>;
  readonly thumb: RefObject<HTMLDivElement | null>;
  /** A drag in progress. */
  readonly drag: RefObject<{ pointerId: number; grab: number; page: number } | null>;
  readonly hideTimer: RefObject<number>;
}

/** Room the thumb travels in, CSS px. */
function travelOf({ track, thumb }: Parts): number {
  return track.current && thumb.current
    ? Math.max(0, track.current.clientHeight - thumb.current.offsetHeight)
    : 0;
}

/** Moves the thumb `offset` px down the track, on whole device pixels (Q-2). */
function place({ thumb }: Parts, offset: number): void {
  if (!thumb.current) return;
  const dpr = window.devicePixelRatio || 1;
  thumb.current.style.transform = `translateY(${Math.round(offset * dpr) / dpr}px)`;
}

/** Places the thumb at `viewport`'s scroll fraction. */
function follow(parts: Parts, viewport: HTMLElement): void {
  const range = viewport.scrollHeight - viewport.clientHeight;
  place(parts, range > 0 ? (viewport.scrollTop / range) * travelOf(parts) : 0);
}

function show({ track }: Parts, shown: boolean): void {
  track.current?.toggleAttribute('data-shown', shown);
}

/** Hides the scrubber after the linger, unless it is dragged or focused then. */
function hideLater(parts: Parts): void {
  window.clearTimeout(parts.hideTimer.current);
  parts.hideTimer.current = window.setTimeout(() => {
    if (parts.drag.current || parts.track.current?.contains(document.activeElement)) return;
    show(parts, false);
  }, SCRUBBER_LINGER_MS);
}

/** The scrubber where the device and the document call for it (module header). */
export function PageScrubber({
  doc,
  viewport,
}: {
  readonly doc: VirtualDocument;
  /** The page view's scroll container. */
  readonly viewport: HTMLElement | null;
}) {
  const { primary } = usePointerCapabilities();
  if (primary !== 'coarse' || doc.pages.length <= SCRUBBER_MIN_PAGES || !viewport) return null;
  return <Scrubber doc={doc} viewport={viewport} />;
}

function Scrubber({
  doc,
  viewport,
}: {
  readonly doc: VirtualDocument;
  readonly viewport: HTMLElement;
}) {
  const total = doc.pages.length;
  const current = useViewStore((s) => s.currentPage);
  const scrollToPage = useViewStore((s) => s.scrollToPage);
  const trackRef = useRef<HTMLDivElement>(null);
  const thumbRef = useRef<HTMLDivElement>(null);
  /** The page under a dragging finger, or null. */
  const [dragged, setDragged] = useState<number | null>(null);
  const dragRef = useRef<{ pointerId: number; grab: number; page: number } | null>(null);
  const hideTimer = useRef(0);
  const parts: Parts = { track: trackRef, thumb: thumbRef, drag: dragRef, hideTimer };

  // Follow the scroll: shown, placed at the scroll fraction, hidden after a pause.
  useEffect(() => {
    const p: Parts = { track: trackRef, thumb: thumbRef, drag: dragRef, hideTimer };
    const onScroll = () => {
      show(p, true);
      hideLater(p);
      if (!p.drag.current) follow(p, viewport);
    };
    viewport.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      viewport.removeEventListener('scroll', onScroll);
      window.clearTimeout(p.hideTimer.current);
    };
  }, [viewport]);

  const jump = (index: number) => {
    const page = doc.pages[Math.min(total - 1, Math.max(0, index))];
    if (page) scrollToPage(page.id);
  };

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    const thumb = thumbRef.current;
    if (!thumb || event.button !== 0) return;
    event.preventDefault();
    thumb.setPointerCapture(event.pointerId);
    const top = thumb.getBoundingClientRect().top;
    dragRef.current = { pointerId: event.pointerId, grab: event.clientY - top, page: current };
    setDragged(current);
    show(parts, true);
  };
  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const d = dragRef.current;
    const track = trackRef.current;
    if (d?.pointerId !== event.pointerId || !d || !track) return;
    const room = travelOf(parts);
    const offset = Math.min(
      room,
      Math.max(0, event.clientY - track.getBoundingClientRect().top - d.grab),
    );
    place(parts, offset);
    const page = pageAtFraction(room > 0 ? offset / room : 0, total);
    if (page === d.page) return;
    d.page = page;
    setDragged(page);
    jump(page);
  };
  const onPointerEnd = (event: PointerEvent<HTMLDivElement>) => {
    const d = dragRef.current;
    if (d?.pointerId !== event.pointerId) return;
    dragRef.current = null;
    setDragged(null);
    // Back to where the scroll position puts the thumb, on the page it left.
    follow(parts, viewport);
    hideLater(parts);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const steps: Record<string, number> = {
      ArrowDown: 1,
      ArrowRight: 1,
      ArrowUp: -1,
      ArrowLeft: -1,
      PageDown: PAGE_STEP,
      PageUp: -PAGE_STEP,
    };
    let target: number | undefined;
    if (event.key === 'Home') target = 0;
    else if (event.key === 'End') target = total - 1;
    else if (steps[event.key] !== undefined) target = current + (steps[event.key] ?? 0);
    if (target === undefined) return;
    event.preventDefault();
    event.stopPropagation();
    jump(target);
  };

  const shown = dragged ?? current;
  return (
    <div ref={trackRef} className={styles.track} data-testid="page-scrubber">
      <div
        ref={thumbRef}
        className={styles.thumb}
        role="slider"
        tabIndex={0}
        aria-label={m.scrubber_label()}
        aria-orientation="vertical"
        aria-valuemin={1}
        aria-valuemax={total}
        aria-valuenow={shown + 1}
        aria-valuetext={m.status_page_of({ current: shown + 1, total })}
        data-dragging={dragged === null ? undefined : ''}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
        onKeyDown={onKeyDown}
        onFocus={() => show(parts, true)}
        onBlur={() => hideLater(parts)}
      >
        <span className={styles.label}>{shown + 1}</span>
      </div>
    </div>
  );
}
