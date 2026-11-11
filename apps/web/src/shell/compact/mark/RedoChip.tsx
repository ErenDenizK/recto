/**
 * The Undo and Redo chips of the single capsule (EDN-24, EDN-29): two 44 px smoked glass circles
 * in the gutters either side of the tray, 12 px above the capsule (the capsule's row has no room
 * for Undo beside five tools and Done). Undo is always there while editing, `aria-disabled` at
 * the editing floor; Redo shows only while there is a step to redo (`history.future`), entering
 * from Undo (scale .6 to 1 and a fade on `quick`) and leaving on `--duration-fast`; reduced
 * motion is a fade (A-9). If focus is on Redo when it goes, focus moves to Undo. Both carry the
 * attributes the selection bar and keyboard band use to stay clear of them
 * (`data-compact-above-capsule`) and that keep a press on them from reaching the page
 * (`data-annotation-keep`); with the tray they are one glass surface for Q-11's budget
 * (`data-glass-group`).
 */
import { useLayoutEffect, useRef, useState } from 'react';

import { m } from '../../../i18n';
import { useWorkspaceStore } from '../../../state/workspace-store';
import { Icon } from '../../../ui/Icon';
import { IconButton } from '../../../ui/IconButton';
import { canUndoHere, redo, undo } from './bridge';
import styles from './RedoChip.module.css';

export function UndoChip() {
  const history = useWorkspaceStore((s) => s.history);
  const undoable = canUndoHere(history);
  return (
    <IconButton
      label={m.compact_undo()}
      tooltipSide="top"
      icon={<Icon name="arrow-u-up-left" />}
      className={styles.chip}
      aria-disabled={!undoable || undefined}
      data-compact-chrome=""
      data-annotation-keep=""
      data-compact-above-capsule=""
      data-glass-group="compact-options"
      data-testid="compact-undo"
      onClick={() => undo()}
    />
  );
}

export function RedoChip() {
  const redoable = useWorkspaceStore((s) => s.history.future.length > 0);
  const [shown, setShown] = useState(redoable);
  if (redoable && !shown) setShown(true);
  const ref = useRef<HTMLButtonElement>(null);

  // Focus on the chip when it goes: Undo takes it, so the keyboard keeps its place.
  useLayoutEffect(() => {
    const chip = ref.current;
    if (redoable || !chip || document.activeElement !== chip) return;
    document
      .querySelector<HTMLElement>('[data-testid="compact-undo"]')
      ?.focus({ preventScroll: true });
  }, [redoable]);

  if (!shown) return null;
  return (
    <IconButton
      ref={ref}
      label={m.compact_redo()}
      tooltipSide="top"
      icon={<Icon name="arrow-u-up-right" />}
      className={`${styles.chip} ${styles.redo}`}
      data-leaving={redoable ? undefined : ''}
      data-compact-chrome=""
      data-annotation-keep=""
      data-compact-above-capsule=""
      data-glass-group="compact-options"
      data-testid="compact-redo"
      tabIndex={redoable ? undefined : -1}
      onClick={() => redo()}
      onAnimationEnd={() => {
        if (!redoable) setShown(false);
      }}
    />
  );
}
