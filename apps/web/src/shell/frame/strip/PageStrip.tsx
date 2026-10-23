/**
 * The page strip (R26 concept 1, DSN-63; `?strip=1`): holding or sliding on the page pill (the
 * phone's "4 / 6" in the capsule) opens a glass strip of every page out of it; thumbs lie along
 * it, a solid enlarged preview follows the page under the finger, and letting go jumps there.
 * A tap keeps opening the menu (DSN-29). Loaded at the first press on the trigger
 * (`strip-hold.ts`), so none of it is in the editor's first load.
 *
 * - **Where:** on desktop and tablet a strip 12 px above the pill, its right edge on the pill's;
 *   on the phone a rail on the right edge. The page under the pointer is the one its thumb
 *   shows; the pointer takes over once it has left the trigger for the strip's run, so the
 *   press itself never moves the page (`engaged`). Pages that do not fit are scaled over the
 *   run (`strip-model.ts`); the track scrolls to keep the scrubbed page mid-strip.
 * - **Marks:** the scrubbed page rises 8 px with a lime ring (DSN-19: selected is lime), the
 *   page being read keeps the neutral ring and a 600 label (current is neutral), both when
 *   both hold. The preview is solid, never glass (Q-5: a small moving part), and the pill's
 *   number rolls with the scrub (`stripPreview`).
 * - **Motion:** the strip comes out of the pill's rect on `quick` and goes back on it (MOT-3,
 *   MOT-5, MOT-9), the track follows the pointer on `quick`, the rise is a CSS spring. Under
 *   reduced motion nothing travels: the strip, preview and track only fade or cut (§7.5).
 * - **Cost (Q-11, 500-page documents):** only cells within the track's window exist
 *   (`visibleRange`), and only those within the scrubbed page's window draw a bitmap, at the
 *   shared thumbnail bucket, on demand; cells in between are bare sheets while the track flies.
 * - **Keys:** a listbox. ArrowUp on the trigger opens it; arrows, Home, End, PageUp and
 *   PageDown move; Enter or Space goes; Esc or Tab closes; focus returns to the trigger.
 * - **Glass budget (Q-11):** the strip is the popover's M4 glass and open only while held; the
 *   pill beside it stays as it is, so the count of a moment is at most five.
 */
import {
  getActiveDocument,
  type VirtualDocument,
  type Workspace,
} from '@pdf-editor/document-model';
import { type CSSProperties, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import { createRoot } from 'react-dom/client';

import { formatNumber, m } from '../../../i18n';
import { animate, type Motion } from '../../../motion/animate';
import { reducedMotion } from '../../../motion/reduced-motion';
import { clamp } from '../../../motion/velocity';
import { PageCanvas } from '../../../pages/PageCanvas';
import { displaySize, fitInBox } from '../../../pages/page-geometry';
import { RENDER_PRIORITY } from '../../../engine/engine-service';
import { useViewStore } from '../../../state/view-store';
import { useWorkspaceStore } from '../../../state/workspace-store';
import { documentLabels, goToPageIndex } from '../../../viewer/navigation';
import { setStripPreview, type StripInit, type StripSession } from './strip-hold';
import { keyTarget, pageAtPointer, trackOffset, visibleRange } from './strip-model';
import styles from './PageStrip.module.css';

/** Where the strip is and how big its parts are, for one axis. */
interface Layout {
  readonly axis: 'x' | 'y';
  /** An item's cell along the axis, and the thumbnail box inside it. */
  readonly pitch: number;
  readonly thumb: { readonly w: number; readonly h: number };
  /** The run the track shows, its start in client px along the axis. */
  readonly length: number;
  readonly innerStart: number;
  readonly box: {
    readonly left: number;
    readonly top: number;
    readonly width: number;
    readonly height: number;
  };
  readonly preview: { readonly w: number; readonly h: number };
  readonly trigger: DOMRect;
}

const GAP = 12;

function layoutFor(init: StripInit, count: number): Layout {
  const trigger = init.trigger.getBoundingClientRect();
  if (init.axis === 'x') {
    const pitch = 70;
    const thumb = { w: 60, h: 84 };
    const max = Math.min(840, trigger.right - 16 - 32);
    const length = Math.max(pitch, Math.min(count * pitch, max));
    const width = length + 32;
    const height = 14 + thumb.h + 30;
    const left = trigger.right - width;
    const top = trigger.top - GAP - height;
    return {
      axis: 'x',
      pitch,
      thumb,
      length,
      innerStart: left + 16,
      box: { left, top, width, height },
      preview: { w: 200, h: 290 },
      trigger,
    };
  }
  const pitch = 64;
  const thumb = { w: 40, h: 56 };
  const top = 72;
  const max = innerHeight - top - 120 - 16;
  const length = Math.max(pitch, Math.min(count * pitch, max));
  const width = 52;
  const left = innerWidth - 6 - width;
  return {
    axis: 'y',
    pitch,
    thumb,
    length,
    innerStart: top + 8,
    box: { left, top, width, height: length + 16 },
    preview: { w: 150, h: 216 },
    trigger,
  };
}

interface Snapshot {
  readonly index: number;
  readonly closing: boolean;
}

/** One strip in flight: the scrub state the view reads and the pointer and keys write. */
function control(init: StripInit, doc: VirtualDocument, ws: Workspace): StripSession {
  const count = doc.pages.length;
  const current = Math.min(count - 1, Math.max(0, useViewStore.getState().currentPage));
  const layout = layoutFor(init, count);
  const labels = documentLabels(ws, doc);
  const host = document.createElement('div');
  host.className = styles.host ?? '';
  document.body.append(host);
  const root = createRoot(host);

  let snapshot: Snapshot = { index: current, closing: false };
  const listeners = new Set<() => void>();
  const subscribe = (listener: () => void) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  };
  const update = (next: Partial<Snapshot>) => {
    snapshot = { ...snapshot, ...next };
    for (const listener of listeners) listener();
  };
  const select = (index: number) => {
    const next = clamp(index, 0, count - 1);
    if (next === snapshot.index) return;
    setStripPreview(next);
    update({ index: next });
  };
  /** The pointer has left the trigger for the strip's run: from now on it picks the page. */
  let engaged = !init.pointer;
  const screenful = Math.max(1, Math.floor(layout.length / layout.pitch));

  const finish = () => {
    removeEventListener('keydown', onKey, true);
    removeEventListener('pointerdown', onPointer, true);
    removeEventListener('contextmenu', stopMenu, true);
    setStripPreview(null);
    init.trigger.focus({ preventScroll: true });
    update({ closing: true });
  };
  const dispose = () => {
    root.unmount();
    host.remove();
  };
  const release = () => {
    if (snapshot.closing) return;
    const target = snapshot.index;
    finish();
    if (target !== current) goToPageIndex(target, doc, 'jump');
  };
  const cancel = () => {
    if (!snapshot.closing) finish();
  };
  function onKey(event: KeyboardEvent) {
    if (event.key === 'Escape' || event.key === 'Tab') {
      if (event.key === 'Escape') event.preventDefault();
      event.stopPropagation();
      cancel();
      return;
    }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      event.stopPropagation();
      release();
      return;
    }
    const target = keyTarget(event.key, snapshot.index, count, screenful);
    if (target === null) return;
    event.preventDefault();
    event.stopPropagation();
    engaged = true;
    select(target);
  }
  function onPointer(event: PointerEvent) {
    // A strip opened from the keyboard is a menu to click: a cell goes, anywhere else closes.
    const cell = (event.target as Element | null)?.closest<HTMLElement>('[role="option"]');
    if (cell?.dataset.index === undefined) {
      cancel();
      return;
    }
    event.preventDefault();
    select(Number(cell.dataset.index));
    release();
  }
  function stopMenu(event: Event) {
    event.preventDefault();
  }
  addEventListener('keydown', onKey, true);
  addEventListener('contextmenu', stopMenu, true);
  if (!init.pointer) addEventListener('pointerdown', onPointer, true);

  const element = (
    <StripView
      layout={layout}
      doc={doc}
      ws={ws}
      labels={labels}
      current={current}
      subscribe={subscribe}
      get={() => snapshot}
      onGone={dispose}
    />
  );
  root.render(element);
  setStripPreview(current);

  return {
    move(x, y) {
      if (snapshot.closing || !init.pointer) return;
      const pos = layout.axis === 'x' ? x : y;
      const t = layout.trigger;
      const onTrigger = x >= t.left && x <= t.right && y >= t.top && y <= t.bottom;
      const inRun = pos >= layout.innerStart && pos <= layout.innerStart + layout.length;
      if (!onTrigger && inRun) engaged = true;
      if (engaged)
        select(pageAtPointer(pos, layout.innerStart, layout.length, count, layout.pitch));
    },
    release,
    cancel,
  };
}

const NONE: StripSession = {
  move: () => undefined,
  release: () => undefined,
  cancel: () => undefined,
};

/** Opens the strip for the active document; the press or key that asked for it drives it. */
export function openPageStrip(init: StripInit): StripSession {
  const ws = useWorkspaceStore.getState().workspace;
  const doc = getActiveDocument(ws);
  if (!doc || doc.pages.length === 0) return NONE;
  return control(init, doc, ws);
}

/** Paints the open state: `p` 0 is the trigger's rect, 1 the strip. */
function paintOpen(strip: HTMLElement, preview: HTMLElement, layout: Layout, p: number): void {
  const done = p >= 0.999;
  preview.style.opacity = done ? '' : String(clamp(p, 0, 1));
  if (done) {
    for (const property of ['opacity', 'transform', 'clip-path'])
      strip.style.removeProperty(property);
    return;
  }
  strip.style.opacity = String(clamp(p * 2, 0, 1));
  if (reducedMotion()) return;
  const { box, trigger } = layout;
  // A slice of the strip the pill's size at the corner nearest the pill, laid over the pill,
  // that opens to the whole strip while it slides home (MOT-3, MOT-5).
  const sliceW = Math.min(box.width, trigger.width);
  const sliceH = Math.min(box.height, trigger.height);
  const sliceLeft = box.width - sliceW;
  const sliceTop = box.height - sliceH;
  const q = 1 - p;
  const dx = trigger.left - (box.left + sliceLeft);
  const dy = trigger.top - (box.top + sliceTop);
  strip.style.transform = `translate(${dx * q}px, ${dy * q}px)`;
  const top = sliceTop * q;
  const left = sliceLeft * q;
  const right = (box.width - sliceLeft - sliceW) * q;
  const bottom = (box.height - sliceTop - sliceH) * q;
  strip.style.clipPath = `inset(${top}px ${right}px ${bottom}px ${left}px round ${28 - 8 * q}px)`;
}

interface ViewProps {
  readonly layout: Layout;
  readonly doc: VirtualDocument;
  readonly ws: Workspace;
  readonly labels: readonly string[];
  readonly current: number;
  readonly subscribe: (listener: () => void) => () => void;
  readonly get: () => Snapshot;
  readonly onGone: () => void;
}

function StripView({ layout, doc, ws, labels, current, subscribe, get, onGone }: ViewProps) {
  const { index, closing } = useSyncExternalStore(subscribe, get);
  const count = doc.pages.length;
  const { axis, pitch, length, thumb } = layout;
  const stripRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const open = useRef<Motion | null>(null);
  const track = useRef<Motion | null>(null);
  const previewAt = useRef<Motion<readonly number[]> | null>(null);
  // Where the track starts; after that the spring writes it straight to the element (`place`).
  const [start] = useState(() => trackOffset(index, count, pitch, length));
  const offset = useRef(start);
  const [flight, setFlight] = useState(() => visibleRange(start, length, pitch, count));

  const place = (value: number) => {
    offset.current = value;
    const el = trackRef.current;
    if (el) el.style.transform = axis === 'x' ? `translateX(${value}px)` : `translateY(${value}px)`;
    const next = visibleRange(value, length, pitch, count);
    setFlight((was) => (was.first === next.first && was.last === next.last ? was : next));
  };

  useLayoutEffect(
    () => () => {
      track.current?.stop();
      previewAt.current?.stop();
    },
    [],
  );

  // Opens out of the trigger, goes back into it (MOT-3).
  useLayoutEffect(() => {
    const strip = stripRef.current;
    const preview = previewRef.current;
    if (!strip || !preview) return;
    const motion = animate(0, 1, {
      spring: 'quick',
      fade: true,
      onUpdate: (p) => paintOpen(strip, preview, layout, p),
    });
    open.current = motion;
    strip.focus({ preventScroll: true });
    return () => {
      motion.stop();
    };
  }, [layout]);
  useLayoutEffect(() => {
    if (!closing) return;
    const strip = stripRef.current;
    const preview = previewRef.current;
    if (!strip || !preview) return;
    const from = open.current?.stop().value ?? 1;
    const motion = animate(from, 0, {
      spring: 'quick',
      fade: true,
      onUpdate: (p) => paintOpen(strip, preview, layout, p),
      onComplete: onGone,
    });
    open.current = motion;
  }, [closing, layout, onGone]);

  // The track follows the scrubbed page; the preview follows its thumb.
  useLayoutEffect(() => {
    const target = trackOffset(index, count, pitch, length);
    if (!track.current) {
      if (target === offset.current) return;
      track.current = animate(offset.current, target, { spring: 'quick', onUpdate: place });
    } else track.current.retarget(target);
    // `place` only reads refs and stable layout.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, count, pitch, length]);
  useLayoutEffect(() => {
    const el = previewRef.current;
    if (!el) return;
    const centre =
      layout.innerStart + trackOffset(index, count, pitch, length) + (index + 0.5) * pitch;
    const { preview, box } = layout;
    const to =
      axis === 'x'
        ? [clamp(centre - preview.w / 2, 8, innerWidth - preview.w - 8), box.top - GAP - preview.h]
        : [
            box.left - GAP - preview.w,
            clamp(centre - preview.h / 2, 72, innerHeight - 120 - preview.h),
          ];
    const write = ([x = 0, y = 0]: readonly number[]) => {
      el.style.transform = `translate(${x}px, ${y}px)`;
    };
    if (!previewAt.current) {
      write(to);
      previewAt.current = animate(to, to, { spring: 'quick', onUpdate: write });
    } else previewAt.current.retarget(to);
  }, [index, count, pitch, length, axis, layout]);

  const near = visibleRange(trackOffset(index, count, pitch, length), length, pitch, count, 0);
  const cells = [];
  for (let i = flight.first; i <= flight.last; i += 1) {
    const page = doc.pages[i];
    if (!page) continue;
    const size = displaySize(ws, page);
    const fit = fitInBox(size, thumb.w, thumb.h);
    const label = labels[i] ?? String(i + 1);
    cells.push(
      <div
        key={page.id}
        id={`strip-${i}`}
        role="option"
        aria-selected={i === index}
        aria-label={m.page_strip_option({ page: label, total: formatNumber(count) })}
        aria-current={i === current ? 'page' : undefined}
        data-index={i}
        data-target={i === index ? '' : undefined}
        data-current={i === current ? '' : undefined}
        className={styles.cell}
        style={
          {
            [axis === 'x' ? 'left' : 'top']: `${i * pitch}px`,
            '--cell': `${pitch}px`,
          } as CSSProperties
        }
      >
        <div className={styles.thumb} style={{ width: fit.width, height: fit.height }}>
          {i >= near.first && i <= near.last ? (
            <PageCanvas
              sourceId={page.ref.kind === 'source' ? page.ref.source : undefined}
              blobId={page.ref.kind === 'image' ? page.ref.blob : undefined}
              index={page.ref.kind === 'source' ? page.ref.index : 0}
              rotation={page.rotation}
              widthPt={size.width}
              heightPt={size.height}
              cssWidth={fit.width}
              priority={RENDER_PRIORITY.visible}
            />
          ) : null}
        </div>
        {axis === 'x' ? (
          <span className={styles.num} aria-hidden="true">
            {label}
          </span>
        ) : null}
      </div>,
    );
  }

  const active = doc.pages[index];
  const activeSize = active ? displaySize(ws, active) : undefined;
  const room = { w: layout.preview.w - 16, h: layout.preview.h - 16 - 28 };
  const big = activeSize ? fitInBox(activeSize, room.w, room.h) : undefined;
  const { box } = layout;
  return (
    <>
      <div
        ref={stripRef}
        role="listbox"
        tabIndex={-1}
        aria-label={m.page_strip_label()}
        aria-orientation={axis === 'x' ? 'horizontal' : 'vertical'}
        aria-activedescendant={`strip-${index}`}
        data-axis={axis}
        data-testid="page-strip"
        className={styles.strip}
        style={{ left: box.left, top: box.top, width: box.width, height: box.height }}
      >
        <div
          className={styles.viewport}
          style={
            axis === 'x'
              ? { left: 8, width: length + 16, top: 0, bottom: 0 }
              : { top: 0, height: length + 16, left: 0, right: 0 }
          }
        >
          <div
            ref={trackRef}
            className={styles.track}
            style={{
              [axis === 'x' ? 'left' : 'top']: 8,
              transform: axis === 'x' ? `translateX(${start}px)` : `translateY(${start}px)`,
            }}
          >
            {cells}
          </div>
        </div>
      </div>
      <div
        ref={previewRef}
        className={styles.preview}
        aria-hidden="true"
        data-testid="page-strip-preview"
        style={{ width: layout.preview.w, height: layout.preview.h }}
      >
        {active && activeSize && big ? (
          <div className={styles.big} style={{ width: big.width, height: big.height }}>
            <PageCanvas
              key={active.id}
              sourceId={active.ref.kind === 'source' ? active.ref.source : undefined}
              blobId={active.ref.kind === 'image' ? active.ref.blob : undefined}
              index={active.ref.kind === 'source' ? active.ref.index : 0}
              rotation={active.rotation}
              widthPt={activeSize.width}
              heightPt={activeSize.height}
              cssWidth={big.width}
              priority={RENDER_PRIORITY.page}
            />
          </div>
        ) : null}
        <span className={styles.previewNum}>{labels[index] ?? index + 1}</span>
      </div>
    </>
  );
}
