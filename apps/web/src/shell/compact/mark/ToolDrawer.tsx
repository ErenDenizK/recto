/**
 * The tool drawer (`design/phone-2026-10/README.md` §3; EDN-8, the owner: "superb, not a
 * makeshift drawer; a floating glass object that rises from below"): the one place where all
 * of phone editing lives.
 *
 * - **Object.** A floating M4 panel (coverage registry `compact-tool-drawer`), inset 16 px from
 *   the sides and 12 px above the island, clear of the home indicator, never taller than 55 %
 *   of the screen. Its corners are the island's concentric radius (28 px, `--radius-2xl`, the
 *   island being a 56 px capsule) and its tiles 16 px inside its 12 px padding (S-1). It is a
 *   separate object, never a sheet glued to the bottom edge. Glass Solid gives its solid twin
 *   (`materials.css`); the background light shows through the glass, never cut (DSN-24).
 * - **Motion.** It rises out of the tool chip by the container transform on `smooth` and goes
 *   back into it (`drawer-motion.ts`, MOT-5); the island stays put; the chip takes the receive
 *   pulse when it has gone back in, and a tile that arms takes it at once.
 * - **Rows** (at most three): the tools as tiles of glyph and label (fills, no glass in glass;
 *   the armed one in the tool-active fill); the armed tool's options from the registry (Pen and
 *   Highlight: `InkOptions.tsx`); the quiet actions Eraser, Redo and Select.
 * - **Closing.** A tile arms its tool and closes the drawer (Sign's keeps it open on its
 *   signatures, `keepsDrawer`, EDN-14); so do a swipe down, a press outside
 *   (on a transparent scrim, so it never draws on the page) and the chip again. Esc closes it
 *   and puts focus back on ▾.
 * - **Semantics.** A non-modal `dialog` named "Tools"; the tiles are toggle buttons in a group,
 *   so Tab walks tiles, options, quiet actions in reading order. It takes focus when it opens.
 */
import { type PointerEvent, useEffect, useLayoutEffect, useRef, useState } from 'react';

import { m } from '../../../i18n';
import { receivePulse } from '../../../motion/receive';
import { useWorkspaceStore } from '../../../state/workspace-store';
import { Button } from '../../../ui/Button';
import { Icon } from '../../../ui/Icon';
import { setDrawerOpen, useCompactStore } from '../compact-store';
import { armTool, redo, toggleEraser, toolOff } from './bridge';
import { drawerMotion, type DrawerMotion, swipeCloses } from './drawer-motion';
import { DRAWER_ID } from './EditIsland';
import { type CompactToolSpec, toolsIn, useCompactTools } from './registry';
import styles from './ToolDrawer.module.css';

/** A tile's pulse shows this long before the drawer starts back into the chip. */
const ARM_CLOSE_DELAY_MS = 90;
/** A drag this far down (CSS px) takes the panel with the finger. */
const DRAG_START_PX = 6;

const chipOf = () => document.querySelector('[data-compact-tool-chip]');

export function ToolDrawer() {
  const open = useCompactStore((s) => s.drawerOpen);
  const [shown, setShown] = useState(open);
  if (open && !shown) setShown(true);
  return shown ? <Panel open={open} onClosed={() => setShown(false)} /> : null;
}

function Panel({ open, onClosed }: { readonly open: boolean; readonly onClosed: () => void }) {
  const tool = useCompactStore((s) => s.tool);
  const specs = useCompactTools();
  const redoable = useWorkspaceStore((s) => s.history.future.length > 0);
  const panelRef = useRef<HTMLDivElement>(null);
  const motion = useRef<DrawerMotion | null>(null);
  const closed = useRef(onClosed);
  useLayoutEffect(() => {
    closed.current = onClosed;
  });
  const armed = specs.get(tool ?? 'pen');
  const tiles = toolsIn('tile', specs);
  const eraser = specs.get('eraser');

  // Open and close by the container transform; closed, the chip takes the panel back.
  useLayoutEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;
    motion.current ??= drawerMotion(panel, chipOf);
    if (open) {
      void motion.current.to(1);
      panel.focus({ preventScroll: true });
      return;
    }
    const hadFocus = panel.contains(document.activeElement);
    let live = true;
    void motion.current.to(0).then(() => {
      if (!live) return;
      const chip = chipOf();
      if (chip) receivePulse(chip);
      if (hadFocus)
        document.querySelector<HTMLElement>('[data-testid="compact-tool-more"]')?.focus();
      closed.current();
    });
    return () => {
      live = false;
    };
  }, [open]);

  // Esc closes from anywhere while open.
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      setDrawerOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  // Swipe down: the panel follows the finger, and a long or quick enough swipe closes it.
  const drag = useRef<{ id: number; x: number; y: number; t: number; on: boolean } | null>(null);
  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (!event.isPrimary || !open) return;
    drag.current = {
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      t: event.timeStamp,
      on: false,
    };
  };
  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (d?.id !== event.pointerId) return;
    const dy = event.clientY - d.y;
    if (!d.on) {
      if (dy < DRAG_START_PX || Math.abs(event.clientX - d.x) > dy) return;
      d.on = true;
      event.currentTarget.setPointerCapture(event.pointerId);
    }
    motion.current?.drag(dy);
  };
  const onPointerUp = (event: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    drag.current = null;
    if (!d?.on || d.id !== event.pointerId) return;
    const dy = event.clientY - d.y;
    const ms = Math.max(1, event.timeStamp - d.t);
    if (swipeCloses(dy, dy / ms)) setDrawerOpen(false);
    else motion.current?.release();
  };

  const arm = (spec: CompactToolSpec, el: HTMLElement) => {
    if (spec.soon) return;
    receivePulse(el);
    armTool(spec.id);
    if (!spec.keepsDrawer) window.setTimeout(() => setDrawerOpen(false), ARM_CLOSE_DELAY_MS);
  };

  const Options = armed && tool !== null ? armed.Options : undefined;
  const hint = armed && tool !== null && !Options ? armed.hint?.() : undefined;

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
        data-testid="compact-tool-drawer"
        inert={!open}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={() => {
          drag.current = null;
          motion.current?.release();
        }}
      >
        <span className={styles.grabber} aria-hidden="true" />
        <div className={styles.tiles} role="group" aria-label={m.compact_tools()}>
          {tiles.map((spec) => (
            <Button
              key={spec.id}
              variant="quiet"
              className={styles.tile}
              aria-pressed={tool === spec.id}
              aria-disabled={spec.soon === true || undefined}
              data-tool={spec.id}
              onClick={(event) => arm(spec, event.currentTarget)}
            >
              <Icon name={spec.glyph} filled={tool === spec.id} />
              <span className={styles.tileLabel}>{spec.label()}</span>
              {spec.soon ? <span className={styles.soon}>{m.compact_tool_soon()}</span> : null}
            </Button>
          ))}
        </div>
        {Options !== undefined || hint !== undefined ? (
          <div className={styles.options} data-testid="compact-drawer-options">
            {Options ? <Options key={tool} /> : <p className={styles.hint}>{hint}</p>}
          </div>
        ) : null}
        <div className={styles.quiet}>
          {eraser ? (
            <Button
              variant="quiet"
              className={styles.action}
              aria-pressed={tool === 'eraser'}
              onClick={(event) => {
                receivePulse(event.currentTarget);
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
              receivePulse(event.currentTarget);
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
