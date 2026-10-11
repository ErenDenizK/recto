/**
 * The edit island (`design/phone-2026-10/README.md` §2 "Editing"; EDN-8): the capsule's content
 * while editing, three slots that never move.
 *
 * - **Leading:** Undo, and Redo beside it once there is a step to redo (the island's width
 *   springs to make room, `capsule-morph.ts`). History is not shown on phones.
 * - **Centre:** the tool chip, one pill of two targets. Its glyph and one-word label toggle the
 *   tool (off = one finger pans and selects); a long press or its ▾ opens the drawer
 *   (`ToolDrawer.tsx`). Armed, the pill carries the pressed wash and the glyph the ink's dot;
 *   off, it is quiet. A new tool's glyph and label cross-fade in place of the old (§3 "Feel").
 * - **Trailing:** Done, lime, the view's one primary action: it leaves editing and keeps the
 *   changes on the device (`bridge.ts`).
 *
 * Every target is 44 px (Q-9); presses take the touch press scale (platform.md §2).
 */
import { type PointerEvent, useLayoutEffect, useRef, useState } from 'react';

import { m } from '../../../i18n';
import { useWorkspaceStore } from '../../../state/workspace-store';
import { Button } from '../../../ui/Button';
import { Icon, type IconName } from '../../../ui/Icon';
import { IconButton } from '../../../ui/IconButton';
import { setDrawerOpen, useCompactStore } from '../compact-store';
import { canUndoHere, exitEditing, redo, toggleTool, undo } from './bridge';
import { morphCapsule } from './capsule-morph';
import styles from './EditIsland.module.css';
import { useCompactTools } from './registry';

/** A press held this long on the chip opens the drawer (README §2: long-press). */
const LONG_PRESS_MS = 450;
/** A press that moved this far is not a long press, CSS px. */
const LONG_PRESS_SLOP_PX = 10;

/** The id the chip's ▾ controls. */
export const DRAWER_ID = 'compact-tool-drawer';

export function EditIsland() {
  const tool = useCompactStore((s) => s.tool);
  const lastTool = useCompactStore((s) => s.lastTool);
  const drawerOpen = useCompactStore((s) => s.drawerOpen);
  const history = useWorkspaceStore((s) => s.history);
  const specs = useCompactTools();
  const undoable = canUndoHere(history);
  const redoable = history.future.length > 0;
  const shown = tool ?? lastTool;
  const spec = specs.get(shown);
  const label = spec?.label() ?? '';
  const Badge = tool === null ? undefined : spec?.Badge;

  // The island's own reshapes (Redo arriving, a longer label): the width springs from the box
  // it had at the last render.
  const leadRef = useRef<HTMLButtonElement>(null);
  const before = useRef<DOMRect | null>(null);
  const shape = `${redoable}:${label}`;
  const lastShape = useRef(shape);
  useLayoutEffect(() => {
    const capsule = leadRef.current?.parentElement;
    if (!capsule) return;
    if (lastShape.current !== shape && before.current) {
      morphCapsule(capsule, before.current, { content: false });
    }
    lastShape.current = shape;
    before.current = capsule.getBoundingClientRect();
  }, [shape]);

  // The glyph that was showing fades out under the new one (§3 "Feel").
  const [leaving, setLeaving] = useState<IconName | null>(null);
  const [seen, setSeen] = useState(spec?.glyph);
  if (spec && seen !== spec.glyph) {
    if (seen !== undefined) setLeaving(seen);
    setSeen(spec.glyph);
  }

  // Long press on the chip opens the drawer; the click that follows is swallowed.
  const press = useRef<{ x: number; y: number; timer: number; fired: boolean } | null>(null);
  const endPress = () => {
    if (press.current) window.clearTimeout(press.current.timer);
  };
  const onPointerDown = (event: PointerEvent<HTMLButtonElement>) => {
    endPress();
    const start = {
      x: event.clientX,
      y: event.clientY,
      fired: false,
      timer: window.setTimeout(() => {
        start.fired = true;
        setDrawerOpen(true);
      }, LONG_PRESS_MS),
    };
    press.current = start;
  };
  const onPointerMove = (event: PointerEvent<HTMLButtonElement>) => {
    const start = press.current;
    if (
      start &&
      Math.hypot(event.clientX - start.x, event.clientY - start.y) > LONG_PRESS_SLOP_PX
    ) {
      endPress();
    }
  };

  return (
    <>
      <IconButton
        ref={leadRef}
        label={m.compact_undo()}
        tooltipSide="top"
        icon={<Icon name="arrow-u-up-left" />}
        className={styles.history}
        aria-disabled={!undoable || undefined}
        data-testid="compact-undo"
        onClick={() => undo()}
      />
      {redoable ? (
        <IconButton
          label={m.compact_redo()}
          tooltipSide="top"
          icon={<Icon name="arrow-u-up-right" />}
          className={styles.history}
          data-testid="compact-redo"
          onClick={() => redo()}
        />
      ) : null}
      <span
        className={styles.chip}
        data-armed={tool !== null || undefined}
        data-open={drawerOpen || undefined}
        data-compact-tool-chip=""
      >
        <Button
          variant="quiet"
          className={styles.toggle}
          aria-pressed={tool !== null}
          aria-label={label}
          data-testid="compact-tool-chip"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endPress}
          onPointerCancel={endPress}
          onContextMenu={(event) => event.preventDefault()}
          onClick={() => {
            if (press.current?.fired) {
              press.current = null;
              return;
            }
            // The chip again closes an open drawer (README §3 "Closing").
            if (useCompactStore.getState().drawerOpen) setDrawerOpen(false);
            else toggleTool();
          }}
        >
          <span className={styles.glyph}>
            {leaving ? (
              <Icon
                key={`out-${leaving}`}
                name={leaving}
                className={styles.out}
                filled={false}
                onAnimationEnd={() => setLeaving(null)}
              />
            ) : null}
            {spec ? (
              <Icon key={spec.glyph} name={spec.glyph} className={styles.in} filled={false} />
            ) : null}
            {Badge ? <Badge key={shown} /> : null}
          </span>
          <span key={label} className={`${styles.label} ${styles.in}`}>
            {label}
          </span>
        </Button>
        <span className={styles.rule} aria-hidden="true" />
        <IconButton
          label={m.compact_tool_menu()}
          tooltipSide="top"
          icon={<Icon name="caret-down" />}
          className={styles.more}
          aria-haspopup="dialog"
          aria-expanded={drawerOpen}
          aria-controls={drawerOpen ? DRAWER_ID : undefined}
          data-testid="compact-tool-more"
          onClick={() => setDrawerOpen(!drawerOpen)}
        />
      </span>
      <Button
        variant="prominent"
        className={styles.done}
        data-testid="compact-edit-done"
        onClick={exitEditing}
      >
        {m.compact_done()}
      </Button>
    </>
  );
}
