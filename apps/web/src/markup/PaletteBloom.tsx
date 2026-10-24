/**
 * The labels that bloom (R26 wow concept 6, DSN-71; `palette-labels.ts`): a label line under the
 * Markup palette's icons. While it is open the capsule is one label line taller (the capsule
 * follows its content's size on the smooth spring, MOT-18; with reduced motion it takes the size
 * at once and the labels only fade), each unlabelled icon shows its name under it, and the
 * groups' hairlines run the full height. Then the labels fade and the capsule settles back.
 *
 * Loaded lazily and only with the flag on. Everything here is drawn over what the palette
 * already renders: names come from the buttons' accessible names, positions from their boxes, so
 * the default row and the grouped palette (`?palette=groups`, whose group names are labels
 * already) both work, and nothing in the palette's own tree changes. The layer is `aria-hidden`:
 * the buttons keep their full names and tooltips, the labels truncate with an ellipsis in a slot
 * as wide as their button and its gap (Q-8: never under 11 px).
 */
import { type RefObject, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

import { m } from '../i18n';
import { reducedMotion } from '../motion/reduced-motion';
import styles from './PaletteBloom.module.css';
import {
  autoBloomSession,
  FADE_MS,
  HOLD_MS,
  labelsSession,
  REACH_QUIET_MS,
  SHOWN_MS,
} from './palette-labels';

type Phase = 'open' | 'fade' | 'idle';

interface Label {
  readonly text: string;
  readonly full: string;
  readonly left: number;
  readonly width: number;
}

interface Layout {
  readonly labels: readonly Label[];
  readonly seps: readonly number[];
}

/** Press travel that still counts as holding in place (the 10 px slop of `ui/IconButton`). */
const HOLD_SLOP = 10;

interface Cell {
  readonly text: string | null;
  readonly need: number;
  readonly full: string;
  readonly left: number;
  readonly right: number;
  readonly mid: number;
}

/** The widest a label may grow (the slot is the room to its neighbours, up to this). */
const MAX_SLOT = 96;
/** Air between a label and a neighbour's label or a group hairline. */
const SLOT_AIR = 3;

/** The short name of a palette item whose full name is long (`palette_short_*`, one word). */
const SHORT: Readonly<Record<string, () => string>> = {
  select: m.palette_short_select,
  eraser: m.palette_short_eraser,
  lasso: m.palette_short_lasso,
  shapes: m.palette_short_shapes,
  'text-box': m.palette_short_text_box,
  note: m.palette_short_note,
  image: m.palette_short_image,
  stamp: m.palette_short_stamp,
  'add-field': m.palette_short_add_field,
  outlines: m.palette_short_outlines,
  more: m.palette_short_more,
  'edit-text': m.palette_short_edit_text,
};

/**
 * What a button's label says: a tool's short name, or for a pen the colour alone (the group
 * already says pen: "Black pen, Medium" shows "Black"; a numbered preset keeps its number).
 */
function shortName(el: HTMLElement, name: string): string {
  const short = SHORT[el.dataset.item ?? ''];
  if (short) return short();
  if (!el.hasAttribute('data-pen-preset')) return name;
  const head = (name.split(',')[0] ?? name).trim();
  return /\d/.test(head) ? head : (head.split(/\s+/)[0] ?? head);
}

/** The label font's ruler (11 px, Q-8). */
function rulerOf(content: HTMLElement): (text: string) => number {
  const ctx = document.createElement('canvas').getContext('2d');
  if (ctx) ctx.font = `500 11px ${getComputedStyle(content).fontFamily}`;
  return (text) => ctx?.measureText(text).width ?? 0;
}

/** The palette's room beside the capsule: the band's width less the palette's 16 px margins. */
const MARGIN = 16;

/**
 * Widens each unlabelled button to fit its label (the capsule follows its content's size on its
 * spring, MOT-18), when the whole row still fits the room the band leaves; otherwise nothing
 * moves and the labels share the slots as they are. Returns what puts the widths back.
 */
function widen(content: HTMLElement): () => void {
  const measureText = rulerOf(content);
  const grown: { el: HTMLElement; width: number; to: number }[] = [];
  for (const el of content.querySelectorAll<HTMLElement>(
    '[role="toolbar"] button[data-size="bar"]:not([data-labelled])',
  )) {
    const name = el.getAttribute('aria-label') ?? '';
    const width = el.getBoundingClientRect().width;
    if (name === '' || width === 0 || el.closest('[data-item="stepper"]')) continue;
    const to = Math.min(MAX_SLOT, Math.ceil(measureText(shortName(el, name))) + 2 * SLOT_AIR);
    if (to > width) grown.push({ el, width, to });
  }
  const band = content.closest<HTMLElement>('[data-frame-layer="band"]') ?? document.body;
  const room = band.clientWidth - 2 * MARGIN - content.getBoundingClientRect().width;
  const extra = grown.reduce((sum, g) => sum + g.to - g.width, 0);
  if (extra === 0 || extra > room) return () => undefined;
  const moves = !reducedMotion();
  for (const g of grown) {
    g.el.style.transition = moves ? 'min-width var(--duration-slow) var(--ease-out)' : 'none';
    g.el.style.minWidth = `${g.width}px`;
  }
  content.getBoundingClientRect();
  for (const g of grown) g.el.style.minWidth = `${g.to}px`;
  return () => {
    for (const g of grown) g.el.style.minWidth = `${g.width}px`;
    const clear = () => {
      for (const g of grown) {
        g.el.style.removeProperty('min-width');
        g.el.style.removeProperty('transition');
      }
    };
    if (moves) window.setTimeout(clear, FADE_MS + 300);
    else clear();
  };
}

/**
 * The buttons without a name of their own and the hairlines between groups, in content space.
 * A label's slot is centred under its icon and reaches the midpoint to a neighbouring label (or,
 * for a button that names itself, up to its edge), never across a group hairline, at most
 * MAX_SLOT; only a name longer than that truncates.
 */
function measure(content: HTMLElement): Layout {
  const origin = content.getBoundingClientRect();
  const gap = Number.parseFloat(getComputedStyle(content).getPropertyValue('--palette-gap')) || 4;
  const seps = [...content.querySelectorAll<HTMLElement>('[data-sep]')].map((el) => {
    const box = el.getBoundingClientRect();
    return box.left - origin.left + box.width / 2;
  });
  const measureText = rulerOf(content);
  const cells: Cell[] = [];
  for (const el of content.querySelectorAll<HTMLElement>(
    '[role="toolbar"] button[data-size="bar"]',
  )) {
    if (el.closest('[data-item="stepper"]')) continue;
    const box = el.getBoundingClientRect();
    if (box.width === 0) continue;
    const name = el.getAttribute('aria-label') ?? '';
    const named = el.hasAttribute('data-labelled') || name === '';
    const left = box.left - origin.left;
    const text = named ? null : shortName(el, name);
    cells.push({
      text,
      full: name,
      need: text === null ? 0 : measureText(text) / 2 + SLOT_AIR,
      left,
      right: left + box.width,
      mid: left + box.width / 2,
    });
  }
  // Room between two neighbouring labels is shared by what each name needs, not halved.
  const share = (a: Cell, b: Cell) => {
    const need = a.need + b.need;
    return a.mid + (need === 0 ? (b.mid - a.mid) / 2 : ((b.mid - a.mid) * a.need) / need);
  };
  const labels: Label[] = [];
  cells.forEach((cell, i) => {
    if (cell.text === null) return;
    const prev = cells[i - 1];
    const next = cells[i + 1];
    const lo0 = prev ? (prev.text === null ? prev.right : share(prev, cell)) : cell.left - gap;
    const hi0 = next ? (next.text === null ? next.left : share(cell, next)) : cell.right + gap;
    let lo = lo0;
    let hi = hi0;
    for (const x of seps) {
      if (x < cell.mid && x > lo - SLOT_AIR) lo = x + SLOT_AIR;
      if (x > cell.mid && x < hi + SLOT_AIR) hi = x - SLOT_AIR;
    }
    const half = Math.min(cell.mid - lo, hi - cell.mid, MAX_SLOT / 2);
    const width = Math.max(2 * half, cell.right - cell.left);
    labels.push({ text: cell.text, full: cell.full, left: cell.mid - width / 2, width });
  });
  return { labels, seps };
}

export default function PaletteBloom({
  contentRef,
}: {
  readonly contentRef: RefObject<HTMLElement | null>;
}) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [layout, setLayout] = useState<Layout>({ labels: [], seps: [] });
  const timers = useRef<number[]>([]);
  const lastBloom = useRef(0);
  const swallow = useRef(false);

  const clear = () => {
    for (const id of timers.current) window.clearTimeout(id);
    timers.current = [];
  };
  const bloom = useCallback(() => {
    clear();
    lastBloom.current = Date.now();
    setPhase('open');
    timers.current.push(
      window.setTimeout(() => setPhase('fade'), SHOWN_MS),
      window.setTimeout(() => setPhase('idle'), SHOWN_MS + FADE_MS),
    );
  }, []);

  // The first open and the reaching hand (first two sessions), and the press and hold (always).
  useEffect(() => {
    const content = contentRef.current;
    if (!content) return undefined;
    const auto = autoBloomSession(labelsSession());
    if (auto) timers.current.push(window.setTimeout(bloom, 500));
    let hold = 0;
    let start: { x: number; y: number } | null = null;
    const reach = () => {
      if (auto && Date.now() - lastBloom.current > REACH_QUIET_MS) bloom();
    };
    const onEnter = (event: PointerEvent) => {
      if (event.pointerType === 'mouse') reach();
    };
    const stopHold = () => {
      window.clearTimeout(hold);
      start = null;
    };
    const onDown = (event: PointerEvent) => {
      if (event.pointerType !== 'mouse') reach();
      if (event.pointerType === 'mouse' && event.button !== 0) return;
      // A choice tool's own long press opens its menu: leave those presses alone.
      if (event.target instanceof Element && event.target.closest('[aria-haspopup]')) return;
      start = { x: event.clientX, y: event.clientY };
      window.clearTimeout(hold);
      hold = window.setTimeout(() => {
        swallow.current = true;
        bloom();
      }, HOLD_MS);
    };
    const onMove = (event: PointerEvent) => {
      if (start && Math.hypot(event.clientX - start.x, event.clientY - start.y) > HOLD_SLOP) {
        stopHold();
      }
    };
    // The release after a hold is not a tap on the tool under the finger.
    const onClick = (event: MouseEvent) => {
      if (!swallow.current) return;
      swallow.current = false;
      event.preventDefault();
      event.stopPropagation();
    };
    const onUp = () => {
      stopHold();
      window.setTimeout(() => {
        swallow.current = false;
      }, 0);
    };
    content.addEventListener('pointerenter', onEnter);
    content.addEventListener('pointerdown', onDown);
    content.addEventListener('pointermove', onMove);
    content.addEventListener('pointerup', onUp);
    content.addEventListener('pointercancel', stopHold);
    content.addEventListener('click', onClick, true);
    return () => {
      content.removeEventListener('pointerenter', onEnter);
      content.removeEventListener('pointerdown', onDown);
      content.removeEventListener('pointermove', onMove);
      content.removeEventListener('pointerup', onUp);
      content.removeEventListener('pointercancel', stopHold);
      content.removeEventListener('click', onClick, true);
      stopHold();
      clear();
    };
  }, [contentRef, bloom]);

  // The row widens to fit its names while they show, when the band has the room.
  useLayoutEffect(() => {
    const content = contentRef.current;
    if (phase !== 'open' || !content) return undefined;
    return widen(content);
  }, [phase, contentRef]);

  // Positions follow the row while the labels show (a fold, a language change).
  useLayoutEffect(() => {
    const content = contentRef.current;
    if (phase === 'idle' || !content) return undefined;
    const update = () => setLayout(measure(content));
    update();
    const observer = new ResizeObserver(update);
    observer.observe(content);
    return () => observer.disconnect();
  }, [phase, contentRef]);

  if (phase === 'idle') return null;
  return (
    <div className={styles.strip} aria-hidden="true" data-bloom={phase}>
      {layout.seps.map((x) => (
        <span key={x} className={styles.sep} style={{ left: x }} />
      ))}
      <div className={styles.labels}>
        {layout.labels.map((label, i) => (
          <span
            key={`${i}:${label.full}`}
            className={styles.label}
            style={{ left: label.left, width: label.width }}
            title={label.full}
          >
            {label.text}
          </span>
        ))}
      </div>
    </div>
  );
}
