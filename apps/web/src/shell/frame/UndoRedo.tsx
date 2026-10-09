/**
 * ↶ Undo and ↷ Redo, always visible in a document (01-frame F3; ADR-0032 §2.8; flows.md §5.3;
 * spec redesign D0-6). In today's title bar until D2's top strip takes them; the compact
 * edition is read-only and has none (ADR-0033).
 *
 * - **Tooltips name the step:** "Undo highlight on page 3 · Ctrl Z", "Undo highlight in
 *   agreement.pdf"; empty history reads "Nothing to undo" (`history/labels.ts`).
 * - **Disabled** stays focusable (`aria-disabled`) so the tooltip and its reason read; a press
 *   does nothing. The glyph changes colour over 120 ms, never shape (F3 §7).
 * - **One press, any pointer:** a click or tap undoes or redoes one step, says it and reveals
 *   the change (`history/actions.ts`); focus stays on the button.
 * - **History scrubber** (08-feedback FB7) on ↶: a long press of 450 ms within 10 px (the
 *   gesture core's, for touch, pen and a held mouse button), a right-click, Shift+F10 or the
 *   Menu key. Releasing a long press without moving does nothing more; its click is swallowed.
 * - **A nudge on use** (G6): each undo, by ↶ or by key, nudges ↶'s glyph a few pixels back
 *   and lets it spring home on `quick`; each redo nudges ↷'s forward. The glyph only, never
 *   the button's box (its press scale is its own). None under reduced motion.
 * - **Enabled ⇄ disabled** cross-fades the glyph's colour (the primitive's 120 ms).
 * - Guard: none. History moves bypass `commit()` and work in Read mode and, from D1, while a
 *   document is locked (flows.md §2.5 rule 4).
 */
import { canRedo, canUndo, type History } from '@pdf-editor/document-model';
import { type KeyboardEvent, type MouseEvent, useEffect, useId, useRef } from 'react';

import { redoStep, undoStep } from '../../history/actions';
import { HistoryScrubber } from '../../history/HistoryScrubber';
import { redoTooltip, undoTooltip } from '../../history/labels';
import { openHistoryScrubber, useHistoryScrubber } from '../../history/scrubber-store';
import { m } from '../../i18n';
import { animateStyle } from '../../motion/animate';
import { useLongPress } from '../../motion/gesture';
import { reducedMotion } from '../../motion/reduced-motion';
import { springs } from '../../motion/springs';
import { useWorkspaceStore } from '../../state/workspace-store';
import { Icon } from '../../ui/Icon';
import { IconButton } from '../../ui/IconButton';
import { setHistoryOpener } from '../../ui/Toast';
import { useCommandShortcut } from '../use-command-shortcut';
import styles from './UndoRedo.module.css';

/** Pointer types whose held press opens the scrubber: a held mouse button is the fine path. */
const LONG_PRESS_TYPES = ['touch', 'pen', 'mouse'] as const;

/** How far the glyph travels at the peak of its nudge (CSS px). */
const NUDGE_PX = 3;

/**
 * Nudges `button`'s glyph by `direction` (−1 back, 1 forward): it leaves at rest with the speed
 * that carries a critically damped `quick` spring `NUDGE_PX` out (x(t) = v t e^(−ωt), whose
 * peak is v / (ω e)), and springs home.
 */
function nudge(button: HTMLElement | null, direction: -1 | 1): void {
  const glyph = button?.querySelector('svg');
  if (!glyph || reducedMotion()) return;
  const speed = direction * NUDGE_PX * Math.sqrt(springs.quick.stiffness) * Math.E;
  animateStyle(glyph, 'transform', [0, 0], [0, 0], { spring: 'quick', velocity: [speed, 0] });
}

/** Which way history moved between two states: an undo, a redo, or neither (a new step). */
export function historyStep(before: History, after: History): 'undo' | 'redo' | null {
  if (before === after) return null;
  const { past, future } = before;
  if (after.future.length === future.length + 1 && after.past.length === past.length - 1) {
    return 'undo';
  }
  if (after.future.length === future.length - 1 && after.past.length === past.length + 1) {
    return 'redo';
  }
  return null;
}

export function UndoRedo() {
  const history = useWorkspaceStore((s) => s.history);
  const scrubberOpen = useHistoryScrubber((s) => s.opening !== null);
  const undoShortcut = useCommandShortcut('edit.undo');
  const redoShortcut = useCommandShortcut('edit.redo');
  const undoRef = useRef<HTMLButtonElement>(null);
  const redoRef = useRef<HTMLButtonElement>(null);
  const seen = useRef(history);
  const hintId = useId();
  const undoable = canUndo(history);
  const redoable = canRedo(history);

  // A stale Undo toast offers History while ↶ is here to anchor it (FB4 §4).
  useEffect(() => {
    setHistoryOpener(openHistoryScrubber);
    return () => setHistoryOpener(undefined);
  }, []);

  // The nudge follows history itself, so a key or the History scrubber's step gives it too.
  useEffect(() => {
    const step = historyStep(seen.current, history);
    seen.current = history;
    if (step === 'undo') nudge(undoRef.current, -1);
    else if (step === 'redo') nudge(redoRef.current, 1);
  }, [history]);

  useLongPress(undoRef, {
    types: LONG_PRESS_TYPES,
    onFire: () => openHistoryScrubber(),
  });

  const onUndoKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'ContextMenu' || (event.key === 'F10' && event.shiftKey)) {
      event.preventDefault();
      openHistoryScrubber();
    }
  };
  const onUndoContextMenu = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    openHistoryScrubber();
  };

  return (
    <div className={styles.group} data-testid="undo-redo">
      <IconButton
        ref={undoRef}
        label={m.cmd_undo()}
        tooltip={undoTooltip(history)}
        icon={<Icon name="arrow-u-up-left" />}
        shortcut={undoShortcut}
        aria-disabled={undoable ? undefined : true}
        aria-haspopup="dialog"
        aria-expanded={scrubberOpen}
        aria-describedby={hintId}
        data-testid="undo-button"
        onClick={() => {
          if (undoable) undoStep();
        }}
        onKeyDown={onUndoKeyDown}
        onContextMenu={onUndoContextMenu}
      />
      <IconButton
        ref={redoRef}
        label={m.cmd_redo()}
        tooltip={redoTooltip(history)}
        icon={<Icon name="arrow-u-up-right" />}
        shortcut={redoShortcut}
        aria-disabled={redoable ? undefined : true}
        aria-describedby={`${hintId}-redo`}
        data-testid="redo-button"
        onClick={() => {
          if (redoable) redoStep();
        }}
      />
      <span id={hintId} className="visually-hidden">
        {undoTooltip(history)}. {m.undo_history_hint()}
      </span>
      <span id={`${hintId}-redo`} className="visually-hidden">
        {redoTooltip(history)}
      </span>
      <HistoryScrubber anchor={undoRef} />
    </div>
  );
}
