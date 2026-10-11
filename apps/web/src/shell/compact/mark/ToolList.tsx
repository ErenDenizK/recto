/**
 * The list drawer (EDN-16), the owner's variant of 2026-10-11 to compare with the tiles on an
 * iPhone (`?drawer=list`, `drawer-variant.ts`): "open a notch lower, so it covers the toggle at
 * the very bottom; the tools listed top to bottom; one tap selects, a second tap expands it and
 * the colour and the other details come underneath, row by row."
 *
 * - **Object.** The tiles' floating M4 glass (`design/phone-2026-10/README.md` §3; coverage
 *   registry `compact-tool-list`), but lower: its bottom is the island's, just above the home
 *   indicator, so it covers the island, which fades out under it as it grows and back as it
 *   goes (`drawer-motion.ts`, `covers`): never glass over glass at rest. Never taller than 60 %
 *   of the screen; the rows scroll inside when they must.
 * - **Rows.** One per tool, top to bottom (Pen, Highlight, Text, Sign, Edit text), each
 *   at least 52 px: glyph, label and, trailing, a preview of the tool's setting (the ink's dot
 *   and its size; the text colour and its size). Fills, no glass in glass: the current row in
 *   the tool-active fill, an open row's options in a control-fill well under it.
 * - **Accordion** (`tool-list-state.ts`). A first tap arms the row's tool (the receive pulse)
 *   and keeps the list open; a tap on the current row opens its options under it (the
 *   registry's `Options`, the same components the tiles show: `InkOptions.tsx`,
 *   `TextOptions.tsx`, `sign-options.tsx`), another folds them. One row open at a time. The
 *   fold runs on `smooth` (no bounce), its close on `quick`; reduced motion fades only, in
 *   150 ms at most.
 * - **Closing.** A swipe down, a press outside (the transparent scrim), Done and Esc; then the island shows again with the
 *   chosen tool's chip, which takes the receive pulse (`use-drawer-panel.ts`). A saved
 *   signature still closes it as it does from the tiles.
 * - **Quiet actions** (Eraser, Redo, Select) in a compact last row, as the tiles' third row.
 * - **Semantics.** The tiles' non-modal `dialog` named "Tools" (same id and test id); each row
 *   is a toggle button, and the current one with options says whether it is expanded.
 */
import {
  type CSSProperties,
  type ReactNode,
  type RefObject,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';

import { useAnnotationStore } from '../../../annotations/annotation-store';
import { m } from '../../../i18n';
import { reducedMotion } from '../../../motion/reduced-motion';
import { receivePulse } from '../../../motion/receive';
import { springs } from '../../../motion/springs';
import { EASE, REDUCED_DURATION_MS } from '../../../motion/tokens';
import { useWorkspaceStore } from '../../../state/workspace-store';
import { Button } from '../../../ui/Button';
import { needsContrastRing } from '../../../ui/colour/colour-math';
import { Icon } from '../../../ui/Icon';
import { useToolStore } from '../../../viewer/tool-store';
import type { CompactTool } from '../compact-store';
import { setDrawerOpen, useCompactStore } from '../compact-store';
import { armTool, redo, toggleEraser, toolOff } from './bridge';
import { progressFrames } from './drawer-motion';
import { DRAWER_ID } from './EditIsland';
import {
  HIGHLIGHTER_SIZES,
  highlighterSlot,
  nearestSize,
  PEN_SIZES,
  penToArm,
} from './ink-presets';
import { type CompactToolSpec, toolsIn, useCompactTools } from './registry';
import { TEXT_SIZES } from './text-presets';
import { openRow, tapRow } from './tool-list-state';
import styles from './ToolList.module.css';
import { useDrawerPanel } from './use-drawer-panel';

/** The island the list covers while open. */
const capsuleOf = () => document.querySelector<HTMLElement>('[data-testid="compact-capsule"]');

export default function ToolList() {
  const open = useCompactStore((s) => s.drawerOpen);
  const [shown, setShown] = useState(open);
  if (open && !shown) setShown(true);
  return shown ? <Panel open={open} onClosed={() => setShown(false)} /> : null;
}

function Panel({ open, onClosed }: { readonly open: boolean; readonly onClosed: () => void }) {
  const tool = useCompactStore((s) => s.tool);
  const specs = useCompactTools();
  const redoable = useWorkspaceStore((s) => s.history.future.length > 0);
  const { panelRef, swipe } = useDrawerPanel(open, onClosed, capsuleOf);
  const [expanded, setExpanded] = useState<CompactTool | null>(null);
  const openId = openRow(tool, expanded);
  const rows = toolsIn('tile', specs);
  const eraser = specs.get('eraser');
  const listRef = useRef<HTMLDivElement>(null);
  const scrolls = useOverflows(listRef);

  const tap = (spec: CompactToolSpec, el: HTMLElement) => {
    const next = tapRow(
      { id: spec.id, soon: spec.soon === true, opens: opensUnder(spec) },
      tool,
      openId,
    );
    if (next.arm) {
      void receivePulse(el);
      armTool(next.arm);
    }
    setExpanded(next.open);
  };

  return (
    <>
      <div
        className={styles.scrim}
        aria-hidden="true"
        data-testid="compact-drawer-scrim"
        onPointerDown={(event) => {
          event.preventDefault();
          setDrawerOpen(false);
        }}
      />
      <div
        ref={panelRef}
        id={DRAWER_ID}
        role="dialog"
        aria-label={m.compact_tools()}
        tabIndex={-1}
        className={styles.panel}
        data-compact-chrome=""
        data-annotation-keep=""
        data-closing={open ? undefined : ''}
        data-variant="list"
        data-testid="compact-tool-drawer"
        inert={!open}
        {...swipe}
      >
        <div className={styles.head}>
          <span className={styles.grabber} aria-hidden="true" />
          <span className={styles.title}>{m.compact_tools()}</span>
          <Button
            variant="quiet"
            className={styles.done}
            data-testid="compact-drawer-done"
            onClick={() => setDrawerOpen(false)}
          >
            {m.compact_done()}
          </Button>
        </div>
        <div
          ref={listRef}
          className={styles.list}
          role="group"
          aria-label={m.compact_tools()}
          data-scrolls={scrolls || undefined}
          data-tool-rows=""
        >
          {rows.map((spec) => (
            <Row
              key={spec.id}
              spec={spec}
              current={tool === spec.id}
              open={openId === spec.id}
              onTap={tap}
            />
          ))}
        </div>
        <div className={styles.quiet}>
          {eraser ? (
            <Button
              variant="quiet"
              className={styles.action}
              aria-pressed={tool === 'eraser'}
              onClick={(event) => {
                void receivePulse(event.currentTarget);
                toggleEraser();
              }}
            >
              <Icon name={eraser.glyph} />
              {eraser.label()}
            </Button>
          ) : null}
          <Button
            variant="quiet"
            className={styles.action}
            aria-disabled={!redoable || undefined}
            onClick={() => redo()}
          >
            <Icon name="arrow-u-up-right" />
            {m.compact_redo()}
          </Button>
          <Button
            variant="quiet"
            className={styles.action}
            aria-pressed={tool === null}
            onClick={(event) => {
              void receivePulse(event.currentTarget);
              toolOff();
            }}
          >
            <Icon name="cursor" />
            {m.compact_tool_select()}
          </Button>
        </div>
      </div>
    </>
  );
}

/** A row has something to open under it: its options, or its one line. */
const opensUnder = (spec: CompactToolSpec): boolean =>
  spec.Options !== undefined || spec.hint !== undefined;

function Row({
  spec,
  current,
  open,
  onTap,
}: {
  readonly spec: CompactToolSpec;
  readonly current: boolean;
  readonly open: boolean;
  readonly onTap: (spec: CompactToolSpec, el: HTMLElement) => void;
}) {
  const Options = spec.Options;
  const opens = opensUnder(spec);
  const Preview = PREVIEWS[spec.id];
  const optionsId = `${DRAWER_ID}-${spec.id}`;
  return (
    <div className={styles.item} data-current={current || undefined} data-open={open || undefined}>
      <Button
        variant="quiet"
        className={styles.row}
        aria-pressed={current}
        aria-expanded={current && opens ? open : undefined}
        aria-controls={open ? optionsId : undefined}
        aria-disabled={spec.soon === true || undefined}
        data-tool={spec.id}
        onClick={(event) => onTap(spec, event.currentTarget)}
      >
        <Icon name={spec.glyph} filled={current} />
        <span className={styles.label}>{spec.label()}</span>
        {spec.soon ? (
          <span className={styles.soon}>{m.compact_tool_soon()}</span>
        ) : Preview ? (
          <Preview />
        ) : null}
        {current && opens ? <Icon name="caret-down" className={styles.caret} /> : null}
      </Button>
      <Fold open={open} id={optionsId}>
        {Options ? <Options /> : <p className={styles.hint}>{spec.hint?.()}</p>}
      </Fold>
    </div>
  );
}

/**
 * An open row's options: they grow in under the row on `smooth` and fold away on `quick`
 * (MC-16), height and opacity on one progress, and unmount when the fold's animation finishes.
 * Reduced motion: the fade alone, within 150 ms. At rest nothing stays inline.
 */
function Fold({
  open,
  id,
  children,
}: {
  readonly open: boolean;
  readonly id: string;
  readonly children: ReactNode;
}) {
  const [shown, setShown] = useState(open);
  if (open && !shown) setShown(true);
  const ref = useRef<HTMLDivElement>(null);
  const run = useRef<Animation | null>(null);
  const mounted = useRef(false);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    // Just mounted, it grows from nothing; turned mid-way, from where it is.
    const first = !mounted.current;
    mounted.current = true;
    const from = first ? 0 : el.getBoundingClientRect().height;
    const opacity = first ? 0 : Number(getComputedStyle(el).opacity);
    run.current?.cancel();
    const to = open ? el.scrollHeight : 0;
    let anim: Animation | null = null;
    if (typeof el.animate === 'function') {
      if (reducedMotion()) {
        anim = el.animate([{ opacity: String(opacity) }, { opacity: open ? '1' : '0' }], {
          duration: open ? REDUCED_DURATION_MS.base : REDUCED_DURATION_MS.fast,
          easing: open ? EASE.out : EASE.exit,
          fill: 'forwards',
        });
      } else {
        const start = from;
        const { values, ms } = progressFrames(open ? springs.smooth : springs.quick, 0, 0, 1);
        el.dataset.folding = '';
        anim = el.animate(
          values.map((q) => {
            const h = start + (to - start) * q;
            const seen = open
              ? opacity + (1 - opacity) * Math.min(1, q * 1.6)
              : opacity * Math.max(0, 1 - q * 1.6);
            return { height: `${h.toFixed(2)}px`, opacity: seen.toFixed(3) };
          }),
          { duration: ms, fill: 'forwards' },
        );
      }
    }
    run.current = anim;
    let live = true;
    const settle = () => {
      if (!live || run.current !== anim) return;
      run.current = null;
      delete el.dataset.folding;
      if (!open) {
        setShown(false);
        return;
      }
      anim?.cancel();
      revealIn(el.parentElement);
    };
    if (anim) anim.onfinish = settle;
    else settle();
    return () => {
      live = false;
    };
  }, [open]);
  if (!shown) return null;
  return (
    <div
      ref={ref}
      id={id}
      className={styles.options}
      inert={!open}
      data-testid="compact-drawer-options"
    >
      {children}
    </div>
  );
}

/** Scrolls the rows, if they must, so an opened row and its options show whole. */
function revealIn(item: HTMLElement | null): void {
  const list = item?.closest<HTMLElement>('[data-tool-rows]');
  if (!item || !list) return;
  const box = item.getBoundingClientRect();
  const view = list.getBoundingClientRect();
  const below = box.bottom - view.bottom;
  const above = box.top - view.top;
  const by = below > 0 ? Math.min(below, above) : Math.min(0, above);
  if (by !== 0) list.scrollBy({ top: by, behavior: reducedMotion() ? 'auto' : 'smooth' });
}

/** Whether `ref`'s rows overflow it, so it scrolls (and takes vertical pans) only then. */
function useOverflows(ref: RefObject<HTMLElement | null>): boolean {
  const [over, setOver] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver !== 'function') return;
    const check = () => setOver(el.scrollHeight > el.clientHeight + 1);
    const observer = new ResizeObserver(check);
    observer.observe(el);
    for (const child of el.children) observer.observe(child);
    const children = new MutationObserver(() => {
      for (const child of el.children) observer.observe(child);
      check();
    });
    children.observe(el, { childList: true, subtree: true });
    check();
    return () => {
      observer.disconnect();
      children.disconnect();
    };
  }, [ref]);
  return over;
}

/** The trailing preview of a row's setting, by tool. */
const PREVIEWS: Partial<Record<CompactTool, () => ReactNode>> = {
  pen: PenPreview,
  highlight: HighlightPreview,
  text: TextPreview,
};

/** Pen: the pen it arms (`penToArm`): its colour and its size. */
function PenPreview() {
  const pen = useAnnotationStore((s) => s.pen);
  const lastPen = useToolStore((s) => s.lastPen);
  const preset = pen.presets[penToArm(pen, lastPen)];
  return <InkPreview color={preset.color} size={nearestSize(preset.width, PEN_SIZES)} />;
}

/** Highlight: the Highlighter's tint and width. */
function HighlightPreview() {
  const pen = useAnnotationStore((s) => s.pen);
  const index = highlighterSlot(pen);
  if (index === undefined) return null;
  const preset = pen.presets[index];
  return <InkPreview color={preset.color} size={nearestSize(preset.width, HIGHLIGHTER_SIZES)} />;
}

/** Text: the colour new boxes take and an "A" at their size. */
function TextPreview() {
  const style = useAnnotationStore((s) => s.styles.text);
  return (
    <span className={styles.preview} aria-hidden="true">
      <Dot color={style.color} />
      <span className={styles.letter} data-size={nearestSize(style.fontSize, TEXT_SIZES)}>
        A
      </span>
    </span>
  );
}

function InkPreview({ color, size }: { readonly color: string; readonly size: number }) {
  return (
    <span className={styles.preview} aria-hidden="true">
      <Dot color={color} />
      <span className={styles.size} data-size={size} />
    </span>
  );
}

/** The ink's dot, with the swatches' contrast ring where the ink is close to the glass. */
function Dot({ color }: { readonly color: string }) {
  return (
    <span
      className={styles.dot}
      style={{ '--swatch': color } as CSSProperties}
      data-ring-dark={needsContrastRing(color, 'dark') ? '' : undefined}
      data-ring-light={needsContrastRing(color, 'light') ? '' : undefined}
    />
  );
}
